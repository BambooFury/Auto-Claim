import { ConfirmModal, definePlugin, showModal, toaster } from 'millennium';
import React, { useEffect } from 'react';
import { SettingsTab } from './settings';
import { runScan } from './scanner';
import { scanFreeWeekend, WeekendGame } from './scanner/freeweekend';
import { registerScanTrigger } from './scanControl';
import { registerManager } from './manager';
import { setupToolbar } from './toolbar';
import { clearOwnershipCache } from './ownership';
import {
  FreeGame,
  GrabbedEntry,
  PluginSettings,
  DEFAULT_SETTINGS,
  MIN_POLL_INTERVAL_MIN,
  formatUntil,
  headerImageUrl,
  isClaimableGame,
  normalizeSettings,
} from './config';
import {
  isAlreadyInLibrary,
  isAppOwned,
  checkLibraryOwnership,
  loadFreeGamesCacheIPC,
  loadFreeWeekendCacheIPC,
  loadGrabbedIPC,
  loadLastDailyScanIPC,
  loadSettingsIPC,
  logIPC,
  releaseClaimLockIPC,
  saveFreeGamesCacheIPC,
  saveFreeWeekendCacheIPC,
  saveGrabbedIPC,
  saveLastDailyScanIPC,
  setCurrentSteamIdIPC,
  tryAcquireClaimLockIPC,
} from './ipc';

const loadGrabbed = loadGrabbedIPC;
const saveGrabbed = saveGrabbedIPC;
const loadSettings = loadSettingsIPC;
const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const DEBUG_LOG = false;
const dlog = (msg: string) => { if (DEBUG_LOG) log(msg); };

const _globalGrabbedAppids = new Set<number>();
const _notifiedAvailableAppids = new Set<number>();

async function _reloadGlobalGrabbed(): Promise<void> {
  try {
    const raw = await loadGrabbed();
    const list: GrabbedEntry[] = JSON.parse(raw || '[]');
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

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((res) => setTimeout(() => res(fallback), ms)),
  ]);
}

const DAILY_MODE_MIN = 1440;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

