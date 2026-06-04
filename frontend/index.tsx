import { definePlugin, callable, toaster } from '@steambrew/client';
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsTab, WidgetSettings } from './settings';
import { MIN_POLL_INTERVAL_MIN } from './constants';
import { runScan } from './scanner';
type Empty = [];
type StrIn = [{ payload: string }];

const loadGrabbed       = callable<Empty, string>('load_grabbed_ipc');
const saveGrabbed       = callable<StrIn, number>('save_grabbed_ipc');
const loadSettings      = callable<Empty, string>('load_settings_ipc');
const _logPluginIPC     = callable<StrIn, number>('log_plugin');
const saveFreeGamesCache = callable<StrIn, number>('save_free_games_cache_ipc');
const loadFreeGamesCache = callable<Empty, string>('load_free_games_cache_ipc');
const _loadWidgetIPC    = callable<Empty, string>('load_widget_settings_ipc');
const _saveWidgetIPC    = callable<StrIn, number>('save_widget_settings_ipc');
const popToasts         = callable<Empty, string>('pop_toasts_ipc');
const tryAcquireClaimLock = callable<StrIn, number>('try_acquire_claim_lock_ipc');
const releaseClaimLock    = callable<StrIn, number>('release_claim_lock_ipc');
const setCurrentSteamId   = callable<StrIn, number>('set_current_steamid_ipc');

const STORE_LS_KEY = 'fgg_store_settings';

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

interface StoreSettingsSnapshot extends Settings, WidgetSettings {}

