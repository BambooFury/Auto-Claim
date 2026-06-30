import { definePlugin, callable, toaster } from '@steambrew/client';
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsTab, WidgetSettings } from './settings';
import { MIN_POLL_INTERVAL_MIN } from './constants';
import { runScan } from './scanner';
import { scanFreeWeekend, WeekendGame } from './scanner/freeweekend';
type Empty = [];
type StrIn = [{ payload: string }];

const loadGrabbed       = callable<Empty, string>('load_grabbed_ipc');
const saveGrabbed       = callable<StrIn, number>('save_grabbed_ipc');
const loadSettings      = callable<Empty, string>('load_settings_ipc');
const _logPluginIPC     = callable<StrIn, number>('log_plugin');
const saveFreeGamesCache = callable<StrIn, number>('save_free_games_cache_ipc');
const loadFreeGamesCache = callable<Empty, string>('load_free_games_cache_ipc');
const saveFreeWeekendCache = callable<StrIn, number>('save_free_weekend_cache_ipc');
const loadFreeWeekendCache = callable<Empty, string>('load_free_weekend_cache_ipc');
const loadLastDailyScan  = callable<Empty, string>('load_last_daily_scan_ipc');
const saveLastDailyScan  = callable<StrIn, number>('save_last_daily_scan_ipc');
const _loadWidgetIPC    = callable<Empty, string>('load_widget_settings_ipc');
const _saveWidgetIPC    = callable<StrIn, number>('save_widget_settings_ipc');
const popToasts         = callable<Empty, string>('pop_toasts_ipc');
const tryAcquireClaimLock = callable<StrIn, number>('try_acquire_claim_lock_ipc');
const releaseClaimLock    = callable<StrIn, number>('release_claim_lock_ipc');
const setCurrentSteamId   = callable<StrIn, number>('set_current_steamid_ipc');

const _globalGrabbedAppids = new Set<number>();

async function _reloadGlobalGrabbed(): Promise<void> {
  try {
    const raw = await loadGrabbed();
    const list: Array<{ appid: number }> = JSON.parse(raw || '[]');
    for (const e of list) {
      if (e && typeof e.appid === 'number') _globalGrabbedAppids.add(e.appid);
    }
  } catch {}
}

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

const DEBUG_LOG = false;
const dlog = (msg: string) => {
  if (DEBUG_LOG) log(msg);
};


function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