function loadLastScanTs(data: any): number {
  if (data && typeof data.ts === 'number' && data.ts > 0) return data.ts;
  if (data && typeof data.date === 'string') {
    const t = Date.parse(`${data.date}T00:00:00`);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

const WELCOME_FLAG = 'fgg_welcomed_v9';

function buildWelcomeText(): string {
  return [
    'Free Steam games will now land in your library — automatically.',
    '',
    '• Watches the Steam Store for games at 100% off — every 30 min, 120 min, or once a day.',
    '• Claims run fully silently in a hidden off-screen window. No store pages flash open, just a small toast when a game lands in your library.',
    '• Open the Games Manager from the gift button next to the address bar or from the settings panel below.',
    '• Customize everything in this settings panel.',
  ].join('\n');
}

function showWelcomeIfFirstTime(): void {
  try {
    if (localStorage.getItem(WELCOME_FLAG) === '1') return;
    localStorage.setItem(WELCOME_FLAG, '1');
  } catch {
    return;
  }
  showModal(
    <ConfirmModal
      strTitle="Welcome to Auto Claim!"
      strDescription={buildWelcomeText()}
      strOKButtonText="Got it — start grabbing!"
      bAlertDialog
    />,
    window,
  );
}

function showFreeGameNotification(game: FreeGame, onClick: () => void, claimed = false): void {
  if (claimed) {
    if (_globalGrabbedAppids.has(game.appid)) return;
    _globalGrabbedAppids.add(game.appid);
  } else {
    if (_globalGrabbedAppids.has(game.appid)) return;
    if (_notifiedAvailableAppids.has(game.appid)) return;
    if (isAlreadyInLibrary(game.appid)) return;
    _notifiedAvailableAppids.add(game.appid);
  }
  toaster.toast({
    title: claimed ? 'Free Game Claimed!' : 'Free Game Available!',
    body: claimed
      ? `${game.name} was added to your library.`
      : `${game.name} is 100% off — grab it now!`,
    logo: React.createElement('img', {
      src: headerImageUrl(game),
      style: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
    }),
    onClick,
    duration: 12000,
    sound: 1,
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
  const POLL_MS = 500;
  const polls = Math.floor(TIMEOUT_MS / POLL_MS);
  for (let i = 0; i < polls; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (await ownershipConfirmed(appid)) {
      succeeded = true;
      break;
    }
  }

  if (!succeeded) {
    if (claimTriggered) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await ownershipConfirmed(appid)) { succeeded = true; break; }
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

async function ownershipConfirmed(appid: number): Promise<boolean> {
  const owned = await isAppOwned(appid, true);
  if (owned !== null) return owned;
  return isAlreadyInLibrary(appid);
}

async function addGameToLibrary(appid: number): Promise<boolean> {
  const alreadyOwned = await isAppOwned(appid);
  if (alreadyOwned === true || isAlreadyInLibrary(appid)) return true;

  const acquired = await tryAcquireClaimLockIPC({ payload: String(appid) }).catch(() => 0);
  if (!acquired) {
    dlog(`[${appid}] claim lock busy — another process is claiming, skipping`);
    return false;
  }

  try {
    if (await addViaHiddenPopup(appid)) return true;
    dlog(`[${appid}] hidden popup claim failed — leaving game unclaimed (will retry next scan)`);
    return false;
  } finally {
    await releaseClaimLockIPC({ payload: String(appid) }).catch(() => {});
  }
}

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

const SCAN_NAME_BLOCKLIST: RegExp[] = [
  /\bskin pack\b/,
  /\bdlc\b/,
  /\bsoundtrack\b/,
  /\bost\b/,
  /\bweapon skin\b/,
  /\bcharacter skin\b/,
];

async function startPolling(): Promise<void> {
  if (_autoclaimPollingStarted) {
    log('startPolling re-entered — clearing previous timers');
    _clearAutoclaimTimers();
  }
  _autoclaimPollingStarted = true;

  await waitForSteamReady();

  await _reloadGlobalGrabbed();

  let settings: PluginSettings = DEFAULT_SETTINGS;
  const isDailyModeNow = () => settings.pollIntervalMin >= DAILY_MODE_MIN;
  let lastDailyScanTs = 0;
  let grabbedSet = new Set<number>();
  let notifiedSet = new Set<number>();
  const skipLogged = new Set<number>();
  const failLogged = new Set<number>();
  let knownSid = '';
  let lastScanSummary = '';
  let lastWeekendSummary = '';

  async function reloadState(): Promise<void> {
    const [sRaw, gRaw] = await Promise.all([
      withTimeout(loadSettings(), 3000, '{}'),
      withTimeout(loadGrabbed(), 3000, '[]'),
    ]);
    try { settings = normalizeSettings(JSON.parse(sRaw || '{}')); } catch {}
    try {
      const list: GrabbedEntry[] = JSON.parse(gRaw || '[]');
      grabbedSet = new Set(list.filter((e) => e.added !== false).map((e) => e.appid));
      notifiedSet = new Set(list.map((e) => e.appid));
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
          appid: game.appid,
          name: game.name,
          grabbed_at: Math.floor(Date.now() / 1000),
          added,
        };
        if (idx >= 0) arr[idx] = entry;
        else arr.unshift(entry);

        if (knownSid !== sidAtStart) throw new Error('account changed during grabbed.json update');
        const saved = await withTimeout(saveGrabbed({ payload: JSON.stringify(arr) }), 3000, 0);
        if (!saved) throw new Error('save_grabbed_ipc returned 0');
        if (added) grabbedSet.add(game.appid);
        notifiedSet.add(game.appid);
        if (added) _globalGrabbedAppids.add(game.appid);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (added) grabbedSet.add(game.appid);
    notifiedSet.add(game.appid);
  }

  function shouldSkipByName(name: string): boolean {
    return SCAN_NAME_BLOCKLIST.some((re) => re.test(name.toLowerCase()));
  }

  async function processGame(game: FreeGame, apiOwned: Set<number> | null): Promise<void> {
    const ownedNow = (): boolean =>
      (apiOwned !== null ? apiOwned.has(game.appid) : false) || isAlreadyInLibrary(game.appid);

    try {
      if (grabbedSet.has(game.appid)) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already grabbed, skipping`);
        }
        return;
      }

      if (notifiedSet.has(game.appid) && ownedNow()) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already notified & in library, upgrading to grabbed`);
        }
        grabbedSet.add(game.appid);
        await recordGrabbed(game, true);
        return;
      }

      if (ownedNow()) {
        if (!skipLogged.has(game.appid)) {
          skipLogged.add(game.appid);
          log(`${game.name} — already in library, skipping`);
        }
        grabbedSet.add(game.appid);
        void recordGrabbed(game, true);
        return;
      }

      if (!isClaimableGame(game)) {
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

      let liveSettings: PluginSettings = settings;
      try {
        const raw = await withTimeout(loadSettings(), 1000, '');
        if (raw) liveSettings = normalizeSettings(JSON.parse(raw));
      } catch {}

      const notifyOnly = liveSettings.filterMode === 'all' || !liveSettings.autoAdd;

      if (notifyOnly) {
        if (notifiedSet.has(game.appid)) {
          if (!skipLogged.has(game.appid)) {
            skipLogged.add(game.appid);
            log(`${game.name} — already notified, skipping (manual-claim mode)`);
          }
          return;
        }

        const reason = liveSettings.filterMode === 'all' ? "filter='all'" : 'auto-add OFF';
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
    toaster.toast({
      title: 'Free Weekend!',
      body: `${game.name} is free to play until ${formatUntil(game.until)}.`,
      logo: React.createElement('img', {
        src: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
        style: { width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' },
      }),
      onClick: () => { (window as any).SteamClient?.Apps?.ShowStore?.(game.appid, 0); },
      duration: 12000,
      sound: 1,
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
        prev = JSON.parse(await withTimeout(loadFreeWeekendCacheIPC(), 3000, '[]') || '[]');
      } catch {}
      const prevIds = new Set(prev.map((g) => g.appid));

      const nowSec = Date.now() / 1000;
      const merged = [...result];
      for (const p of prev) {
        if (p.until > nowSec && !merged.some((g) => g.appid === p.appid)) merged.push(p);
      }

      try {
        await withTimeout(saveFreeWeekendCacheIPC({ payload: JSON.stringify(merged) }), 3000, 0);
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
        if (sraw) notify = normalizeSettings(JSON.parse(sraw)).notifyOnGrab;
      } catch {}
      if (!notify) return;

      for (const g of result) {
        if (prevIds.has(g.appid)) continue;
        if (isAlreadyInLibrary(g.appid)) continue;
        if (_notifiedAvailableAppids.has(g.appid)) continue;
        if (notifiedSet.has(g.appid) || grabbedSet.has(g.appid)) continue;
        _notifiedAvailableAppids.add(g.appid);
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
          const cached = await withTimeout(loadFreeGamesCacheIPC(), 3000, '[]');
          const games: FreeGame[] = JSON.parse(cached || '[]');
          log(`Using cache — ${games.length} game(s)`);
          const apiOwned = await withTimeout(
            checkLibraryOwnership(games.map((g) => g.appid)),
            15000,
            null,
          );
          for (const game of games) {
            await processGame(game, apiOwned);
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
          saveFreeGamesCacheIPC({ payload: JSON.stringify(games) }),
          3000,
          0,
        );
      } catch {}

      const apiOwned = await withTimeout(
        checkLibraryOwnership(games.map((g) => g.appid)),
        15000,
        null,
      );
      for (const game of games) {
        await processGame(game, apiOwned);
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

  const recordDailyScanIfActive = (ok: boolean): void => {
    if (!isDailyModeNow() || !ok) return;
    lastDailyScanTs = Date.now();
    withTimeout(saveLastDailyScanIPC({ payload: JSON.stringify({ ts: lastDailyScanTs }) }), 3000, 0)
      .then(() => log('Once-a-day mode — scan complete, next scan in 24h'))
      .catch(() => {});
  };

  const shouldSkipDailyScan = (reason: string): boolean => {
    if (!isDailyModeNow()) return false;
    if (reason === 'manual button' || reason === 'queued') return false;
    if (lastDailyScanTs > 0 && Date.now() - lastDailyScanTs < DAILY_INTERVAL_MS) {
      const elapsedH = Math.floor((Date.now() - lastDailyScanTs) / 3600000);
      dlog(`Once-a-day mode — ${reason}: last scan ${elapsedH}h ago, skipping`);
      return true;
    }
    return false;
  };

  const triggerScan = async (reason: string): Promise<boolean> => {
    if (shouldSkipDailyScan(reason)) return true;
    if (scanInProgress) {
      scanQueued = true;
      dlog(`Scan queued (${reason}) — another scan is in progress`);
      return false;
    }
    scanInProgress = true;
    scanQueued = false;
    let result = false;
    try {
      dlog(`Scan triggered: ${reason}`);
      result = await runOneScan();
      recordDailyScanIfActive(result);
    } finally {
      scanInProgress = false;
    }
    if (scanQueued) {
      scanQueued = false;
      return triggerScan('queued');
    }
    return result;
  };

  registerScanTrigger(() => triggerScan('manual button'));

  const STEAM_ID_BASE = '76561197960265728';
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
      void setCurrentSteamIdIPC({ payload: sid })
        .catch((e) => log(`set_current_steamid_ipc failed: ${String(e)}`))
        .then(() => {
          skipLogged.clear();
          failLogged.clear();
          grabbedSet = new Set<number>();
          notifiedSet = new Set<number>();
          _notifiedAvailableAppids.clear();
          _globalGrabbedAppids.clear();
          clearOwnershipCache();
          void _reloadGlobalGrabbed();
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

  try {
    const sRaw = await withTimeout(loadSettings(), 3000, '{}');
    settings = normalizeSettings(JSON.parse(sRaw || '{}'));
  } catch {}
  try {
    const raw = await withTimeout(loadLastDailyScanIPC(), 3000, '{}');
    lastDailyScanTs = loadLastScanTs(JSON.parse(raw || '{}'));
  } catch {}

  await triggerScan('initial');
  const WEEKEND_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000;
  let lastWeekendScanMs = Date.now();
  void runWeekendScan();
  _trackInterval(() => {
    if (Date.now() - lastWeekendScanMs >= WEEKEND_SCAN_INTERVAL_MS) {
      lastWeekendScanMs = Date.now();
      void runWeekendScan();
    }
  }, 10 * 60 * 1000);

  _trackInterval(async () => {
    try {
      const sRaw = await withTimeout(loadSettings(), 3000, '{}');
      settings = normalizeSettings(JSON.parse(sRaw || '{}'));
    } catch {}
  }, 30000);

  const scheduleNext = (retryDelay?: number) => {
    if (_autoclaimNextScanTimer) clearTimeout(_autoclaimNextScanTimer);

    if (!retryDelay && settings.pollIntervalMin >= DAILY_MODE_MIN) {
      const now = Date.now();
      const base = lastDailyScanTs > 0 ? lastDailyScanTs : now;
      const interval = Math.max(60 * 1000, base + DAILY_INTERVAL_MS - now);
      dlog(`Next daily scan in ${Math.round(interval / 60000)} min`);
      _autoclaimNextScanTimer = setTimeout(async () => {
        _autoclaimNextScanTimer = null;
        const ok = await triggerScan('daily scheduled');
        if (!ok) scheduleNext(5 * 60 * 1000);
        else scheduleNext();
      }, interval);
      return;
    }

    const interval = retryDelay ?? (settings.pollIntervalMin || MIN_POLL_INTERVAL_MIN) * 60 * 1000;
    if (retryDelay) {
      log(`Scan failed — retrying in ${Math.round(interval / 1000)}s`);
    } else {
      dlog(`Next scan in ${settings.pollIntervalMin} min`);
    }
    _autoclaimNextScanTimer = setTimeout(async () => {
      _autoclaimNextScanTimer = null;
      const ok = await triggerScan(retryDelay ? 'retry after failure' : 'scheduled');
      if (!ok) {
        const next = Math.min((retryDelay ?? 60000) * 2.5, (settings.pollIntervalMin || MIN_POLL_INTERVAL_MIN) * 60 * 1000);
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
  log('frontend: plugin init');
  void startPolling();
  registerManager();
  setupToolbar();
  useEffect(() => {
    const t = setTimeout(() => showWelcomeIfFirstTime(), 2000);
    return () => clearTimeout(t);
  }, []);
  return {
    title: 'Auto Claim',
    icon: React.createElement('span', { style: { display: 'none' } }),
    content: React.createElement(SettingsTab),
  };
});
