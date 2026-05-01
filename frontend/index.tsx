import { definePlugin, callable, toaster } from '@steambrew/client';
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsTab, WidgetSettings } from './settings';
type Empty = [];
type StrIn = [{ payload: string }];

const loadGrabbed       = callable<Empty, string>('load_grabbed_ipc');
const saveGrabbed       = callable<StrIn, number>('save_grabbed_ipc');
const loadSettings      = callable<Empty, string>('load_settings_ipc');
const saveSettings      = callable<StrIn, number>('save_settings_ipc');
const _logPluginIPC     = callable<StrIn, number>('log_plugin');
const fetchFreeGames    = callable<Empty, string>('fetch_free_games_backend');
const claimFreeGameLua  = callable<StrIn, string>('claim_free_game_backend');
const _loadWidgetIPC    = callable<Empty, string>('load_widget_settings_ipc');
const _saveWidgetIPC    = callable<StrIn, number>('save_widget_settings_ipc');
const setPendingClaim   = callable<StrIn, number>('set_pending_claim_ipc');
const popToasts         = callable<Empty, string>('pop_toasts_ipc');

const STORE_LS_KEY = 'fgg_store_settings';

const log = (msg: string) => {
  _logPluginIPC({ payload: msg }).catch(() => {});
};

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

interface FreeGame {
  appid: number;
  name:  string;
}

interface GrabbedEntry {
  appid:      number;
  name:       string;
  grabbed_at: number;
  added:      boolean;
}

interface Settings {
  autoAdd:         boolean;
  pollIntervalMin: number;
  notifyOnly:      boolean;
  notifyOnGrab:    boolean;
}

interface StoreSettingsSnapshot extends Settings, WidgetSettings {}

const DEFAULTS: Settings = {
  autoAdd:         true,
  pollIntervalMin: 30,
  notifyOnly:      false,
  notifyOnGrab:    true,
};

const defaultWidget = (): WidgetSettings => ({
  panelSide:   'left',
  tabColor:    'gray',
  showOverlay: false,
  tabStyle:    'large',
});

function syncStoreSettings(s: Settings, w: WidgetSettings): void {
  const snap: StoreSettingsSnapshot = {
    autoAdd:         s.autoAdd,
    notifyOnly:      s.notifyOnly,
    notifyOnGrab:    s.notifyOnGrab,
    pollIntervalMin: s.pollIntervalMin,
    tabColor:        w.tabColor,
    showOverlay:     w.showOverlay,
    panelSide:       w.panelSide,
    tabStyle:        w.tabStyle,
  };
  try {
    localStorage.setItem(STORE_LS_KEY, JSON.stringify(snap));
  } catch {}
}

const HEADER_URL = (id: number) =>
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;

function isAlreadyInLibrary(appid: number): boolean {
  try {
    const ov = (window as any).appStore?.GetAppOverviewByAppID?.(appid);
    return !!(ov && ov.local_per_client_data);
  } catch {
    return false;
  }
}

function showFreeGameNotification(game: FreeGame, onClick: () => void): void {
  toaster.toast({
    title: 'Free Game Available!',
    body:  `${game.name} is 100% off — grab it now!`,
    logo: React.createElement('img', {
      src: HEADER_URL(game.appid),
      style: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
    }),
    onClick,
    duration:  12000,
    sound:     1,
    playSound: true,
    showToast: true,
  });
}

function hideStorePage(): void {
  const sc  = (window as any).SteamClient;
  const mgr = sc?.MainWindowBrowserManager || (window as any).MainWindowBrowserManager;

  try { mgr?.LoadURL?.('steam://nav/library'); return; } catch {}
  try { mgr?.SetCurrentBrowserView?.(0); return; }       catch {}
  try { sc?.URL?.ExecuteSteamURL?.('steam://nav/library'); return; } catch {}
  try { sc?.URL?.ExecuteSteamURL?.('steam://open/library'); return; } catch {}
  try { sc?.Library?.ShowLibrary?.(); return; }          catch {}
}

