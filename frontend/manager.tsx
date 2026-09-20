import {
  DialogButton,
  DialogButtonPrimary,
  Dropdown,
  Field,
  ProgressBar,
  Spinner,
  SuspensefulImage,
  Tabs,
  showModal,
} from 'millennium';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilterMode,
  FILTER_OPTIONS,
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
import { SettingsTab } from './settings';

const STORE_PAGE = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

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
      bottomSeparator="standard"
    >
      {!owned && (
        <DialogButton onClick={() => window.open(STORE_PAGE(game.appid))}>View in Store</DialogButton>
      )}
    </Field>
  );
}

function GamesTab(): React.JSX.Element {
  const [filterMode, setFilterMode] = useState<FilterMode>('games');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px' }}>
      <Field
        label="Filter"
        description="Games only shows full games. All free items also includes DLC, soundtracks and demos."
        bottomSeparator="thick"
      >
        <Dropdown
          rgOptions={FILTER_OPTIONS}
          selectedOption={filterMode}
          onChange={(opt) => setFilterMode(opt.data as FilterMode)}
        />
      </Field>

      {!loaded ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Field
          label="All caught up"
          description="No free items to show right now. Run a scan to check the store again."
          bottomSeparator="none"
        />
      ) : (
        visible.map((g) => (
          <GameRow
            key={`${g.type ?? 'game'}-${g.appid}`}
            game={g}
            owned={ownedSet.has(g.appid) || isAlreadyInLibrary(g.appid)}
          />
        ))
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

export const ManagerContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('games');

  return (
    <div style={{ width: '640px', minHeight: '480px' }}>
      <Tabs
        tabs={[
          { id: 'games', title: 'Free Games', content: <GamesTab /> },
          { id: 'settings', title: 'Settings', content: <SettingsTab showManagerButton={false} /> },
        ]}
        activeTab={activeTab}
        onShowTab={setActiveTab}
      />
    </div>
  );
};

export function openManager(): void {
  showModal(<ManagerContent />, window, {
    strTitle: 'Auto Claim — Free Games',
    popupWidth: 700,
    popupHeight: 760,
  });
}
