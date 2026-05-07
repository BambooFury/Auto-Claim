import { definePlugin, callable, toaster } from '@steambrew/client';
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsTab, WidgetSettings } from './settings';
import { MIN_POLL_INTERVAL_MIN } from './constants';
type Empty = [];
type StrIn = [{ payload: string }];

const loadGrabbed       = callable<Empty, string>('load_grabbed_ipc');
const saveGrabbed       = callable<StrIn, number>('save_grabbed_ipc');
const loadSettings      = callable<Empty, string>('load_settings_ipc');
const _logPluginIPC     = callable<StrIn, number>('log_plugin');
const fetchFreeGames    = callable<Empty, string>('fetch_free_games_backend');
const claimFreeGameLua  = callable<StrIn, string>('claim_free_game_backend');
const _loadWidgetIPC    = callable<Empty, string>('load_widget_settings_ipc');
const _saveWidgetIPC    = callable<StrIn, number>('save_widget_settings_ipc');
const setPendingClaim   = callable<StrIn, number>('set_pending_claim_ipc');
const popToasts         = callable<Empty, string>('pop_toasts_ipc');
const popScanRequest    = callable<Empty, string>('pop_scan_request_ipc');
const tryAcquireClaimLock = callable<StrIn, number>('try_acquire_claim_lock_ipc');
const releaseClaimLock    = callable<StrIn, number>('release_claim_lock_ipc');

const enqueueClaimJob   = callable<StrIn, number>('enqueue_claim_job_ipc');
const readClaimJob      = callable<StrIn, string>('read_claim_job_ipc');

const STORE_LS_KEY = 'fgg_store_settings';

const _autoclaimIntervals: Array<ReturnType<typeof setInterval>> = [];
let _autoclaimNextScanTimer: ReturnType<typeof setTimeout> | null = null;
let _autoclaimPollingStarted = false;

function _trackInterval(fn: () => void, ms: number): ReturnType<typeof setInterval> {
  const id = setInterval(fn, ms);
  _autoclaimIntervals.push(id);
  return id;
}

function _clearAutoclaimTimers(): void {
  while (_autoclaimIntervals.length) {
    const id = _autoclaimIntervals.pop();
    if (id !== undefined) clearInterval(id);
  }
  if (_autoclaimNextScanTimer) {
    clearTimeout(_autoclaimNextScanTimer);
    _autoclaimNextScanTimer = null;
  }
}

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
  type?: string;
}

function isAutoClaimable(game: FreeGame): boolean {
  return !game.type || game.type === 'game' || game.type === 'unknown';
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
  notifyOnGrab:    boolean;
}

interface StoreSettingsSnapshot extends Settings, WidgetSettings {}

const DEFAULTS: Settings = {
  autoAdd:         true,
  pollIntervalMin: 30,
  notifyOnGrab:    true,
};

function normalizeSettings(s: Settings): Settings {
  const poll = typeof s.pollIntervalMin === 'number' && s.pollIntervalMin >= MIN_POLL_INTERVAL_MIN
    ? s.pollIntervalMin
    : MIN_POLL_INTERVAL_MIN;
  return { ...s, pollIntervalMin: poll };
}

const defaultWidget = (): WidgetSettings => ({
  panelSide:      'left',
  tabColor:       'gray',
  accentColor:    'rgba(255,255,255,0.5)',
  indicatorColor: '#ff7a3c',
  showOverlay:    false,
  tabStyle:       'large',
});

