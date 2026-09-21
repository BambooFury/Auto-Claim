import {
  ButtonItem,
  DialogButton,
  DialogButtonPrimary,
  Field,
  Navigation,
  ProgressBar,
  Spinner,
  routerHook,
} from 'millennium';
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { MdCheck, MdCheckCircle, MdFilterList, MdOpenInNew, MdRefresh, MdRadar, MdSettings, MdSportsEsports, MdStorefront } from 'react-icons/md';
import {
  DEFAULT_SETTINGS,
  type FilterMode,
  FreeGame,
  formatUntil,
  isClaimableGame,
  normalizeSettings,
} from './config';
import {
  checkLibraryOwnership,
  isAlreadyInLibrary,
  loadFreeGamesCacheIPC,
  loadFreeWeekendCacheIPC,
  loadOwnedFromGrabbed,
  loadSettingsIPC,
} from './ipc';
import { isScanBusy, requestManualScan, resetNewGamesCount, subscribeScanState } from './scanControl';
import { subscribeClaimState, getClaimSnapshot } from './claimState';
import { SettingsRows, usePluginSettings } from './settingsRows';
import { SteamDialog } from './steamDialog';
import { logIPC } from './ipc';
import { markAllSeen } from './seenSet';

const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const DESKTOP_UI_MODE = 7;
const STORE_PAGE = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

let managerOpen = false;
const managerListeners = new Set<() => void>();

function setOpen(next: boolean): void {
  managerOpen = next;
  for (const fn of Array.from(managerListeners)) fn();
}

function subscribeManager(fn: () => void): () => void {
  managerListeners.add(fn);
  return () => { managerListeners.delete(fn); };
}

const FILTER_SHORT: Record<FilterMode, string> = {
  games: 'Games',
  all: 'All',
  weekend: 'Weekend',
};

function OwnedBadge(): React.JSX.Element {
  return (
    <div
      title="In your library"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        height: '30px',
        padding: '0 12px 0 0',
        borderRadius: '4px',
        background: 'rgba(85, 204, 85, 0.1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '3px',
          height: '100%',
          background: '#55cc55',
          flexShrink: 0,
        }}
      />
      <MdCheck size={12} color="#55cc55" />
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'rgba(85, 204, 85, 0.9)',
          whiteSpace: 'nowrap',
        }}
      >
        Owned
      </span>
    </div>
  );
}