const DEFAULTS: Settings = {
  autoAdd:         false,
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

function showFreeGameNotification(game: FreeGame, onClick: () => void): void {
  if (_globalGrabbedAppids.has(game.appid)) return;
  if (isAlreadyInLibrary(game.appid)) return;
  _globalGrabbedAppids.add(game.appid);
  toaster.toast({
    title: 'Free Game Available!',
    body:  `${game.name} is 100% off — grab it now!`,
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
    claimTriggered = true;
    try {
      const js =
        `(function() {` +
        `  if (window.__fgg_triggered) return;` +
        `  try {` +
        `    var hasAgeGate = document.getElementById('agegate_box') || document.getElementById('ageYear') || document.querySelector('.agegate_text_container');` +
        `    document.cookie = "birthtime=283993201; path=/; max-age=31536000";` +
        `    document.cookie = "lastagecheckage=1-January-1990; path=/; max-age=31536000";` +
        `    document.cookie = "wants_mature_content=1; path=/; max-age=31536000";` +
        `    if (hasAgeGate) { location.reload(); return; }` +
        `    window.__fgg_triggered = true;` +
        `    var sub = null;` +
        `    var html = document.documentElement.outerHTML || '';` +
        `    var pats = [` +
        `      /javascript:AddFreeLicense\\(\\s*(\\d+)\\s*\\)/,` +
        `      /javascript:addToCart\\(\\s*(\\d+)\\s*\\)/,` +
        `      /\\bAddFreeLicense\\(\\s*(\\d+)\\s*\\)/,` +
        `      /\\baddToCart\\(\\s*(\\d+)\\s*\\)/,` +
        `      /data-ds-add-free-sub="(\\d+)"/,` +
        `      /id="add_to_cart_submit_(\\d+)"/,` +
        `      /name="subid"\\s+value="(\\d+)"/,` +
        `    ];` +
        `    for (var i = 0; i < pats.length && !sub; i++) {` +
        `      var m = html.match(pats[i]);` +
        `      if (m) sub = parseInt(m[1], 10);` +
        `    }` +
        `    if (!sub) { window.location.href = '?fgg_fail=no_subid'; return; }` +
        `    var sess = (window.g_sessionID) || (document.cookie.match(/(?:^|;\\s*)sessionid=([^;]+)/) || [])[1];` +
        `    if (!sess) { window.location.href = '?fgg_fail=no_session'; return; }` +
        `    fetch('https://store.steampowered.com/checkout/addfreelicense', {` +
        `      method: 'POST',` +
        `      headers: {'Content-Type': 'application/x-www-form-urlencoded'},` +
        `      body: 'action=add_to_cart&sessionid=' + sess + '&subid=' + sub` +
        `    }).then(function(r){ return r.text(); }).then(function(t){` +
        `      if (/"success"\\s*:\\s*1\\b/.test(t) || t.indexOf('purchaseresultdetail":9') !== -1 || t.indexOf('purchaseresultdetail":53') !== -1) {` +
        `        window.location.href = '?fgg_success=1';` +
        `      } else {` +
        `        window.location.href = '?fgg_fail=claim_refused';` +
        `      }` +
        `    }).catch(function(e) { window.location.href = '?fgg_fail=exception'; });` +
        `  } catch (e) {` +
        `    window.location.href = '?fgg_fail=outer_exception';` +
        `  }` +
        `})(); void 0;`;
      popup.LoadURL(`javascript:${js}`);
    } catch (e) {
      log(`[${appid}] hidden-popup: addToCart trigger threw: ${String(e)}`);
    }
  };

  const onFinishedRequest = (currentURL: string) => {
    if (!currentURL) return;
    if (currentURL.indexOf('fgg_success=1') !== -1) {
      log(`[${appid}] hidden-popup: detected success via fetch!`);
      succeeded = true;
      return;
    }
    if (currentURL.indexOf('fgg_fail=') !== -1) {
      log(`[${appid}] hidden-popup: fetch claim failed: ${currentURL}`);
      return;
    }
    if (currentURL.indexOf('/checkout/addfreelicense') !== -1 || currentURL.indexOf('cart') !== -1) {
      log(`[${appid}] hidden-popup: detected navigation to ${currentURL}, assuming success!`);
      succeeded = true;
      return;
    }
    if (currentURL.indexOf('/agecheck') !== -1) {
      try {
        if (typeof popup.LoadURL === 'function') {
          popup.LoadURL(`javascript:document.cookie="birthtime=283993201; path=/; max-age=31536000"; document.cookie="lastagecheckage=1-January-1990; path=/; max-age=31536000"; location.reload();`);
        }
      } catch {}
      return;
    }
    if (currentURL.indexOf(`/app/${appid}`) !== -1) {
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

  const TIMEOUT_MS = 15_000;
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
      log(`[${appid}] hidden-popup: claim triggered but verification timed out after ${TIMEOUT_MS / 1000}s`);
    } else {
      log(`[${appid}] hidden-popup: timed out after ${TIMEOUT_MS / 1000}s`);
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
    log(`[${appid}] claim lock busy — another process is claiming, skipping`);
    return false;
  }

  try {
    if (await addViaHiddenPopup(appid)) return true;
    log(`[${appid}] hidden popup claim failed — leaving game unclaimed (will retry next scan)`);
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
        if (isAlreadyInLibrary(g.appid)) continue;
        showFreeGameNotification(g, () => {
          (window as any).SteamClient?.Apps?.ShowStore?.(g.appid, 0);
        });
      }
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


      let liveSettings: Settings = settings;
      try {
        const raw = await withTimeout(loadSettings(), 1000, '');
        if (raw) liveSettings = normalizeSettings({ ...DEFAULTS, ...JSON.parse(raw) });
      } catch {}

      const notifyOnly = !liveSettings.autoAdd;

      if (notifyOnly) {
        if (notifiedSet.has(game.appid)) {
          if (!skipLogged.has(game.appid)) {
            skipLogged.add(game.appid);
            log(`${game.name} — already notified, skipping (manual-claim mode)`);
          }
          return;
        }

        const reason = 'auto-add OFF';
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
        log(`${game.name} — successfully added to library`);
      } else {
        await recordGrabbed(game, false);
        log(`${game.name} — failed to add, will retry next scan`);
      }
    } catch (e) {
      log(`processGame error for ${game.name}: ${String(e)}`);
    }
  }

  async function runOneScan(): Promise<boolean> {
    await reloadState();
    log('Scanning Steam Store for 100% discounts...');

    try {
      const scannerLog = {
        info: (m: string) => log(m),
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
      log(`Scan complete — ${games.length} free game(s) found`);

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
      if (pendingManualScanRequestAt && (reason === 'manual button' || reason === 'queued')) {
        const requestedAt = pendingManualScanRequestAt;
        pendingManualScanRequestAt = 0;
        await publishManualScanCompletion(requestedAt, result);
      }
      return result;
    } finally {
      scanInProgress = false;
      scanQueued = false;
    }
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
          grabbedSet = new Set<number>();
          notifiedSet = new Set<number>();
          if (scanInProgress) {

            log('queueing re-scan for new account (scan in progress)');
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

  await triggerScan('initial');

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