interface FreeGame {
  appid:   number;
  name:    string;
  type?:   string;
  header?: string;
  capsule?: string;
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

const DEFAULTS: Settings = {
  autoAdd:         false,
  pollIntervalMin: 30,
  notifyOnGrab:    true,
};

const DAILY_MODE_MIN = 1440;

function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

const HEADER_URL = (g: FreeGame) =>
  g.header || g.capsule || `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`;

function isAlreadyInLibrary(appid: number): boolean {
  try {
    const store = (window as any).appStore;
    const ov = store?.GetAppOverviewByAppID?.(appid);
    if (!ov) return false;


    if (ov.installed === true) return true;
    const lpcd = ov.local_per_client_data;
    if (lpcd) {
      if (lpcd.is_owned === true)  return true;
      if (lpcd.installed === true) return true;
    }


    if (Array.isArray(ov.licenses) && ov.licenses.length > 0) return true;

    return false;
  } catch {
    return false;
  }
}


function showFreeGameNotification(game: FreeGame, onClick: () => void, claimed = false): void {
  if (_globalGrabbedAppids.has(game.appid)) return;
  if (!claimed && isAlreadyInLibrary(game.appid)) return;
  _globalGrabbedAppids.add(game.appid);
  toaster.toast({
    title: claimed ? 'Free Game Claimed!' : 'Free Game Available!',
    body:  claimed
      ? `${game.name} was added to your library.`
      : `${game.name} is 100% off — grab it now!`,
    logo: React.createElement('img', {
      src: HEADER_URL(game),
      style: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
    }),
    onClick,
    duration:  12000,
    sound:     1,
    playSound: true,
    showToast: true,
  });
}

async function addViaHiddenPopup(appid: number): Promise<boolean> {
  const sc = (window as any).SteamClient;
  const bv = sc?.BrowserView;
  if (!bv || typeof bv.CreatePopup !== 'function') {
    log(`[${appid}] hidden-popup: SteamClient.BrowserView.CreatePopup unavailable`);
    return false;
  }

  let popupResult: { strCreateURL: string; browserView: any } | null = null;
  try {
    popupResult = bv.CreatePopup({
      strInitialURL: `https://store.steampowered.com/app/${appid}/?cc=us&l=english`,
      bOnlyAllowTrustedPopups: false,
    });
  } catch (e) {
    log(`[${appid}] hidden-popup: CreatePopup threw: ${String(e)}`);
    return false;
  }

  if (!popupResult || !popupResult.browserView) {
    log(`[${appid}] hidden-popup: CreatePopup returned no browserView`);
    return false;
  }

  const { strCreateURL, browserView: popup } = popupResult;

  let popupWindow: Window | null = null;
  try {
    popupWindow = window.open(
      strCreateURL,
      `fgg-claim-${appid}`,
      'width=1,height=1,left=-32000,top=-32000,toolbar=0,menubar=0,location=0,status=0,scrollbars=0,resizable=0',
    );
  } catch {}

  try { popup.SetBounds(-32000, -32000, 400, 300); } catch {}
  try { popup.SetFocus(false); } catch {}

  let claimTriggered = false;
  let succeeded = false;

  const triggerClaim = () => {
    if (claimTriggered) return;
    claimTriggered = true;
    try {
      const js =
        `(function() {` +
        `  try {` +
        `    var sub = null;` +
        `    var freeForm = null;` +
        `    var forms = document.querySelectorAll('form');` +
        `    for (var f = 0; f < forms.length; f++) {` +
        `      var act = forms[f].getAttribute('action') || '';` +
        `      if (act.indexOf('freelicense/addfreelicense') !== -1) {` +
        `        var inp = forms[f].querySelector('input[name="subid"]');` +
        `        if (inp && inp.value) { freeForm = forms[f]; sub = parseInt(inp.value, 10); break; }` +
        `      }` +
        `    }` +
        `    var html = document.documentElement.outerHTML || '';` +
        `    if (!sub) {` +
        `      var pats = [` +
        `        /data-ds-add-free-sub="(\\d+)"/,` +
        `        /data-add-free-sub="(\\d+)"/,` +
        `        /javascript:AddFreeLicense\\(\\s*(\\d+)\\s*\\)/,` +
        `        /\\bAddFreeLicense\\(\\s*(\\d+)\\s*\\)/,` +
        `      ];` +
        `      for (var i = 0; i < pats.length && !sub; i++) {` +
        `        var m = html.match(pats[i]);` +
        `        if (m) sub = parseInt(m[1], 10);` +
        `      }` +
        `    }` +
        `    if (!sub) { document.title = 'fgg:no_subid'; return; }` +
        `    if (freeForm && typeof addToCart !== 'function' && typeof AddFreeLicense !== 'function') {` +
        `      freeForm.submit();` +
        `      document.title = 'fgg:form_submitted:' + sub;` +
        `      return;` +
        `    }` +
        `    if (typeof AddFreeLicense === 'function') {` +
        `      AddFreeLicense(sub);` +
        `      document.title = 'fgg:addfreelicense_called:' + sub;` +
        `    } else if (typeof addToCart === 'function') {` +
        `      addToCart(sub);` +
        `      document.title = 'fgg:addtocart_called:' + sub;` +
        `    } else if (window.ShoppingCart && window.ShoppingCart.AddSubsToCart) {` +
        `      window.ShoppingCart.AddSubsToCart([sub]);` +
        `      document.title = 'fgg:shoppingcart_called:' + sub;` +
        `    } else {` +
        `      document.title = 'fgg:no_claim_global';` +
        `    }` +
        `  } catch (e) {` +
        `    document.title = 'fgg:exception:' + (e && e.message ? e.message : String(e));` +
        `  }` +
        `})(); void 0;`;
      popup.LoadURL(`javascript:${js}`);
    } catch (e) {
      log(`[${appid}] hidden-popup: addToCart trigger threw: ${String(e)}`);
    }
  };

  const onFinishedRequest = (currentURL: string) => {
    if (currentURL && currentURL.indexOf(`/app/${appid}`) !== -1) {
      setTimeout(triggerClaim, 800);
    }
  };
  try { popup.on?.('finished-request', onFinishedRequest); } catch {}

  setTimeout(() => {
    try {
      if (typeof popup.LoadURL === 'function') {
        popup.LoadURL(`https://store.steampowered.com/app/${appid}/?cc=us&l=english`);
      }
    } catch {}
  }, 500);

  const TIMEOUT_MS = 10_000;
  const POLL_MS    = 500;
  const polls      = Math.floor(TIMEOUT_MS / POLL_MS);
  for (let i = 0; i < polls; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (isAlreadyInLibrary(appid)) {
      succeeded = true;
      break;
    }
  }

    if (!succeeded) {
    if (claimTriggered) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (isAlreadyInLibrary(appid)) { succeeded = true; break; }
      }
      if (!succeeded) {
        dlog(`[${appid}] hidden-popup: claim triggered but ownership not confirmed — will retry next scan`);
      }
    } else {
      dlog(`[${appid}] hidden-popup: timed out after ${TIMEOUT_MS / 1000}s`);
    }
  }

  try { popup.off?.('finished-request', onFinishedRequest); } catch {}

  try {
    if (popupWindow && !popupWindow.closed) popupWindow.close();
  } catch {}
  try {
    if (typeof bv.Destroy === 'function') bv.Destroy(popup);
  } catch {}

  return succeeded;
}