async function addViaShowStore(appid: number): Promise<boolean> {
  const sc = (window as any).SteamClient;

  try { await setPendingClaim({ payload: String(appid) }); } catch {}

  let opened = false;
  for (let attempt = 0; attempt < 6 && !opened; attempt++) {
    try {
      sc.Apps.ShowStore(appid, 0);
      opened = true;
      log(`[${appid}] ShowStore opened (attempt ${attempt + 1})`);
    } catch (e) {
      log(`[${appid}] ShowStore attempt ${attempt + 1} failed: ${String(e)}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  if (!opened) {
    try { await setPendingClaim({ payload: '' }); } catch {}
    return false;
  }

  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (isAlreadyInLibrary(appid)) {
      log(`[${appid}] detected in library after ${(i + 1) * 0.5}s`);
      hideStorePage();
      return true;
    }
  }
  log(`[${appid}] ShowStore fallback timed out`);
  return false;
}

async function addGameToLibrary(appid: number): Promise<boolean> {
  if (isAlreadyInLibrary(appid)) return true;

  let result = '0|no result';
  try {
    result = await withTimeout(
      claimFreeGameLua({ payload: String(appid) }),
      30000,
      '0|timeout',
    );
  } catch (e) {
    log(`[${appid}] backend claim exception: ${String(e)}`);
  }

  let [status, reason] = (result || '0|').split('|');
  if (status === '1') {
    log(`[${appid}] silent claim ok (${reason})`);
    return true;
  }

  log(`[${appid}] silent claim failed: ${reason}`);

  const r = (reason || '').toLowerCase();
  const cookieIssue =
    r.indexOf('no cookies')      !== -1 ||
    r.indexOf('no sessionid')    !== -1 ||
    r.indexOf('session expired') !== -1;
  if (!cookieIssue) return false;

  log(`[${appid}] cookies stale — opening store to refresh session`);
  if (await addViaShowStore(appid)) return true;

  try {
    result = await withTimeout(
      claimFreeGameLua({ payload: String(appid) }),
      30000,
      '0|timeout',
    );
    [status, reason] = (result || '0|').split('|');
    if (status === '1') {
      log(`[${appid}] silent claim ok after cookie refresh`);
      return true;
    }
    log(`[${appid}] retry after cookie refresh still failed: ${reason}`);
  } catch (e) {
    log(`[${appid}] retry exception: ${String(e)}`);
  }
  return false;
}

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [widget,   setWidget]   = useState<WidgetSettings>(defaultWidget());
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    const boot = async () => {
      const sRaw = await withTimeout(loadSettings(), 3000, '{}');
      let s: Settings = { ...DEFAULTS };
      try { s = { ...DEFAULTS, ...JSON.parse(sRaw || '{}') }; } catch {}
      setSettings(s);

      let w: WidgetSettings = defaultWidget();
      try {
        const wRaw = await withTimeout(_loadWidgetIPC(), 3000, '{}');
        w = { ...w, ...JSON.parse(wRaw || '{}') };
      } catch {}
      setWidget(w);

      syncStoreSettings(s, w);
      setLoaded(true);
    };
    setTimeout(() => { void boot(); }, 500);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings({ payload: JSON.stringify(next) });
      syncStoreSettings(next, widget);
      return next;
    });
  }, [widget]);

  const updateWidget = useCallback((patch: Partial<WidgetSettings>) => {
    setWidget((prev) => {
      const next = { ...prev, ...patch };
      _saveWidgetIPC({ payload: JSON.stringify(next) });
      syncStoreSettings(settings, next);
      return next;
    });
  }, [settings]);

  if (!loaded) {
    return React.createElement('div',
      { style: { padding: '16px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' } },
      'Loading...',
    );
  }

  return React.createElement('div',
    { style: { display: 'flex', flexDirection: 'column' } },
    React.createElement(SettingsTab, {
      plugin:    settings,
      widget,
      onPlugin:  updateSettings,
      onWidget:  updateWidget,
    }),
  );
};

const SCAN_NAME_BLOCKLIST = [
  'skin pack', 'dlc', 'soundtrack', 'ost',
  'bundle', 'pack', 'costume', 'outfit',
  'weapon skin', 'character skin',
];

async function waitForSteamReady(): Promise<void> {
  await new Promise<void>((resolve) => {
    const check = () => {
      if ((window as any).appStore) resolve();
      else setTimeout(check, 1000);
    };
    check();
  });
  await new Promise((r) => setTimeout(r, 20000));
}

async function drainPendingToasts(): Promise<void> {
  try {
    const raw = await withTimeout(popToasts(), 3000, '[]');
    const items: FreeGame[] = JSON.parse(raw || '[]');
    for (const g of items) {
      if (!g || typeof g.appid !== 'number') continue;
      showFreeGameNotification(g, () => {
        (window as any).SteamClient?.Apps?.ShowStore?.(g.appid, 0);
      });
    }
  } catch {}
}

async function startPolling(): Promise<void> {
  await waitForSteamReady();

  setInterval(() => { void drainPendingToasts(); }, 5000);

  let settings: Settings = { ...DEFAULTS };
  let grabbedSet = new Set<number>();

  async function reloadState(): Promise<void> {
    const [sRaw, gRaw] = await Promise.all([
      withTimeout(loadSettings(), 3000, '{}'),
      withTimeout(loadGrabbed(),  3000, '[]'),
    ]);
    try { settings = { ...DEFAULTS, ...JSON.parse(sRaw || '{}') }; } catch {}
    try {
      const list: GrabbedEntry[] = JSON.parse(gRaw || '[]');
      grabbedSet = new Set(list.filter((e) => e.added !== false).map((e) => e.appid));
    } catch {}
  }

  async function recordGrabbed(game: FreeGame, added: boolean): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const raw = await withTimeout(loadGrabbed(), 3000, '[]');
        const arr: GrabbedEntry[] = JSON.parse(raw || '[]');
        const idx = arr.findIndex((e) => e.appid === game.appid);
        const entry: GrabbedEntry = {
          appid:      game.appid,
          name:       game.name,
          grabbed_at: Math.floor(Date.now() / 1000),
          added,
        };
        if (idx >= 0) arr[idx] = entry;
        else          arr.unshift(entry);

        await withTimeout(saveGrabbed({ payload: JSON.stringify(arr) }), 3000, 0);
        if (added) grabbedSet.add(game.appid);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (added) grabbedSet.add(game.appid);
  }

  function shouldSkipByName(name: string): boolean {
    const lower = name.toLowerCase();
    return SCAN_NAME_BLOCKLIST.some((kw) => lower.includes(kw));
  }

  async function processGame(game: FreeGame): Promise<void> {
    try {
      if (isAlreadyInLibrary(game.appid)) {
        log(`${game.name} — already in library, skipping`);
        grabbedSet.add(game.appid);
        return;
      }

      if (shouldSkipByName(game.name)) {
        log(`${game.name} — skipping (DLC/pack detected by name)`);
        grabbedSet.add(game.appid);
        return;
      }

      log(`Free game detected: ${game.name} (${game.appid})`);

      if (settings.notifyOnly) {
        showFreeGameNotification(game, () => {
          (window as any).SteamClient?.Apps?.ShowStore?.(game.appid, 0);
        });
        return;
      }

      if (settings.autoAdd) {
        const added = await addGameToLibrary(game.appid);
        if (added) {
          await recordGrabbed(game, true);
          if (settings.notifyOnGrab) {
            showFreeGameNotification(game, () => {
              (window as any).SteamClient?.Apps?.ShowStore?.(game.appid, 0);
            });
          }
          log(`${game.name} — successfully added to library`);
        } else {
          await recordGrabbed(game, false);
          log(`${game.name} — failed to add, will retry next scan`);
        }
        return;
      }

      showFreeGameNotification(game, async () => {
        const added = await addGameToLibrary(game.appid);
        await recordGrabbed(game, added);
        log(`${game.name} — grabbed via click (${added ? 'added' : 'failed'})`);
      });
    } catch (e) {
      log(`processGame error for ${game.name}: ${String(e)}`);
    }
  }

  async function runOneScan(): Promise<void> {
    await reloadState();
    log('Scanning Steam Store for 100% discounts...');

    try {
      const raw = await withTimeout(fetchFreeGames(), 30000, '[]');
      const games: FreeGame[] = JSON.parse(raw || '[]');
      log(`Scan complete — ${games.length} free game(s) found`);

      for (const game of games) {
        await processGame(game);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      log(`Scan error: ${String(e)}`);
    }
  }

  await runOneScan();

  const scheduleNext = () => {
    const interval = (settings.pollIntervalMin || 30) * 60 * 1000;
    setTimeout(async () => { await runOneScan(); scheduleNext(); }, interval);
    log(`Next scan in ${settings.pollIntervalMin} min`);
  };
  scheduleNext();
}

export default definePlugin(() => {
  void startPolling();
  return {
    title: 'Auto Claim',
    icon:  React.createElement('span', { style: { fontSize: '16px' } }, '🎁'),
    content: React.createElement(SettingsPanel),
  };
});
