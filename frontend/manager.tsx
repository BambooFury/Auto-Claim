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
      for (const g of merged) {
        const apiSays = apiOwned === null ? false : apiOwned.has(g.appid);
        if (apiSays || isAlreadyInLibrary(g.appid)) owned.add(g.appid);
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

function GamesIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <path d="M0 0h20v20H0z" fill="none" />
      <path
        fill="currentColor"
        d="M15.9 5.5C15.3 4.5 14.2 4 13 4H7c-1.2 0-2.3.5-2.9 1.5c-2.3 3.5-2.8 8.8-1.2 9.9s5.2-3.7 7.1-3.7s5.4 4.8 7.1 3.7c1.6-1.1 1.1-6.4-1.2-9.9M8 9H7v1H6V9H5V8h1V7h1v1h1zm5.4.5c0 .5-.4.9-.9.9s-.9-.4-.9-.9s.4-.9.9-.9s.9.4.9.9m1.9-2c0 .5-.4.9-.9.9s-.9-.4-.9-.9s.4-.9.9-.9s.9.4.9.9"
      />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <path d="M0 0h36v36H0z" fill="none" />
      <path
        fill="currentColor"
        d="m32.57 15.72l-3.35-1a11.7 11.7 0 0 0-.95-2.33l1.64-3.07a.61.61 0 0 0-.11-.72l-2.39-2.4a.61.61 0 0 0-.72-.11l-3.05 1.63a11.6 11.6 0 0 0-2.36-1l-1-3.31a.61.61 0 0 0-.59-.41h-3.38a.61.61 0 0 0-.58.43l-1 3.3a11.6 11.6 0 0 0-2.38 1l-3-1.62a.61.61 0 0 0-.72.11L6.2 8.59a.61.61 0 0 0-.11.72l1.62 3a11.6 11.6 0 0 0-1 2.37l-3.31 1a.61.61 0 0 0-.43.58v3.38a.61.61 0 0 0 .43.58l3.33 1a11.6 11.6 0 0 0 1 2.33l-1.64 3.14a.61.61 0 0 0 .11.72l2.39 2.39a.61.61 0 0 0 .72.11l3.09-1.65a11.7 11.7 0 0 0 2.3.94l1 3.37a.61.61 0 0 0 .58.43h3.38a.61.61 0 0 0 .58-.43l1-3.38a11.6 11.6 0 0 0 2.28-.94l3.11 1.66a.61.61 0 0 0 .72-.11l2.39-2.39a.61.61 0 0 0 .11-.72l-1.66-3.1a11.6 11.6 0 0 0 .95-2.29l3.37-1a.61.61 0 0 0 .43-.58v-3.41a.61.61 0 0 0-.37-.59M18 23.5a5.5 5.5 0 1 1 5.5-5.5a5.5 5.5 0 0 1-5.5 5.5"
      />
    </svg>
  );
}

function FilterIcon(): React.JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <path d="M0 0h16v16H0z" fill="none" />
      <path
        fill="currentColor"
        d="M14 1a1 1 0 0 1 1 1v1.586a1 1 0 0 1-.293.707L10 9v4.219a1 1 0 0 1-.758.97l-2.62.656A.5.5 0 0 1 6 14.359V9L1.293 4.293A1 1 0 0 1 1 3.586V2a1 1 0 0 1 1-1z"
      />
    </svg>
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
              <GamesIcon />
              Free Games
            </span>
          </DialogButton>
          <DialogButton
            style={{ padding: '10px 18px', fontWeight: activeTab === 'settings' ? 700 : 400, opacity: activeTab === 'settings' ? 1 : 0.6, position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onClick={() => setActiveTab('settings')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
              <SettingsIcon />
              Settings
            </span>
          </DialogButton>
          <div style={{ marginLeft: 'auto', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <DialogButton
              style={{ padding: '10px 18px', position: 'relative', zIndex: 2, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              onClick={cycleFilter}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                <FilterIcon />
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