async function addGameToLibrary(appid: number): Promise<boolean> {
  if (isAlreadyInLibrary(appid)) return true;

  const acquired = await tryAcquireClaimLock({ payload: String(appid) }).catch(() => 0);
  if (!acquired) {
    dlog(`[${appid}] claim lock busy — another process is claiming, skipping`);
    return false;
  }

  try {
    if (await addViaHiddenPopup(appid)) return true;
    dlog(`[${appid}] hidden popup claim failed — leaving game unclaimed (will retry next scan)`);
    return false;
  } finally {
    await releaseClaimLock({ payload: String(appid) }).catch(() => {});
  }
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

      setLoaded(true);
    };
    const bootTimer = setTimeout(() => { void boot(); }, 500);
    return () => clearTimeout(bootTimer);
  }, []);

  const updateWidget = useCallback((patch: Partial<WidgetSettings>) => {
    setWidget((prev) => {
      const next = { ...prev, ...patch };
      _saveWidgetIPC({ payload: JSON.stringify(next) });
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


async function startPolling(): Promise<void> {
  if (_autoclaimPollingStarted) {
    log('startPolling re-entered — clearing previous timers');
    _clearAutoclaimTimers();
  }
  _autoclaimPollingStarted = true;

  await waitForSteamReady();

  await _reloadGlobalGrabbed();

  _trackInterval(() => { void drainPendingToastsFiltered(); }, 5000);

  let settings: Settings = { ...DEFAULTS };
  let grabbedSet  = new Set<number>();
  let notifiedSet = new Set<number>();
  const skipLogged = new Set<number>();
  const failLogged = new Set<number>();
  let lastScanSummary = '';
  let lastWeekendSummary = '';

  async function reloadState(): Promise<void> {
    const [sRaw, gRaw] = await Promise.all([
      withTimeout(loadSettings(), 3000, '{}'),
      withTimeout(loadGrabbed(),  3000, '[]'),
    ]);
    try { settings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(sRaw || '{}') }); } catch {}
    try {
      const list: GrabbedEntry[] = JSON.parse(gRaw || '[]');
      grabbedSet  = new Set(list.filter((e) => e.added !== false).map((e) => e.appid));
      notifiedSet = new Set(list.map((e) => e.appid));
    } catch {}
  }

  async function drainPendingToastsFiltered(): Promise<void> {
    try {
      const raw = await withTimeout(popToasts(), 3000, '[]');
      const items: FreeGame[] = JSON.parse(raw || '[]');
      for (const g of items) {
        if (!g || typeof g.appid !== 'number') continue;
        if (grabbedSet.has(g.appid) || notifiedSet.has(g.appid)) continue;
        showFreeGameNotification(g, () => {
          (window as any).SteamClient?.Apps?.ShowStore?.(g.appid, 0);
        }, true);
      }
    } catch {}
  }

  async function recordGrabbed(game: FreeGame, added: boolean): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const sidAtStart = knownSid;
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

        if (knownSid !== sidAtStart) throw new Error('account changed during grabbed.json update');
        const saved = await withTimeout(saveGrabbed({ payload: JSON.stringify(arr) }), 3000, 0);
        if (!saved) throw new Error('save_grabbed_ipc returned 0');
        if (added) grabbedSet.add(game.appid);
        notifiedSet.add(game.appid);
        _globalGrabbedAppids.add(game.appid);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (added) grabbedSet.add(game.appid);
    notifiedSet.add(game.appid);
  }

  function shouldSkipByName(name: string): boolean {
    const lower = name.toLowerCase();
    return SCAN_NAME_BLOCKLIST.some((re) => re.test(lower));
  }

  let cachedWidgetFilterMode: 'games' | 'all' = 'games';

  async function refreshWidgetFilterMode(): Promise<void> {
    try {
      const wRaw = await withTimeout(_loadWidgetIPC(), 1000, '');
      if (wRaw) {
        const w = JSON.parse(wRaw);
          if (w && (w.filterMode === 'all' || w.filterMode === 'games' || w.filterMode === 'weekend')) {
          cachedWidgetFilterMode = w.filterMode;
          return;
        }
      }
      cachedWidgetFilterMode = 'games';
    } catch {
      cachedWidgetFilterMode = 'games';
    }
  }

  let lastManualScanRequestAt = 0;

  async function consumeManualScanRequest(): Promise<number> {
    try {
      const wRaw = await withTimeout(_loadWidgetIPC(), 1500, '{}');
      const w = JSON.parse(wRaw || '{}');
      const requestedAt = typeof w?.manualScanRequestedAt === 'number' ? w.manualScanRequestedAt : 0;
      if (!requestedAt || requestedAt <= lastManualScanRequestAt) return 0;
      lastManualScanRequestAt = requestedAt;

      const next = { ...w };
      delete next.manualScanRequestedAt;
      try {
        await withTimeout(_saveWidgetIPC({ payload: JSON.stringify(next) }), 1500, 0);
      } catch {}
      return requestedAt;
    } catch {
      return 0;
    }
  }

  async function publishManualScanCompletion(requestedAt: number, ok: boolean): Promise<void> {
    if (!requestedAt) return;
    try {
      const wRaw = await withTimeout(_loadWidgetIPC(), 1500, '{}');
      const w = JSON.parse(wRaw || '{}');
      const next = {
        ...w,
        manualScanCompletedAt: Date.now(),
        manualScanCompletedRequestAt: requestedAt,
        manualScanCompletedOk: ok,
      };
      await withTimeout(_saveWidgetIPC({ payload: JSON.stringify(next) }), 1500, 0);
    } catch {}
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

      if (notifiedSet.has(game.appid) && isAlreadyInLibrary(game.appid)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already notified & in library, upgrading to grabbed`);
        }
        grabbedSet.add(game.appid);
        await recordGrabbed(game, true);
        return;
      }

      if (isAlreadyInLibrary(game.appid)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already in library, skipping`);
        }
        grabbedSet.add(game.appid);
        void recordGrabbed(game, true);
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

      dlog(`Free game detected: ${game.name} (${game.appid})`);


      let liveSettings: Settings = settings;
      try {
        const raw = await withTimeout(loadSettings(), 1000, '');
        if (raw) liveSettings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {}

      const notifyOnly = cachedWidgetFilterMode === 'all' || !liveSettings.autoAdd;

      if (notifyOnly) {
        if (notifiedSet.has(game.appid)) {
          if (!skipLogged.has(game.appid)) {
            skipLogged.add(game.appid);
            log(`${game.name} — already notified, skipping (manual-claim mode)`);
          }
          return;
        }

        const reason = cachedWidgetFilterMode === 'all' ? "filter='all'" : 'auto-add OFF';
        log(`${game.name} — ${reason}, showing notification only`);
        showFreeGameNotification(game, async () => {
          const added = await addGameToLibrary(game.appid);
          await recordGrabbed(game, added);
          log(`${game.name} — grabbed via click (${added ? 'added' : 'failed'})`);
        });
        await recordGrabbed(game, false);
        return;
      }

      const added = await addGameToLibrary(game.appid);
      if (added) {
        await recordGrabbed(game, true);
        if (liveSettings.notifyOnGrab) {
          showFreeGameNotification(game, () => {
            (window as any).SteamClient?.Apps?.ShowStore?.(game.appid, 0);
          });
        }
        failLogged.delete(game.appid);
        log(`${game.name} — successfully added to library`);
      } else {
        await recordGrabbed(game, false);
        if (!failLogged.has(game.appid)) {
          failLogged.add(game.appid);
          log(`${game.name} — claim not confirmed yet, will keep retrying in background`);
        } else {
          dlog(`${game.name} — failed to add, will retry next scan`);
        }
      }
    } catch (e) {
      log(`processGame error for ${game.name}: ${String(e)}`);
    }
  }
  
  function showWeekendNotification(game: WeekendGame): void {
    const untilStr = new Date(game.until * 1000)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    toaster.toast({
      title: 'Free Weekend!',
      body:  `${game.name} is free to play until ${untilStr}.`,
      logo: React.createElement('img', {
        src: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
        style: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
      }),
      onClick: () => { (window as any).SteamClient?.Apps?.ShowStore?.(game.appid, 0); },
      duration:  12000,
      sound:     1,
      playSound: true,
      showToast: true,
    });
  }

  async function runWeekendScan(): Promise<void> {
    try {
      const result = await scanFreeWeekend({ info: (m) => log(m), warn: (m) => log(m) });
      if (!result) {
        log('Weekend scan failed — keeping previous list');
        return;
      }

      let prev: WeekendGame[] = [];
      try {
        prev = JSON.parse(await withTimeout(loadFreeWeekendCache(), 3000, '[]') || '[]');
      } catch {}
      const prevIds = new Set(prev.map((g) => g.appid));

      const nowSec = Date.now() / 1000;
      const merged = [...result];
      for (const p of prev) {
        if (p.until > nowSec && !merged.some((g) => g.appid === p.appid)) merged.push(p);
      }

      try {
        await withTimeout(saveFreeWeekendCache({ payload: JSON.stringify(merged) }), 3000, 0);
      } catch {}
      const weekendSummary = `Weekend scan complete — ${merged.length} game(s) playable for free`;
      if (weekendSummary !== lastWeekendSummary) {
        lastWeekendSummary = weekendSummary;
        log(weekendSummary);
      } else {
        dlog(weekendSummary);
      }
      
      let notify = true;
      try {
        const sraw = await withTimeout(loadSettings(), 2000, '');
        if (sraw) notify = ({ ...DEFAULTS, ...JSON.parse(sraw) } as Settings).notifyOnGrab;
      } catch {}
      if (!notify) return;
      
      for (const g of result) {
        if (prevIds.has(g.appid)) continue;
        if (isAlreadyInLibrary(g.appid)) continue;
        log(`Free weekend detected: ${g.name} (${g.appid})`);
        showWeekendNotification(g);
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      log(`runWeekendScan error: ${String(e)}`);
    }
  }

  async function runOneScan(): Promise<boolean> {
    await reloadState();
    await refreshWidgetFilterMode();
    dlog('Scanning Steam Store for 100% discounts...');

    try {
      const scannerLog = {
        info: (m: string) => dlog(m),
        warn: (m: string) => log(m),
      };
      const result = await withTimeout(
        runScan(scannerLog),
        120000,
        { games: [] as FreeGame[], anyOk: false } as { games: FreeGame[]; anyOk: boolean },
      );

      if (!result.anyOk) {
        log('Scan: Steam search unreachable, keeping cached results');
        try {
          const cached = await withTimeout(loadFreeGamesCache(), 3000, '[]');
          const games: FreeGame[] = JSON.parse(cached || '[]');
          log(`Using cache — ${games.length} game(s)`);
          for (const game of games) {
            await processGame(game);
            await new Promise((r) => setTimeout(r, 1500));
          }
        } catch {}
        return false;
      }

      const games: FreeGame[] = result.games;
      const summary = `Scan complete — ${games.length} free game(s) found`;
      if (summary !== lastScanSummary) {
        lastScanSummary = summary;
        log(summary);
      } else {
        dlog(summary);
      }

      try {
        await withTimeout(
          saveFreeGamesCache({ payload: JSON.stringify(games) }),
          3000,
          0,
        );
      } catch {}

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
  let pendingManualScanRequestAt = 0;
    const triggerScan = async (reason: string): Promise<boolean> => {
    if (scanInProgress) {
      scanQueued = true;
      dlog(`Scan queued (${reason}) — another scan is in progress`);
      return false;
    }
    scanInProgress = true;
    scanQueued = false;
    let result = false;
    try {
      dlog(`Manual scan triggered: ${reason}`);
      result = await runOneScan();
      if (pendingManualScanRequestAt && (reason === 'manual button' || reason === 'queued')) {
        const requestedAt = pendingManualScanRequestAt;
        pendingManualScanRequestAt = 0;
        await publishManualScanCompletion(requestedAt, result);
      }
    } finally {
      scanInProgress = false;
    }
    if (scanQueued) {
      scanQueued = false;
      return triggerScan('queued');
    }
    return result;
  };


  const STEAM_ID_BASE = '76561197960265728';
  let knownSid = '';
  try {
    (window as any).SteamClient?.User?.RegisterForCurrentUserChanges?.((user: any) => {
      const sid = String(user?.strSteamID || '');
      if (!sid || sid === knownSid) return;
      if (sid === STEAM_ID_BASE) {
        log('ignoring phantom user change (accountID=0, Steam not logged in yet)');
        return;
      }
      const isFirstRealLogin = knownSid === '';
      knownSid = sid;
      log(`Steam account: ${sid}`);
      void setCurrentSteamId({ payload: sid })
        .catch((e) => log(`set_current_steamid_ipc failed: ${String(e)}`))
        .then(() => {
          skipLogged.clear();
          failLogged.clear();
          grabbedSet = new Set<number>();
          notifiedSet = new Set<number>();
          if (scanInProgress) {

            dlog('queueing re-scan for new account (scan in progress)');
            scanQueued = true;
          } else {
            const reason = isFirstRealLogin ? 'post-login' : 'account-change';
            log(`triggering ${reason} scan for ${sid}`);
            void triggerScan(reason);
          }
        });
    });
  } catch (e) {
    log(`RegisterForCurrentUserChanges unavailable: ${String(e)}`);
  }

  let startupSettings: Settings = { ...DEFAULTS };
  try {
    const sRaw = await withTimeout(loadSettings(), 3000, '{}');
    startupSettings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(sRaw || '{}') });
    settings = startupSettings;
  } catch {}
  const isDailyMode = startupSettings.pollIntervalMin >= DAILY_MODE_MIN;

  let skipStartupScan = false;
  if (isDailyMode) {
    try {
      const raw = await withTimeout(loadLastDailyScan(), 3000, '{}');
      const data = JSON.parse(raw || '{}');
      if (typeof data.date === 'string' && data.date === todayStr()) {
        skipStartupScan = true;
        log(`Once-a-day mode — already scanned today (${data.date}), skipping startup scan`);
      }
    } catch {}
  }

  if (!skipStartupScan) {
    const ok = await triggerScan('initial');
    if (isDailyMode && ok) {
      try {
        await withTimeout(
          saveLastDailyScan({ payload: JSON.stringify({ date: todayStr() }) }),
          3000, 0,
        );
        log(`Once-a-day mode — startup scan complete, recorded ${todayStr()}`);
      } catch {}
    }
  }
  const WEEKEND_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
  let lastWeekendScanMs = Date.now();
  void runWeekendScan();
  _trackInterval(() => {
    if (Date.now() - lastWeekendScanMs >= WEEKEND_SCAN_INTERVAL_MS) {
      lastWeekendScanMs = Date.now();
      void runWeekendScan();
    }
  }, 10 * 60 * 1000);

  const pollManualScanRequest = async () => {
    const manualRequestedAt = await consumeManualScanRequest();
    if (manualRequestedAt) {
      pendingManualScanRequestAt = manualRequestedAt;
      void triggerScan('manual button');
    }
  };

  void pollManualScanRequest();
  _trackInterval(() => { void pollManualScanRequest(); }, 3000);

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
      dlog(`Next scan in ${settings.pollIntervalMin} min`);
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
  if (isDailyMode) {
    log('Once-a-day mode — no recurring scan scheduled (next scan on next Steam start)');
  } else {
    scheduleNext();
  }

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