function GameImage({ game }: { game: FreeGame }): React.JSX.Element {
  const cdn = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}`;
  const candidates = [
    game.header,
    game.capsule,
    `${cdn}/header.jpg`,
    `${cdn}/library_hero.jpg`,
    `${cdn}/library_600x900.jpg`,
    `${cdn}/capsule_231x87.jpg`,
    `${cdn}/capsule_184x69.jpg`,
  ].filter((src, index, all) => src && all.indexOf(src) === index);

  const [failed, setFailed] = useState(0);
  const src = candidates[failed];

  if (!src) {
    return <div style={{ width: '120px', height: '45px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />;
  }

  return (
    <img
      src={src}
      onError={() => setFailed((f) => f + 1)}
      style={{ width: '120px', height: '45px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.06)' }}
    />
  );
}

function gameStatus(game: FreeGame, owned: boolean): string {
  if (owned) return 'In your library';
  if (game.type === 'weekend') return `Free to play until ${formatUntil(game.until)}`;
  return '100% off — not in your library yet';
}

function GameRow({ game, owned, claimStatus }: { game: FreeGame; owned: boolean; claimStatus: 'idle' | 'claiming' | 'claimed' | 'failed' }): React.JSX.Element {
  return (
    <Field
      label={game.name}
      description={gameStatus(game, owned)}
      icon={
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <GameImage game={game} />
          {owned && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '3px',
                background: 'rgba(85, 204, 85, 0.12)',
                border: '1px solid rgba(85, 204, 85, 0.35)',
                pointerEvents: 'none',
              }}
            />
          )}
          {claimStatus === 'claiming' && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: '3px',
                background: 'rgba(0, 0, 0, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Spinner style={{ width: '20px', height: '20px' }} />
            </div>
          )}
        </div>
      }
      childrenLayout="inline"
      childrenContainerWidth="min"
    >
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'stretch' }}>
        {owned ? (
          <>
            <OwnedBadge />
            <DialogButton
              style={{ padding: '8px', minWidth: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => Navigation.Navigate(`/library/app/${game.appid}`)}
            >
              <MdOpenInNew size={14} />
            </DialogButton>
          </>
        ) : claimStatus === 'claiming' ? (
          <DialogButton disabled style={{ padding: '10px 22px', whiteSpace: 'nowrap', opacity: 0.6 }}>
            Claiming…
          </DialogButton>
        ) : (
          <DialogButton
            style={{ padding: '10px 22px', whiteSpace: 'nowrap' }}
            onClick={() => window.open(STORE_PAGE(game.appid))}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <MdStorefront size={14} />
              View in Store
            </span>
          </DialogButton>
        )}
      </div>
    </Field>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(85, 204, 85, 0.1)',
          border: '1px solid rgba(85, 204, 85, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MdCheckCircle size={36} color="rgba(85, 204, 85, 0.7)" />
      </div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--main-text-color, #ffffff)' }}>
        You're all caught up
      </div>
      <div style={{ fontSize: '12.5px', lineHeight: 1.6, color: 'var(--secondary-text-color, rgba(255,255,255,0.5))', maxWidth: '340px' }}>
        There are no free games to show right now.
        <br />
        New giveaways appear all the time — run a scan anytime to check the store again.
      </div>
    </div>
  );
}

function GamesTab({ filterMode }: { filterMode: FilterMode }): React.JSX.Element {
  const [games, setGames] = useState<FreeGame[]>([]);
  const [ownedSet, setOwnedSet] = useState<Set<number>>(new Set());
  const [hideOwned, setHideOwned] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scanBusy, setScanBusy] = useState(isScanBusy());
  const [scanStatus, setScanStatus] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [gamesRaw, weekendRaw, grabbedOwned, settingsRaw] = await Promise.all([
        loadFreeGamesCacheIPC(),
        loadFreeWeekendCacheIPC(),
        loadOwnedFromGrabbed(),
        loadSettingsIPC().catch(() => '{}'),
      ]);
      setHideOwned(normalizeSettings(JSON.parse(settingsRaw || '{}')).hideOwned);
      const parsed: FreeGame[] = JSON.parse(gamesRaw || '[]');
      const weekend: FreeGame[] = JSON.parse(weekendRaw || '[]');
      const weekendIds = new Set(weekend.map((g) => g.appid));
      const merged = parsed
        .map((g) => (weekendIds.has(g.appid) ? { ...g, type: 'weekend' } : g))
        .concat(weekend.filter((g) => !parsed.some((p) => p.appid === g.appid)));

      setGames(merged);
      setLoaded(true);

      const owned = new Set(grabbedOwned);
      const apiOwned = await checkLibraryOwnership(merged.map((g) => g.appid));
      for (const g of merged) {
        const apiSays = apiOwned === null ? false : apiOwned.has(g.appid);
        if (apiSays || isAlreadyInLibrary(g.appid)) owned.add(g.appid);
      }
      setOwnedSet(owned);
    } catch {}
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => subscribeScanState(() => setScanBusy(isScanBusy())), []);

  useEffect(() => subscribeScanState(() => { void refresh(); }), [refresh]);

  const visible = useMemo(() => {
    let list = games;
    if (filterMode === 'weekend') list = list.filter((g) => g.type === 'weekend');
    else if (filterMode !== 'all') list = list.filter(isClaimableGame);
    if (hideOwned) {
      list = list.filter((g) => !ownedSet.has(g.appid));
    }
    return list;
  }, [games, filterMode, hideOwned, ownedSet]);

  const [, forceUpdate] = useState(0);

  useEffect(() => subscribeClaimState(() => {
    const snap = getClaimSnapshot();
    if (snap.claimed.size > 0) {
      setOwnedSet((prev) => {
        const next = new Set(prev);
        for (const id of snap.claimed) next.add(id);
        return next;
      });
    }
    forceUpdate((n) => n + 1);
  }), []);

  const claimSnap = getClaimSnapshot();

  function claimStatusFor(appid: number): 'idle' | 'claiming' | 'claimed' | 'failed' {
    if (claimSnap.claiming.has(appid)) return 'claiming';
    if (claimSnap.claimed.has(appid)) return 'claimed';
    if (claimSnap.failed.has(appid)) return 'failed';
    return 'idle';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', flex: 1, minHeight: 0 }}>
      {!loaded ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {visible.map((g) => (
            <GameRow
              key={`${g.type ?? 'game'}-${g.appid}`}
              game={g}
              owned={ownedSet.has(g.appid)}
              claimStatus={claimStatusFor(g.appid)}
            />
          ))}
        </div>
      )}

      <DialogButtonPrimary
        disabled={scanBusy}
        onClick={async () => {
          setScanStatus('Scanning the store…');
          const ok = await requestManualScan();
          if (!ok && !isScanBusy()) {
            setScanStatus('Scan already running…');
          } else {
            setScanStatus(ok ? 'Scan complete' : 'Scan failed — showing cached results');
          }
          void refresh();
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <MdRadar size={16} />
          {scanBusy ? 'Scanning…' : 'Scan Now'}
        </span>
      </DialogButtonPrimary>

      {scanBusy && <ProgressBar indeterminate />}
      {scanStatus && !scanBusy && (
        <Field
          label={scanStatus}
          bottomSeparator="none"
          padding="compact"
          icon={<MdCheckCircle size={16} color={scanStatus.includes('complete') ? '#5dc26a' : '#e05252'} />}
        />
      )}
    </div>
  );
}

function ManagerSettingsTab(): React.JSX.Element {
  const [settings, update] = usePluginSettings();

  if (!settings) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px' }}>
      <SettingsRows settings={settings} update={update} />
      <ButtonItem
        layout="below"
        onClick={() => {
          update({ ...DEFAULT_SETTINGS });
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <MdRefresh size={16} />
          Reset to defaults
        </span>
      </ButtonItem>
    </div>
  );
}

function ManagerWindow(): React.JSX.Element | null {
  const open = useSyncExternalStore(subscribeManager, () => managerOpen);
  const [settings, update] = usePluginSettings();
  const [activeTab, setActiveTab] = useState<'games' | 'settings'>('games');

  const filterMode: FilterMode = settings?.filterMode ?? 'games';
  const cycleFilter = (): void => {
    const next: FilterMode = filterMode === 'games' ? 'all' : filterMode === 'all' ? 'weekend' : 'games';
    update({ filterMode: next });
  };

  if (!open) return null;

  return (
    <SteamDialog
      strTitle="Auto Claim — Free Games"
      onDismiss={() => setOpen(false)}
      popupWidth={860}
      popupHeight={560}
      minWidth={640}
      minHeight={420}
      resizable
      saveDimensionsKey="autoClaimManager"
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, paddingTop: '8px' }}>
        <div
          style={{
            display: 'flex', gap: '6px', padding: '0 16px 4px',
            position: 'relative', zIndex: 10, WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <DialogButton
            style={{ padding: '10px 18px', fontWeight: activeTab === 'games' ? 700 : 400, opacity: activeTab === 'games' ? 1 : 0.6, position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onClick={() => setActiveTab('games')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <MdSportsEsports size={16} />
              Free Games
            </span>
          </DialogButton>
          <DialogButton
            style={{ padding: '10px 18px', fontWeight: activeTab === 'settings' ? 700 : 400, opacity: activeTab === 'settings' ? 1 : 0.6, position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onClick={() => setActiveTab('settings')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <MdSettings size={15} />
              Settings
            </span>
          </DialogButton>
          <div style={{ marginLeft: 'auto', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <DialogButton
              style={{ padding: '10px 18px', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              onClick={cycleFilter}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <MdFilterList size={13} />
                Filter: {FILTER_SHORT[filterMode]}
              </span>
            </DialogButton>
          </div>
        </div>
        {activeTab === 'games' ? <GamesTab filterMode={filterMode} /> : <ManagerSettingsTab />}
      </div>
    </SteamDialog>
  );
}

let managerRegistered = false;

export function registerManager(): void {
  if (managerRegistered) return;
  managerRegistered = true;
  try {
    routerHook.addGlobalComponent('AutoClaimManager', () => <ManagerWindow />, DESKTOP_UI_MODE);
  } catch (e) {
    log(`manager: registration failed: ${String(e)}`);
  }
}

export function openManager(): void {
  registerManager();
  void (async () => {
    try {
      const [gamesRaw, weekendRaw] = await Promise.all([
        loadFreeGamesCacheIPC(),
        loadFreeWeekendCacheIPC(),
      ]);
      const parsed: FreeGame[] = JSON.parse(gamesRaw || '[]');
      const weekend: FreeGame[] = JSON.parse(weekendRaw || '[]');
      const ids = [
        ...parsed.map((g) => g.appid),
        ...weekend.filter((g) => !parsed.some((p) => p.appid === g.appid)).map((g) => g.appid),
      ];
      markAllSeen(ids);
    } catch {}
    resetNewGamesCount();
  })();
  setOpen(false);
  setTimeout(() => setOpen(true), 1);
}
