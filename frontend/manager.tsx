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
  FILTER_SHORT,
  FreeGame,
  formatUntil,
  isClaimableGame,
  normalizeSettings,
} from './config';
import {
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
      icon={
        <SuspensefulImage
          src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`}
          style={{ width: '120px', height: '45px', borderRadius: '3px', objectFit: 'cover' }}
          suspenseWidth="120px"
          suspenseHeight="45px"
        />
      }
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

      const owned = new Set(grabbedOwned);
      for (const g of merged) {
        if (isAlreadyInLibrary(g.appid)) owned.add(g.appid);
      }
      setGames(merged);
      setOwnedSet(owned);
    } catch {} finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => subscribeScanState(() => setScanBusy(isScanBusy())), []);

  const visible = useMemo(() => {
    let list = games;
    if (filterMode === 'weekend') list = list.filter((g) => g.type === 'weekend');
    else if (filterMode !== 'all') list = list.filter(isClaimableGame);
    if (hideOwned) {
      list = list.filter((g) => !ownedSet.has(g.appid) && !isAlreadyInLibrary(g.appid));
    }
    return list;
  }, [games, filterMode, hideOwned, ownedSet]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px', flex: 1, minHeight: 0 }}>
      {!loaded ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Field
          label="All caught up"
          description="No free items to show right now. Run a scan to check the store again."
          bottomSeparator="none"
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {visible.map((g) => (
            <GameRow
              key={`${g.type ?? 'game'}-${g.appid}`}
              game={g}
              owned={ownedSet.has(g.appid) || isAlreadyInLibrary(g.appid)}
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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0' }}>
          <DialogButton
            style={{ fontWeight: activeTab === 'games' ? 700 : 400, opacity: activeTab === 'games' ? 1 : 0.6 }}
            onClick={() => setActiveTab('games')}
          >
            Free Games
          </DialogButton>
          <DialogButton
            style={{ fontWeight: activeTab === 'settings' ? 700 : 400, opacity: activeTab === 'settings' ? 1 : 0.6 }}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </DialogButton>
          <div style={{ marginLeft: 'auto' }}>
            <DialogButton onClick={cycleFilter}>Filter: {FILTER_SHORT[filterMode]}</DialogButton>
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