function syncStoreSettings(s: Settings, w: WidgetSettings): void {
  const snap: StoreSettingsSnapshot = {
    autoAdd:         s.autoAdd,
    notifyOnGrab:    s.notifyOnGrab,
    pollIntervalMin: s.pollIntervalMin,
    tabColor:        w.tabColor,
    accentColor:     w.accentColor,
    indicatorColor:  w.indicatorColor,
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
    const store = (window as any).appStore;
    const ov = store?.GetAppOverviewByAppID?.(appid);
    if (!ov) return false;
    if (ov.installed === true) return true;
    const lpcd = ov.local_per_client_data;
    if (lpcd && (lpcd.installed === true || lpcd.is_owned === true)) return true;
    const apps = store?.allApps;
    if (Array.isArray(apps)) {
      for (const a of apps) {
        if (a && a.appid === appid) return true;
      }
    }
    return false;
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

function getCurrentStoreUrl(): string {
  const sc  = (window as any).SteamClient;
  const mgr = sc?.MainWindowBrowserManager || (window as any).MainWindowBrowserManager;
  try { return mgr?.m_browser?.GetURL?.() || mgr?.GetCurrentURL?.() || mgr?.m_lastLocation || ''; } catch { return ''; }
}

function navigateBack(prevUrl: string): void {
  const sc  = (window as any).SteamClient;
  const mgr = sc?.MainWindowBrowserManager || (window as any).MainWindowBrowserManager;

  const isCheckoutPage = (u: string) =>
    !!u && (u.indexOf('/checkout/') !== -1 || u.indexOf('/addfreelicense') !== -1);

  const usable = prevUrl && !isCheckoutPage(prevUrl) ? prevUrl : '';

  if (usable) {
    log(`navigateBack -> ${usable}`);
    let ok = false;
    try { mgr?.LoadURL?.(usable); ok = true; } catch (e) { log(`LoadURL failed: ${String(e)}`); }
    if (!ok) {
      try { mgr?.m_browser?.LoadURL?.(usable); ok = true; } catch (e) { log(`m_browser.LoadURL failed: ${String(e)}`); }
    }
    if (ok) return;
  }

  log('navigateBack -> fallback steam://nav/library');
  try { sc?.URL?.ExecuteSteamURL?.('steam://nav/library'); return; } catch (e) { log(`ExecuteSteamURL nav failed: ${String(e)}`); }
  try { sc?.URL?.ExecuteSteamURL?.('steam://open/library'); return; } catch (e) { log(`ExecuteSteamURL open failed: ${String(e)}`); }
  try { mgr?.LoadURL?.('steam://nav/library'); return; } catch (e) { log(`mgr.LoadURL nav failed: ${String(e)}`); }
}

async function addViaShowStore(appid: number): Promise<boolean> {
  const sc = (window as any).SteamClient;

  const prevUrl = getCurrentStoreUrl();
  if (prevUrl) log(`[${appid}] saved prevUrl: ${prevUrl}`);

  try { await setPendingClaim({ payload: String(appid) }); } catch {}

  let opened = false;
  const SHOWSTORE_ATTEMPTS = 3;
  for (let attempt = 0; attempt < SHOWSTORE_ATTEMPTS && !opened; attempt++) {
    try {
      sc.Apps.ShowStore(appid, 0);
      opened = true;
      log(`[${appid}] ShowStore opened (attempt ${attempt + 1})`);
    } catch (e) {
      log(`[${appid}] ShowStore attempt ${attempt + 1} failed: ${String(e)}`);
      const backoff = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  if (!opened) {
    try { await setPendingClaim({ payload: '' }); } catch {}
    return false;
  }

  const SHOWSTORE_TIMEOUT_S = 25;
  const POLL_MS = 500;
  const polls = Math.floor((SHOWSTORE_TIMEOUT_S * 1000) / POLL_MS);
  for (let i = 0; i < polls; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (isAlreadyInLibrary(appid)) {
      log(`[${appid}] detected in library after ${(i + 1) * POLL_MS / 1000}s`);
      await new Promise((r) => setTimeout(r, 1500));
      navigateBack(prevUrl);
      return true;
    }
  }
  log(`[${appid}] ShowStore fallback timed out after ${SHOWSTORE_TIMEOUT_S}s`);
  navigateBack(prevUrl);
  return false;
}

async function addGameToLibrary(appid: number): Promise<boolean> {
  if (isAlreadyInLibrary(appid)) return true;

  const acquired = await tryAcquireClaimLock({ payload: String(appid) }).catch(() => 0);
  if (!acquired) {
    log(`[${appid}] claim lock busy — another process is claiming, skipping`);
    return false;
  }

  try {
    return await _addGameToLibraryLocked(appid);
  } finally {
    await releaseClaimLock({ payload: String(appid) }).catch(() => {});
  }
}

interface QueueClaimResult { state: 'ok' | 'fail' | 'timeout'; reason: string }

const QUEUE_POLL_MS      = 500;
const QUEUE_TIMEOUT_MS   = 8000;

async function tryClaimViaQueue(appid: number): Promise<QueueClaimResult> {
  try {
    await enqueueClaimJob({ payload: String(appid) });
  } catch (e) {
    return { state: 'timeout', reason: 'enqueue failed: ' + String(e) };
  }

  const deadline = Date.now() + QUEUE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, QUEUE_POLL_MS));
    let raw = '';
    try { raw = await readClaimJob({ payload: String(appid) }); } catch { continue; }
    if (!raw || raw === '{}') continue;
    try {
      const data = JSON.parse(raw);
      if (data && (data.state === 'ok' || data.state === 'fail')) {
        return { state: data.state, reason: String(data.reason || '') };
      }
    } catch {}
  }
  return { state: 'timeout', reason: 'no widget response' };
}

async function _addGameToLibraryLocked(appid: number): Promise<boolean> {
  const queueRes = await tryClaimViaQueue(appid);

  if (queueRes.state === 'ok') {
    log(`[${appid}] silent claim ok via widget queue`);
    return true;
  }

  if (queueRes.state === 'fail') {
    const r = (queueRes.reason || '').toLowerCase();
    const cookieIssue =
      r.indexOf('no cookies')      !== -1 ||
      r.indexOf('no sessionid')    !== -1 ||
      r.indexOf('session expired') !== -1;

    if (!cookieIssue) {
      log(`[${appid}] silent claim refused: ${queueRes.reason}`);
      return false;
    }
    log(`[${appid}] widget session expired — falling back to store flow`);
  } else {
    log(`[${appid}] no widget reachable (timeout) — falling back to store flow`);
  }

  if (await addViaShowStore(appid)) return true;

  try {
    const result = await withTimeout(
      claimFreeGameLua({ payload: String(appid) }),
      8000,
      '0|timeout',
    );
    const [status, reason] = (result || '0|').split('|');
    if (status === '1') {
      log(`[${appid}] silent claim ok via lua after store refresh`);
      return true;
    }
    log(`[${appid}] lua retry after store refresh failed: ${reason}`);
  } catch (e) {
    log(`[${appid}] lua retry exception: ${String(e)}`);
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
      try { s = normalizeSettings({ ...DEFAULTS, ...JSON.parse(sRaw || '{}') }); } catch {}
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
    const bootTimer = setTimeout(() => { void boot(); }, 500);
    return () => clearTimeout(bootTimer);
  }, []);

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
      widget,
      onWidget: updateWidget,
    }),
  );
};

