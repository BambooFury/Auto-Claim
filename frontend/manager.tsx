import {
  ButtonItem,
  DialogButton,
  Dropdown,
  Field,
  ProgressBar,
  Spinner,
  SuspensefulImage,
  showModal,
} from 'millennium';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilterMode,
  FILTER_OPTIONS,
  FreeGame,
  formatUntil,
  headerImageUrl,
  isClaimableGame,
} from './config';
import {
  isAlreadyInLibrary,
  loadFreeGamesCacheIPC,
  loadFreeWeekendCacheIPC,
  loadOwnedFromGrabbed,
} from './ipc';
import { isScanBusy, requestManualScan, subscribeScanState } from './scanControl';

const STORE_PAGE = (appid: number) => `https://store.steampowered.com/app/${appid}/`;

function GameRow({ game, owned }: { game: FreeGame; owned: boolean }): React.JSX.Element {
  const isWeekend = game.type === 'weekend';
  const status = owned
    ? 'In your library'
    : isWeekend
      ? `Free to play until ${formatUntil(game.until)}`
      : '100% off — not in your library';

  return (
    <Field
      label={game.name}
      description={status}
      icon={<SuspensefulImage src={headerImageUrl(game)} width={92} height={43} />}
    >
      {!owned && (
        <DialogButton onClick={() => window.open(STORE_PAGE(game.appid))}>View</DialogButton>
      )}
    </Field>
  );
}

export const ManagerContent: React.FC = () => {
  const [filterMode, setFilterMode] = useState<FilterMode>('games');
  const [games, setGames] = useState<FreeGame[]>([]);
  const [ownedSet, setOwnedSet] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [scanBusy, setScanBusy] = useState(isScanBusy());
  const [scanStatus, setScanStatus] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [gamesRaw, weekendRaw, grabbedOwned] = await Promise.all([
        loadFreeGamesCacheIPC(),
        loadFreeWeekendCacheIPC(),
        loadOwnedFromGrabbed(),
      ]);
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
    return list;
  }, [games, filterMode]);

  return (
    <div style={{ width: '560px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Field label="Show" description="Which free items to display">
        <Dropdown
          rgOptions={FILTER_OPTIONS}
          selectedOption={filterMode}
          onChange={(opt) => setFilterMode(opt.data as FilterMode)}
        />
      </Field>

      {!loaded ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Field label="All caught up" description="No free items to show right now." />
      ) : (
        <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {visible.map((g) => (
            <GameRow
              key={`${g.type ?? 'game'}-${g.appid}`}
              game={g}
              owned={ownedSet.has(g.appid) || isAlreadyInLibrary(g.appid)}
            />
          ))}
        </div>
      )}

      <ButtonItem
        disabled={scanBusy}
        onClick={async () => {
          setScanStatus('Scanning…');
          const ok = await requestManualScan();
          setScanStatus(ok ? 'Scan complete' : 'Scan failed — showing cached results');
          void refresh();
        }}
      >
        Scan now
      </ButtonItem>

      {scanBusy && <ProgressBar indeterminate />}
      {scanStatus && <Field label={scanStatus} bottomSeparator="none" padding="compact" />}
    </div>
  );
};

export function openManager(): void {
  showModal(<ManagerContent />, window, {
    strTitle: 'Auto Claim — Free Games',
    popupWidth: 640,
    popupHeight: 740,
  });
}
