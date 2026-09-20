import {
  ButtonItem,
  DialogButton,
  DialogButtonPrimary,
  Field,
  ProgressBar,
  Spinner,
  SuspensefulImage,
  routerHook,
} from 'millennium';
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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
import { isScanBusy, requestManualScan, subscribeScanState } from './scanControl';
import { SettingsRows, usePluginSettings } from './settingsRows';
import { SteamDialog } from './steamDialog';
import { logIPC } from './ipc';

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

function OwnedCheck(): React.JSX.Element {
  return (
    <div
      title="In your library"
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        background: 'rgba(85, 204, 85, 0.18)',
        border: '1px solid rgba(85, 204, 85, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#55cc55" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </div>
  );
}

function GameImage({ game }: { game: FreeGame }): React.JSX.Element {
  const cdn = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}`;
  const candidates = [
    game.header,
    game.capsule,
    `${cdn}/header.jpg`,
    `${cdn}/capsule_231x87.jpg`,
    `${cdn}/library_hero.jpg`,
  ].filter((src, index, all) => src && all.indexOf(src) === index);

  const [failed, setFailed] = useState(0);
  const src = candidates[failed];

  if (!src) {
    return <div style={{ width: '120px', height: '45px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />;
  }

  return (
    <SuspensefulImage
      src={src}
      onError={() => setFailed((f) => f + 1)}
      style={{ width: '120px', height: '45px', borderRadius: '3px', objectFit: 'cover' }}
      suspenseWidth="120px"
      suspenseHeight="45px"
    />
  );
}

function gameStatus(game: FreeGame, owned: boolean): string {
  if (owned) return 'In your library';
  if (game.type === 'weekend') return `Free to play until ${formatUntil(game.until)}`;
  return '100% off — not in your library yet';
}

function GameRow({ game, owned }: { game: FreeGame; owned: boolean }): React.JSX.Element {
  return (
    <Field
      label={game.name}
      description={gameStatus(game, owned)}
      icon={<GameImage game={game} />}
      childrenLayout="inline"
      childrenContainerWidth="min"
    >
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {owned ? (
          <OwnedCheck />
        ) : (
          <DialogButton
            style={{ padding: '10px 22px', whiteSpace: 'nowrap' }}
            onClick={() => window.open(STORE_PAGE(game.appid))}
          >
            View in Store
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
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(85, 204, 85, 0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
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
      if (apiOwned === null) {
        for (const g of merged) {
          if (isAlreadyInLibrary(g.appid)) owned.add(g.appid);
        }
      } else {
        for (const id of apiOwned) owned.add(id);
      }
      for (const g of merged) {
        log(
          `ownership: ${g.name} (${g.appid}) — api=${apiOwned === null ? 'FAIL' : apiOwned.has(g.appid)}` +
          ` appStore=${isAlreadyInLibrary(g.appid)} grabbed=${grabbedOwned.has(g.appid)}`,
        );
      }
      setOwnedSet(owned);
    } catch {}
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => subscribeScanState(() => setScanBusy(isScanBusy())), []);

  const visible = useMemo(() => {
    let list = games;
    if (filterMode === 'weekend') list = list.filter((g) => g.type === 'weekend');
    else if (filterMode !== 'all') list = list.filter(isClaimableGame);
    if (hideOwned) {
      list = list.filter((g) => !ownedSet.has(g.appid));
    }
    return list;
  }, [games, filterMode, hideOwned, ownedSet]);

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
            />
          ))}
        </div>
      )}

      <DialogButtonPrimary
        disabled={scanBusy}
        onClick={async () => {
          setScanStatus('Scanning the store…');
          const ok = await requestManualScan();
          setScanStatus(ok ? 'Scan complete' : 'Scan failed — showing cached results');
          void refresh();
        }}
      >
        {scanBusy ? 'Scanning…' : 'Scan Now'}
      </DialogButtonPrimary>

      {scanBusy && <ProgressBar indeterminate />}
      {scanStatus && !scanBusy && (
        <Field label={scanStatus} bottomSeparator="none" padding="compact" />
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
        Reset to defaults
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
            Free Games
          </DialogButton>
          <DialogButton
            style={{ padding: '10px 18px', fontWeight: activeTab === 'settings' ? 700 : 400, opacity: activeTab === 'settings' ? 1 : 0.6, position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </DialogButton>
          <div style={{ marginLeft: 'auto', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <DialogButton
              style={{ padding: '10px 18px', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              onClick={cycleFilter}
            >
              Filter: {FILTER_SHORT[filterMode]}
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
    log('manager: global component registered');
  } catch (e) {
    log(`manager: global component registration failed: ${String(e)}`);
  }
}

export function openManager(): void {
  registerManager();
  setOpen(false);
  setTimeout(() => setOpen(true), 1);
}