const SCAN_NAME_BLOCKLIST: RegExp[] = [
  /\bskin pack\b/,
  /\bdlc\b/,
  /\bsoundtrack\b/,
  /\bost\b/,
  /\bweapon skin\b/,
  /\bcharacter skin\b/,
];

async function waitForSteamReady(): Promise<void> {
  await Promise.race([
    new Promise<void>((resolve) => {
      const check = () => {
        if ((window as any).appStore) resolve();
        else setTimeout(check, 1000);
      };
      check();
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 30000)),
  ]);
  await new Promise((r) => setTimeout(r, 3000));
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
  if (_autoclaimPollingStarted) {
    log('startPolling re-entered — clearing previous timers');
    _clearAutoclaimTimers();
  }
  _autoclaimPollingStarted = true;

  await waitForSteamReady();

  _trackInterval(() => { void drainPendingToasts(); }, 5000);

  let settings: Settings = { ...DEFAULTS };
  let grabbedSet = new Set<number>();
  const skipLogged = new Set<number>();

  async function reloadState(): Promise<void> {
    const [sRaw, gRaw] = await Promise.all([
      withTimeout(loadSettings(), 3000, '{}'),
      withTimeout(loadGrabbed(),  3000, '[]'),
    ]);
    try { settings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(sRaw || '{}') }); } catch {}
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
    return SCAN_NAME_BLOCKLIST.some((re) => re.test(lower));
  }

  async function processGame(game: FreeGame): Promise<void> {
    try {
      if (grabbedSet.has(game.appid)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already grabbed, skipping`);
        }
        return;
      }

      if (isAlreadyInLibrary(game.appid)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already in library, skipping`);
        }
        grabbedSet.add(game.appid);
        return;
      }

      if (!isAutoClaimable(game)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — skipping (type=${game.type}, not a game)`);
        }
        return;
      }

      if (shouldSkipByName(game.name)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — skipping (DLC/pack detected by name)`);
        }
        grabbedSet.add(game.appid);
        return;
      }

      log(`Free game detected: ${game.name} (${game.appid})`);

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

  async function runOneScan(): Promise<boolean> {
    await reloadState();
    log('Scanning Steam Store for 100% discounts...');

    try {
      const raw = await withTimeout(fetchFreeGames(), 60000, '[]');
      const games: FreeGame[] = JSON.parse(raw || '[]');
      log(`Scan complete — ${games.length} free game(s) found`);

      for (const game of games) {
        await processGame(game);
        await new Promise((r) => setTimeout(r, 1500));
      }
      return true;
    } catch (e) {
      log(`Scan error: ${String(e)}`);
      return false;
    }
  }

  let scanInProgress = false;
  let scanQueued = false;
  const triggerScan = async (reason: string): Promise<boolean> => {
    if (scanInProgress) {
      scanQueued = true;
      log(`Scan queued (${reason}) — another scan is in progress`);
      return false;
    }
    scanInProgress = true;
    scanQueued = false;
    try {
      log(`Manual scan triggered: ${reason}`);
      const result = await runOneScan();
      if (scanQueued) {
        scanQueued = false;
        scanInProgress = false;
        return triggerScan('queued');
      }
      return result;
    } finally {
      scanInProgress = false;
      scanQueued = false;
    }
  };

  let lastScanSeq = 0;
  try {
    lastScanSeq = parseInt(await withTimeout(popScanRequest(), 2000, '0'), 10) || 0;
  } catch { lastScanSeq = 0; }

  await triggerScan('initial');

  _trackInterval(async () => {
    try {
      const raw = await withTimeout(popScanRequest(), 2000, String(lastScanSeq));
      const cur = parseInt(raw, 10) || 0;
      if (cur < lastScanSeq) {
        lastScanSeq = cur;
        return;
      }
      if (cur > lastScanSeq) {
        lastScanSeq = cur;
        void triggerScan('user requested');
      }
    } catch {}
  }, 3000);

  _trackInterval(async () => {
    try {
      const sRaw = await withTimeout(loadSettings(), 3000, '{}');
      settings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(sRaw || '{}') });
    } catch {}
  }, 30000);

  const scheduleNext = (retryDelay?: number) => {
    const interval = retryDelay ?? (settings.pollIntervalMin || 30) * 60 * 1000;
    if (retryDelay) {
      log(`Scan failed — retrying in ${Math.round(interval / 1000)}s`);
    } else {
      log(`Next scan in ${settings.pollIntervalMin} min`);
    }
    if (_autoclaimNextScanTimer) clearTimeout(_autoclaimNextScanTimer);
    _autoclaimNextScanTimer = setTimeout(async () => {
      _autoclaimNextScanTimer = null;
      const ok = await triggerScan(retryDelay ? 'retry after failure' : 'scheduled');
      if (!ok) {
        const next = Math.min((retryDelay ?? 60000) * 2.5, (settings.pollIntervalMin || 30) * 60 * 1000);
        scheduleNext(next);
      } else {
        scheduleNext();
      }
    }, interval);
  };
  scheduleNext();

  window.addEventListener('beforeunload', _clearAutoclaimTimers, { once: true });
}

export default definePlugin(() => {
  void startPolling();
  return {
    title: 'Auto Claim',
    icon:  React.createElement('span', { style: { display: 'none' } }),
    content: React.createElement(SettingsPanel),
  };
});
