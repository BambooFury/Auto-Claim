import { silentClaim } from './claim';
import {
  WIDGET_CSS_TEMPLATE,
  WIDGET_HTML_TEMPLATE,
  WIDGET_EMPTY_TEMPLATE,
  WIDGET_CARD_TEMPLATE,
  WIDGET_SETTINGS_TEMPLATE,
  SVG_GIFT,
  SVG_RADAR,
  SVG_GEAR,
  SVG_CHECK,
  SVG_FUNNEL,
} from './_assets.generated';
import {
  loadFreeGamesCacheIPC, loadGrabbedIPC, loadWidgetSettingsIPC, pushToastIPC, logIPC,
  requestScanIPC, popScanDoneIPC,
  tryAcquireClaimLockIPC, releaseClaimLockIPC,
} from './ipc';
import { isGameOwned, isInLibrary, checkLibraryAsync } from './library';
import { cfg, initialWidgetRaw, saveSettings } from './settings';
import { getTabColor } from './tab-colors';
import type { FreeGame } from './types';

const ROOT_ID  = 'fgg-widget-root';
const PANEL_W  = 340;
const PANEL_RIGHT_OFFSET_WHEN_OPEN = 341;
const SMOOTH = 'cubic-bezier(0.4,0,0.2,1)';

const _fggIntervals: ReturnType<typeof setInterval>[] = [];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
}

function colorWithAlpha(color: string, alpha: number): string {
  const m = color.match(/^rgba?\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/i);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;

  const hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function tabSize(style: string): { w: number; h: number; off: number } {
  if (style === 'slim')     return { w: 20, h: 48, off: 0 };
  if (style === 'floating') return { w: 26, h: 56, off: 8 };
  return { w: 28, h: 64, off: 0 };
}

function tabRadius(style: string, isLeft: boolean): string {
  if (style === 'floating') return '8px';
  return isLeft ? '0 6px 6px 0' : '6px 0 0 6px';
}

function panelRadius(style: string, isLeft: boolean): string {
  if (style === 'floating') return '12px';
  return isLeft ? '0 12px 12px 0' : '12px 0 0 12px';
}

function arrowPoints(isLeft: boolean, opened: boolean): string {
  if (isLeft)  return opened ? '7,2 3,7 7,12' : '3,2 7,7 3,12';
  return opened ? '3,2 7,7 3,12' : '7,2 3,7 7,12';
}

function isClaimableGame(g: FreeGame): boolean {
  return !g.type || g.type === 'game' || g.type === 'unknown';
}

function gameTypeLabel(t?: string): string {
  switch (t) {
    case 'dlc':   return 'DLC';
    case 'music': return 'Soundtrack';
    case 'demo':  return 'Demo';
    default:      return '';
  }
}

const INDICATOR_PRESET_HEX: Record<string, string> = {
  gray:  '#a8a8a8',
  black: '#1a1a1a',
  white: '#f0f0f0',
  blue:  '#4c9eff',
  red:   '#e05252',
};

function resolveIndicatorHex(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (value.charAt(0) === '#') return value;
  return INDICATOR_PRESET_HEX[value] || fallback;
}


export function injectVanillaWidget(): void {
  if (document.getElementById(ROOT_ID)) return;

  while (_fggIntervals.length) clearInterval(_fggIntervals.pop()!);

  let palette  = getTabColor(cfg.tabColor);
  let isLeft   = cfg.panelSide === 'left';
  let geom     = tabSize(cfg.tabStyle);
  let pOff     = cfg.tabStyle === 'floating' ? geom.off + geom.w + 4 : geom.w;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  Object.assign(root.style, {
    position: 'fixed', inset: '0',
    pointerEvents: 'none', zIndex: '2147483000',
    userSelect: 'none',
  } as Partial<CSSStyleDeclaration>);
  (root.style as any).webkitUserSelect = 'none';

  const tabBtn = document.createElement('button');
  tabBtn.type = 'button';
  Object.assign(tabBtn.style, {
    position: 'fixed', top: '65%', transform: 'translateY(-50%)',
    width: geom.w + 'px', height: geom.h + 'px',
    border: 'none', borderRadius: tabRadius(cfg.tabStyle, isLeft),
    background: palette.bg,
    boxShadow: 'none',
    cursor: 'pointer', pointerEvents: 'all',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: (isLeft ? 'left' : 'right') + ` 0.25s ${SMOOTH}, background 0.15s`,
  } as Partial<CSSStyleDeclaration>);
  if (isLeft) tabBtn.style.left = geom.off + 'px';
  else        tabBtn.style.right = geom.off + 'px';

  const DEAD_W  = 32;
  const DEAD_H  = 120;
  const deadZone = document.createElement('div');
  Object.assign(deadZone.style, {
    position: 'fixed', top: '65%',
    transform: 'translateY(-50%)',
    width: DEAD_W + 'px', height: DEAD_H + 'px',
    pointerEvents: 'all', cursor: 'default',
    zIndex: '2147482998',
    background: 'transparent',
  } as Partial<CSSStyleDeclaration>);
  deadZone.addEventListener('click', (e) => e.stopPropagation());

  tabBtn.innerHTML =
    '<svg width="10" height="14" viewBox="0 0 10 14" fill="none">' +
      '<polyline id="fgg-arrow" points="' + arrowPoints(isLeft, false) + '"' +
      ' stroke="' + palette.arrow + '" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"></polyline>' +
    '</svg>' +
    '<span id="fgg-tab-badge" class="fgg-tab-badge" aria-hidden="true"></span>';

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed', top: '65%',
    transform: `translateY(-50%) translateX(${isLeft ? '-110%' : '110%'})`,
    transition: `transform 0.25s ${SMOOTH}`,
    width: PANEL_W + 'px',
    background: '#0d0d0d',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: panelRadius(cfg.tabStyle, isLeft),
    pointerEvents: 'all', overflow: 'hidden',
  } as Partial<CSSStyleDeclaration>);
  if (isLeft) panel.style.left = pOff + 'px';
  else        panel.style.right = pOff + 'px';

  panel.innerHTML = panelMarkup();
  const styleEl = panel.querySelector<HTMLStyleElement>('#fgg-style');
  if (styleEl) styleEl.textContent = PANEL_CSS;

  const dim = document.createElement('div');
  Object.assign(dim.style, {
    position: 'fixed', inset: '0',
    background: 'rgba(0,0,0,0.4)',
    display: 'none', pointerEvents: 'all',
  } as Partial<CSSStyleDeclaration>);

  let opened = false;
  let activeTab: 'games' | 'settings' = 'games';
  let games: FreeGame[] = [];
  let busyClaim = false;
  let claimingAppid = 0;
  let claimDone  = 0;
  let claimTotal = 0;
  let ownedSet  = new Set<number>();
  let refreshing = false;
  let lastLibFetchMs = 0;
  const LIB_RECHECK_MS = 30_000;

  const SEEN_LS_LEGACY_KEY = 'fgg_seen_appids';
  function getCurrentSteamId(): string {
    try {
      const m = document.cookie.match(/steamLoginSecure=(\d+)/);
      return m ? m[1] : '';
    } catch { return ''; }
  }
  function getSeenLsKey(): string {
    const sid = getCurrentSteamId();
    return sid ? `${SEEN_LS_LEGACY_KEY}_${sid}` : SEEN_LS_LEGACY_KEY;
  }
  let seenSet = new Set<number>();
  try {
    const key = getSeenLsKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== SEEN_LS_LEGACY_KEY) {
      raw = localStorage.getItem(SEEN_LS_LEGACY_KEY);
      if (raw) {
        try { localStorage.setItem(key, raw); } catch {}
      }
    }
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) seenSet = new Set(arr.filter((v) => typeof v === 'number'));
    }
  } catch {}

  function saveSeenSet() {
    try { localStorage.setItem(getSeenLsKey(), JSON.stringify(Array.from(seenSet))); } catch {}
  }

  function markVisibleAsSeen() {
    let changed = false;
    for (const g of games) {
      if (isGameOwned(g.appid, ownedSet) || isInLibrary(g.appid)) continue;
      if (!seenSet.has(g.appid)) { seenSet.add(g.appid); changed = true; }
    }
    if (changed) saveSeenSet();
  }

  const $ = <T extends Element = HTMLElement>(sel: string) =>
    panel.querySelector(sel) as T | null;

  const footerEl     = $<HTMLElement>('#fgg-footer')!;
  const footerDot    = $<HTMLElement>('#fgg-footer-dot')!;
  const tabIndicator = $<HTMLElement>('#fgg-tab-indicator')!;
  const bodyEl       = $<HTMLElement>('#fgg-body')!;
  const gamesTabBtn  = $<HTMLButtonElement>('#fgg-tab-games')!;
  const setsTabBtn   = $<HTMLButtonElement>('#fgg-tab-settings')!;
  const arrowEl      = tabBtn.querySelector<SVGPolylineElement>('#fgg-arrow')!;
  const tabBadgeEl   = tabBtn.querySelector<HTMLElement>('#fgg-tab-badge')!;
  const filterBtnEl  = $<HTMLElement>('#fgg-filter-btn')!;
  const filterToastEl = $<HTMLElement>('#fgg-filter-toast')!;

  const FILTER_TOAST_LABELS: Record<'games' | 'all', string> = {
    games: 'Games only',
    all:   'All free items',
  };
  let filterToastTimer: ReturnType<typeof setTimeout> | null = null;
  function showFilterToast(mode: 'games' | 'all') {
    filterToastEl.innerHTML = `${SVG_FUNNEL}<span>${FILTER_TOAST_LABELS[mode]}</span>`;
    filterToastEl.classList.remove('is-visible');
    void filterToastEl.offsetWidth;
    filterToastEl.classList.add('is-visible');
    if (filterToastTimer) clearTimeout(filterToastTimer);
    filterToastTimer = setTimeout(() => {
      filterToastEl.classList.remove('is-visible');
    }, 1500);
  }

  function updateFilterBtnState() {
    filterBtnEl.setAttribute('aria-label', cfg.filterMode === 'games' ? 'Filter: Games' : 'Filter: All');
    filterBtnEl.classList.toggle('is-all', cfg.filterMode === 'all');
  }

  function toggleFilter(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab === 'settings') return;
    const next = cfg.filterMode === 'games' ? 'all' : 'games';
    cfg.filterMode = next;
    saveSettings();
    updateFilterBtnState();
    updateNewIndicator();
    refreshGamesBadge();
    refreshFooter();
    showFilterToast(next);
    logIPC({ payload: `Filter mode changed: ${next}` }).catch(() => {});
    activeTab = 'games';
    render();
  }

  filterBtnEl.addEventListener('click', toggleFilter);
  filterBtnEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') toggleFilter(e);
  });

  function visibleByFilter(list: FreeGame[]): FreeGame[] {
    return cfg.filterMode === 'all' ? list : list.filter(isClaimableGame);
  }

  function updateNewIndicator() {
    const list = visibleByFilter(games);
    const newCnt = list.reduce((acc, g) => {
      if (isGameOwned(g.appid, ownedSet) || isInLibrary(g.appid)) return acc;
      if (seenSet.has(g.appid)) return acc;
      return acc + 1;
    }, 0);
    tabBadgeEl.style.display = newCnt > 0 ? 'block' : 'none';
  }

  function refreshGamesBadge() {
    const badge = $<HTMLElement>('#fgg-games-badge');
    if (!badge) return;
    const filtered = visibleByFilter(games);
    const total    = filtered.length;
    const ownedCnt = filtered.filter(g => isGameOwned(g.appid, ownedSet) || isInLibrary(g.appid)).length;
    const newCnt   = total - ownedCnt;

    if (total === 0) {
      badge.classList.remove('is-shown', 'is-zero');
    } else if (cfg.hideOwned && newCnt === 0) {
      badge.textContent = '✓';
      badge.classList.add('is-shown', 'is-zero');
    } else {
      badge.textContent = String(cfg.hideOwned ? newCnt : total);
      badge.classList.remove('is-zero');
      badge.classList.add('is-shown');
    }
  }

  function positionTabBadge() {
    if (isLeft) {
      tabBadgeEl.style.left  = '';
      tabBadgeEl.style.right = '-3px';
    } else {
      tabBadgeEl.style.right = '';
      tabBadgeEl.style.left  = '-3px';
    }
  }

  function refreshFooter() {
    if (busyClaim) {
      footerEl.textContent = `Claiming ${claimDone + 1}/${claimTotal}…`;
      footerDot.style.background = 'rgba(255,255,255,0.85)';
      footerDot.style.boxShadow  = '0 0 6px rgba(255,255,255,0.4)';
      return;
    }
    footerEl.textContent = `Active · every ${cfg.pollIntervalMin} min`;
    footerDot.style.background = '#55cc55';
    footerDot.style.boxShadow  = '0 0 6px #55cc55';
  }

  function persistAndRefresh() {
    saveSettings();
    refreshFooter();
  }

  async function runAutoClaim() {
    if (busyClaim) return;
    if (!cfg.autoAdd) return;
    if (cfg.filterMode === 'all') return;
    const todo = games.filter((g) =>
      isClaimableGame(g) && !ownedSet.has(g.appid) && !isInLibrary(g.appid),
    );
    if (todo.length === 0) return;

    busyClaim  = true;
    claimTotal = todo.length;
    claimDone  = 0;
    refreshFooter();

    for (const g of todo) {

      if (!cfg.autoAdd) {
        logIPC({ payload: 'auto-add toggled OFF mid-run — stopping queue' }).catch(() => {});
        break;
      }

      claimingAppid = g.appid;
      render();

      if (isInLibrary(g.appid) || ownedSet.has(g.appid)) {
        ownedSet.add(g.appid);
        claimDone++;
        refreshFooter();
        continue;
      }

      const acquired = await tryAcquireClaimLockIPC({ payload: String(g.appid) }).catch(() => 0);
      if (!acquired) {
        logIPC({ payload: `[${g.appid}] widget claim skipped — lock busy` }).catch(() => {});
        claimDone++;
        refreshFooter();
        continue;
      }

      let result;
      try {
        result = await silentClaim(g.appid);
      } finally {
        await releaseClaimLockIPC({ payload: String(g.appid) }).catch(() => {});
      }

      if (result.ok) {
        ownedSet.add(g.appid);
        updateNewIndicator();
        if (cfg.notifyOnGrab) {
          pushToastIPC({ payload: JSON.stringify({ appid: g.appid, name: g.name }) })
            .catch(() => {});
        }
      } else if (result.reason === 'session expired' || result.reason === 'no sessionid') {
        break;
      }
      claimDone++;
      refreshFooter();
      await sleep(1200);
    }

    claimingAppid = 0;
    busyClaim     = false;
    claimTotal    = 0;
    claimDone     = 0;
    refreshFooter();
    updateNewIndicator();
    render();
  }


  async function mergeGrabbedIntoOwned(target: Set<number>): Promise<boolean> {
    try {
      const raw = await loadGrabbedIPC();
      const list = JSON.parse(raw || '[]');
      if (!Array.isArray(list)) return false;
      let changed = false;
      for (const entry of list) {
        if (!entry || entry.added !== true) continue;
        const id = parseInt(String(entry.appid), 10);
        if (!Number.isFinite(id) || id <= 0) continue;
        if (!target.has(id)) { target.add(id); changed = true; }
      }
      return changed;
    } catch {
      return false;
    }
  }

  async function softRefresh() {
    if (busyClaim || refreshing) return;
    refreshing = true;
    try {
      const raw = await loadFreeGamesCacheIPC();
      const next: FreeGame[] = JSON.parse(raw || '[]');

      const unchanged =
        next.length === games.length &&
        next.every((g, i) => g.appid === games[i]?.appid && g.name === games[i]?.name);

      if (unchanged) {

        const grabbedChanged = await mergeGrabbedIntoOwned(ownedSet);

        updateNewIndicator();
        refreshGamesBadge();
        if (grabbedChanged && opened && activeTab === 'games') render();

        const stillPending = games.some(
          (g) => !ownedSet.has(g.appid) && !isInLibrary(g.appid),
        );
        if (stillPending && Date.now() - lastLibFetchMs > LIB_RECHECK_MS && games.length > 0) {
          const fresh = await checkLibraryAsync(games.map((g) => g.appid))
            .catch((): Set<number> | null => null);
          if (fresh) {
            let changed = false;
            fresh.forEach((id: number) => {
              if (!ownedSet.has(id)) { ownedSet.add(id); changed = true; }
            });
            lastLibFetchMs = Date.now();
            if (changed) {
              updateNewIndicator();
              if (opened && activeTab === 'games') render();
            }
          }
        }
        return;
      }

      games = next;
      ownedSet = next.length > 0
        ? await checkLibraryAsync(next.map((g) => g.appid)).catch(() => new Set<number>())
        : new Set<number>();

      await mergeGrabbedIntoOwned(ownedSet);
      lastLibFetchMs = Date.now();

      updateNewIndicator();

      if (opened && activeTab === 'games') render();
      if (cfg.autoAdd && cfg.filterMode !== 'all' && next.length > 0) void runAutoClaim();
    } catch {} finally {
      refreshing = false;
    }
  }

  function render() {
    gamesTabBtn.classList.toggle('active', activeTab === 'games');
    setsTabBtn .classList.toggle('active', activeTab === 'settings');
    tabIndicator.style.left = activeTab === 'games' ? '0%' : '50%';
    bodyEl.classList.toggle('is-settings', activeTab === 'settings');

    refreshGamesBadge();
    updateFilterBtnState();
    filterBtnEl.classList.toggle('is-dimmed', activeTab === 'settings');
    filterBtnEl.setAttribute('tabindex', activeTab === 'settings' ? '-1' : '0');
    filterBtnEl.setAttribute('aria-disabled', activeTab === 'settings' ? 'true' : 'false');

    if (activeTab === 'games') {
      renderGames(bodyEl, games, ownedSet, busyClaim, claimingAppid);
    } else {
      renderSettings(bodyEl, render, persistAndRefresh, games);
    }
  }

  gamesTabBtn.addEventListener('click', () => { activeTab = 'games';    render(); });
  setsTabBtn.addEventListener('click',  () => { activeTab = 'settings'; render(); });

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function setOpen(next: boolean) {
    opened = next;

    if (next) {
      markVisibleAsSeen();
      updateNewIndicator();
      loadWidgetSettingsIPC()
        .then((raw) => {
          try {
            const w = JSON.parse(raw || '{}');
            if (w.tabColor)                                  cfg.tabColor       = w.tabColor;
            if (w.accentColor)                               cfg.accentColor    = w.accentColor;
            if (typeof w.indicatorColor === 'string')        cfg.indicatorColor = w.indicatorColor;
            if (w.showOverlay !== undefined)                 cfg.showOverlay = w.showOverlay;
            if (w.panelSide === 'left' || w.panelSide === 'right') cfg.panelSide = w.panelSide;
            if (w.tabStyle === 'slim' || w.tabStyle === 'large' || w.tabStyle === 'floating') {
              cfg.tabStyle = w.tabStyle;
            }
            if (w.filterMode === 'games' || w.filterMode === 'all') {
              cfg.filterMode = w.filterMode;
            }
            applyChrome();
          } catch {}
        })
        .catch(() => {});
    }

    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }

    if (next) {
      panel.style.visibility = 'visible';
    } else if (cfg.tabStyle === 'floating') {
      hideTimer = setTimeout(() => { if (!opened) panel.style.visibility = 'hidden'; }, 320);
    }

    panel.style.transform = `translateY(-50%) translateX(${opened ? '0' : isLeft ? '-110%' : '110%'})`;
    dim.style.display = opened && cfg.showOverlay ? 'block' : 'none';
    tabBtn.style.background = opened ? palette.bgHover : palette.bg;

    const slideOffset = opened ? pOff + PANEL_RIGHT_OFFSET_WHEN_OPEN : geom.off;
    if (isLeft) tabBtn.style.left  = slideOffset + 'px';
    else        tabBtn.style.right = slideOffset + 'px';

    if (isLeft) deadZone.style.left  = (slideOffset + geom.w) + 'px';
    else        deadZone.style.right = (slideOffset + geom.w) + 'px';

    arrowEl.setAttribute('points', arrowPoints(isLeft, opened));

    if (next) void softRefresh();
  }

  function applyChrome() {
    palette = getTabColor(cfg.tabColor);
    isLeft  = cfg.panelSide === 'left';
    geom    = tabSize(cfg.tabStyle);
    pOff    = cfg.tabStyle === 'floating' ? geom.off + geom.w + 4 : geom.w;

    const accent = cfg.accentColor || 'rgba(255,255,255,0.95)';
    panel.style.setProperty('--fgg-tab-accent', accent);
    panel.style.setProperty('--fgg-tab-accent-glow', colorWithAlpha(accent, 0.3));

    const indicatorHex = resolveIndicatorHex(cfg.indicatorColor, '#ff7a3c');
    tabBtn.style.setProperty('--fgg-indicator-color', indicatorHex);
    tabBtn.style.setProperty('--fgg-indicator-soft',   colorWithAlpha(indicatorHex, 0.55));
    tabBtn.style.setProperty('--fgg-indicator-strong', colorWithAlpha(indicatorHex, 0.95));

    tabBtn.style.width        = geom.w + 'px';
    tabBtn.style.height       = geom.h + 'px';
    tabBtn.style.borderRadius = tabRadius(cfg.tabStyle, isLeft);
    tabBtn.style.background   = opened ? palette.bgHover : palette.bg;
    tabBtn.style.boxShadow    = 'none';
    tabBtn.style.transition   = `left 0.3s ${SMOOTH}, right 0.3s ${SMOOTH}, background 0.15s`;

    const slideOff = opened ? pOff + PANEL_RIGHT_OFFSET_WHEN_OPEN : geom.off;
    if (isLeft) {
      tabBtn.style.right = '';
      tabBtn.style.left  = slideOff + 'px';
      deadZone.style.right = '';
      deadZone.style.left  = (slideOff + geom.w) + 'px';
    } else {
      tabBtn.style.left  = '';
      tabBtn.style.right = slideOff + 'px';
      deadZone.style.left  = '';
      deadZone.style.right = (slideOff + geom.w) + 'px';
    }

    panel.style.borderRadius = panelRadius(cfg.tabStyle, isLeft);
    panel.style.transition   = `transform 0.3s ${SMOOTH}`;
    panel.style.transform    = `translateY(-50%) translateX(${opened ? '0' : isLeft ? '-110%' : '110%'})`;
    panel.style.visibility   = (!opened && cfg.tabStyle === 'floating') ? 'hidden' : 'visible';

    if (isLeft) {
      panel.style.right = '';
      panel.style.left  = pOff + 'px';
    } else {
      panel.style.left  = '';
      panel.style.right = pOff + 'px';
    }

    arrowEl.setAttribute('points', arrowPoints(isLeft, opened));
    positionTabBadge();
    dim.style.display = opened && cfg.showOverlay ? 'block' : 'none';
    render();
  }

  tabBtn.addEventListener('click', () => setOpen(!opened));
  dim.addEventListener('click',    () => setOpen(false));
  $<HTMLButtonElement>('#fgg-close')?.addEventListener('click', () => setOpen(false));
  applyChrome();

  root.appendChild(dim);
  root.appendChild(panel);
  root.appendChild(deadZone);
  root.appendChild(tabBtn);
  document.body.appendChild(root);

  let lastWidgetJson = initialWidgetRaw;
  const settingsPoll = setInterval(() => {
    loadWidgetSettingsIPC()
      .then((raw) => {
        if (raw === lastWidgetJson) return;
        lastWidgetJson = raw;

        try {
          const w = JSON.parse(raw || '{}');
          let changed = false;

          if (w.tabColor && w.tabColor !== cfg.tabColor) {
            cfg.tabColor = w.tabColor; changed = true;
          }
          if (w.accentColor && w.accentColor !== cfg.accentColor) {
            cfg.accentColor = w.accentColor; changed = true;
          }
          if (typeof w.indicatorColor === 'string' && w.indicatorColor !== cfg.indicatorColor) {
            cfg.indicatorColor = w.indicatorColor; changed = true;
          }
          if (w.showOverlay !== undefined && w.showOverlay !== cfg.showOverlay) {
            cfg.showOverlay = w.showOverlay; changed = true;
          }
          if ((w.panelSide === 'left' || w.panelSide === 'right') && w.panelSide !== cfg.panelSide) {
            cfg.panelSide = w.panelSide; changed = true;
          }
          if ((w.tabStyle === 'slim' || w.tabStyle === 'large' || w.tabStyle === 'floating')
              && w.tabStyle !== cfg.tabStyle) {
            cfg.tabStyle = w.tabStyle; changed = true;
          }
          let filterChanged = false;
          if ((w.filterMode === 'games' || w.filterMode === 'all') && w.filterMode !== cfg.filterMode) {
            cfg.filterMode = w.filterMode; changed = true; filterChanged = true;
          }

          if (changed) applyChrome();
          if (filterChanged) {
            updateFilterBtnState();
            updateNewIndicator();
            refreshGamesBadge();
            if (opened && activeTab === 'games') render();
          }
        } catch {}
      })
      .catch(() => {});
  }, 2000);

  void softRefresh();
  const cachePoll = setInterval(() => {
    if (!opened) return;
    void softRefresh();
  }, 5000);


  _fggIntervals.push(settingsPoll, cachePoll);

  window.addEventListener('beforeunload', () => {
    while (_fggIntervals.length) clearInterval(_fggIntervals.pop()!);
    if (hideTimer) clearTimeout(hideTimer);
  }, { once: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const PANEL_CSS = WIDGET_CSS_TEMPLATE;

function panelMarkup(): string {
  return WIDGET_HTML_TEMPLATE
    .replace(/\{\{SVG_GIFT\}\}/g,      SVG_GIFT)
    .replace(/\{\{SVG_FUNNEL\}\}/g,    SVG_FUNNEL)
    .replace(/\{\{SVG_GEAR\}\}/g,      SVG_GEAR)
    .replace(/\{\{POLL_INTERVAL\}\}/g, String(cfg.pollIntervalMin));
}

function renderEmpty(message: string): string {
  return WIDGET_EMPTY_TEMPLATE
    .replace(/\{\{SVG_RADAR\}\}/g,     SVG_RADAR)
    .replace(/\{\{MESSAGE\}\}/g,       message)
    .replace(/\{\{POLL_INTERVAL\}\}/g, String(cfg.pollIntervalMin));
}

function renderGames(
  bodyEl: HTMLElement,
  games: FreeGame[],
  ownedSet: Set<number>,
  claiming: boolean,
  claimingAppid: number,
): void {
  if (games.length === 0) {
    bodyEl.innerHTML = renderEmpty('No free items detected right now.');
    return;
  }

  const filteredByMode = cfg.filterMode === 'all' ? games : games.filter(isClaimableGame);

  const visibleGames = cfg.hideOwned
    ? filteredByMode.filter((g) => !isGameOwned(g.appid, ownedSet) && !isInLibrary(g.appid))
    : filteredByMode;

  if (visibleGames.length === 0) {
    const emptyMsg = cfg.hideOwned
      ? 'No new free items right now.'
      : (cfg.filterMode === 'games'
          ? 'No free games right now.'
          : 'No free items right now.');
    bodyEl.innerHTML = renderEmpty(emptyMsg);
    return;
  }

  const cardsHtml = visibleGames.map((g) => buildCard(g, ownedSet, claiming, claimingAppid)).join('');
  bodyEl.innerHTML = cardsHtml;

  bodyEl.querySelectorAll<HTMLElement>('[data-style]').forEach((el) => {
    const style = el.getAttribute('data-style');
    if (style) el.style.cssText = style;
    el.removeAttribute('data-style');
  });

  bodyEl.querySelectorAll<HTMLElement>('.fgg-card').forEach((card) => {
    const owned = card.classList.contains('owned');
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-1px)';
      card.style.borderColor = 'rgba(255,255,255,0.18)';
      card.style.boxShadow   = '0 6px 18px rgba(0,0,0,0.4)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.borderColor = owned ? 'rgba(85,204,85,0.18)' : 'rgba(255,255,255,0.08)';
      card.style.boxShadow   = '';
    });
  });

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-open-app]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-open-app');
      if (id) location.href = `https://store.steampowered.com/app/${id}/`;
    });
  });

  bodyEl.querySelectorAll<HTMLImageElement>('img[data-fallback-src]').forEach((img) => {
    const swapOrHide = () => {
      const fb = img.getAttribute('data-fallback-src');
      if (fb) {
        img.removeAttribute('data-fallback-src');
        img.src = fb;
      } else {
        img.style.display = 'none';
      }
    };
    img.addEventListener('error', swapOrHide);
    if (img.complete && img.naturalWidth === 0) swapOrHide();
  });
}

function buildCard(
  g: FreeGame,
  ownedSet: Set<number>,
  claiming: boolean,
  claimingAppid: number,
): string {
  const owned     = isGameOwned(g.appid, ownedSet);
  const isClaim   = claiming && claimingAppid === g.appid;
  const typeLabel = gameTypeLabel(g.type);

  const accent    = owned ? 'rgba(85,204,85,0.35)' : isClaim ? 'rgba(255,255,255,0.6)'  : 'rgba(255,255,255,0.28)';
  const dotColor  = owned ? '#55cc55'              : 'rgba(255,255,255,0.7)';
  const baseStatus = typeLabel ? typeLabel + ' · 100% off' : '100% off · pending';
  const status    = owned ? 'Owned · in your library' : isClaim ? 'Claiming silently…' : baseStatus;
  const cardEdge  = owned ? 'rgba(85,204,85,0.18)' : isClaim ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
  const cardGlow  = isClaim ? '0 0 16px rgba(255,255,255,0.10)' : '';

  let trailing: string;
  if (owned) {
    trailing = `<div class="fgg-check">${SVG_CHECK}</div>`;
  } else if (isClaim) {
    trailing = `<div class="fgg-spinner"></div>`;
  } else {
    trailing = `<button class="fgg-open-btn" data-open-app="${g.appid}">Open</button>`;
  }

  const cdn        = 'https://cdn.akamai.steamstatic.com/steam/apps';
  const heroSrc    = `${cdn}/${g.appid}/library_hero.jpg`;
  const heroBack   = `${cdn}/${g.appid}/page_bg_generated_v6b.jpg`;
  const headerSrc  = g.header  || `${cdn}/${g.appid}/header.jpg`;
  const headerBack = g.capsule || `${cdn}/${g.appid}/capsule_231x87.jpg`;

  const cls = `fgg-card${isClaim ? ' claiming' : ''}${owned ? ' owned' : ''}`;
  const vars = [
    `--fgg-accent:${accent}`,
    `--fgg-edge:${cardEdge}`,
    `--fgg-dot:${dotColor}`,
    `--fgg-dot-shadow:${dotColor}88`,
  ];
  if (cardGlow) vars.push(`--fgg-glow:${cardGlow}`);

  return WIDGET_CARD_TEMPLATE
    .replace(/\{\{CLS\}\}/g,            cls)
    .replace(/\{\{OWNED\}\}/g,          owned   ? '1' : '0')
    .replace(/\{\{CLAIMING\}\}/g,       isClaim ? '1' : '0')
    .replace(/\{\{STYLE_VARS\}\}/g,     vars.join(';'))
    .replace(/\{\{HERO_SRC\}\}/g,       heroSrc)
    .replace(/\{\{HERO_FALLBACK\}\}/g,  heroBack)
    .replace(/\{\{HEADER_SRC\}\}/g,      headerSrc)
    .replace(/\{\{HEADER_FALLBACK\}\}/g, headerBack)
    .replace(/\{\{NAME\}\}/g,            escapeHtml(g.name))
    .replace(/\{\{STATUS\}\}/g,         status)
    .replace(/\{\{TRAILING\}\}/g,       trailing);
}

function renderSettings(
  bodyEl: HTMLElement,
  rerender: () => void,
  persistAndRefresh: () => void,
  lastGames: FreeGame[] = [],
): void {
  const toggleHtml = (id: string, value: boolean) =>
    `<button id="${id}" class="fgg-toggle${value ? ' on' : ''}" data-fgg-on="${value ? '1' : '0'}">
      <span class="fgg-toggle-knob"></span>
    </button>`;

  const intervals = [30, 60, 120];
  const intervalsHtml = intervals.map((m) => {
    const active = cfg.pollIntervalMin === m ? ' active' : '';
    return `<button class="fgg-int-btn${active}" data-interval="${m}">${m} min</button>`;
  }).join('');

  bodyEl.innerHTML = WIDGET_SETTINGS_TEMPLATE
    .replace(/\{\{TOGGLE_AUTOADD\}\}/g,    toggleHtml('fgg-autoadd',    cfg.autoAdd))
    .replace(/\{\{TOGGLE_NOTIFYGRAB\}\}/g, toggleHtml('fgg-notifygrab', cfg.notifyOnGrab))
    .replace(/\{\{TOGGLE_HIDEOWNED\}\}/g,  toggleHtml('fgg-hideowned',  cfg.hideOwned))
    .replace(/\{\{INTERVALS\}\}/g,         intervalsHtml);

  function animateToggle(btn: HTMLButtonElement, on: boolean) {
    btn.classList.toggle('on', on);
    btn.setAttribute('data-fgg-on', on ? '1' : '0');
  }

  bodyEl.querySelector<HTMLButtonElement>('#fgg-autoadd')?.addEventListener('click', (e) => {
    const wasOff = !cfg.autoAdd;
    cfg.autoAdd = !cfg.autoAdd;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.autoAdd);
    persistAndRefresh();
    logIPC({ payload: `Auto-add toggled: ${cfg.autoAdd ? 'ON' : 'OFF'}` }).catch(() => {});
    if (wasOff && cfg.autoAdd) {
      requestScanIPC().catch(() => {});
      logIPC({ payload: 'Auto-add turned ON — requesting immediate scan' }).catch(() => {});
    }
  });

  bodyEl.querySelector<HTMLButtonElement>('#fgg-notifygrab')?.addEventListener('click', (e) => {
    cfg.notifyOnGrab = !cfg.notifyOnGrab;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.notifyOnGrab);
    persistAndRefresh();
    logIPC({ payload: `Notify on grab toggled: ${cfg.notifyOnGrab ? 'ON' : 'OFF'}` }).catch(() => {});
  });

  bodyEl.querySelector<HTMLButtonElement>('#fgg-hideowned')?.addEventListener('click', (e) => {
    cfg.hideOwned = !cfg.hideOwned;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.hideOwned);
    persistAndRefresh();
    rerender();
    logIPC({ payload: `Hide owned toggled: ${cfg.hideOwned ? 'ON' : 'OFF'}` }).catch(() => {});
  });

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((el) => {
    el.addEventListener('click', () => {
      const next = parseInt(el.getAttribute('data-interval') || '30', 10);
      if (next === cfg.pollIntervalMin) return;
      const prev = cfg.pollIntervalMin;
      cfg.pollIntervalMin = next;
      persistAndRefresh();
      rerender();
      logIPC({ payload: `Scan interval changed: ${prev} min -> ${next} min` }).catch(() => {});
    });
  });

  const scanBtn = bodyEl.querySelector<HTMLButtonElement>('#fgg-scan-now');
  const scanResult = bodyEl.querySelector<HTMLElement>('#fgg-scan-result');
  scanBtn?.addEventListener('click', async () => {
    if (scanBtn.disabled) return;
    scanBtn.disabled = true;
    scanBtn.classList.add('busy');
    if (scanResult) {
      scanResult.style.color = 'rgba(255,255,255,0.35)';
      scanResult.textContent = 'Scanning…';
    }

    let initialDoneSeq = '';
    try { initialDoneSeq = await popScanDoneIPC(); } catch {}

    try {
      await requestScanIPC();
      logIPC({ payload: 'Scan now button clicked' }).catch(() => {});
    } catch {}

    const SCAN_DEADLINE_MS = 180_000;
    const POLL_INTERVAL_MS = 1500;
    const startedAt = Date.now();

    const finish = (color: string, html: string, useText = false) => {
      scanBtn.disabled = false;
      scanBtn.classList.remove('busy');
      if (!scanResult) return;
      scanResult.style.color = color;
      if (useText) scanResult.textContent = html;
      else scanResult.innerHTML = html;
    };

    const poll = async () => {
      let curSeq = '';
      try { curSeq = await popScanDoneIPC(); } catch {}

      if (curSeq && curSeq !== initialDoneSeq) {
        let raw = '';
        try { raw = await loadFreeGamesCacheIPC(); } catch {}
        try {
          const found: FreeGame[] = JSON.parse(raw || '[]');
          const newGames = found.filter((g) => !lastGames.some((lg) => lg.appid === g.appid));
          if (newGames.length > 0) {
            finish('#55cc55', newGames.map((g) => `• ${escapeHtml(g.name)}`).join('<br>'));
          } else {
            finish('rgba(255,255,255,0.35)', 'No new free games found.', true);
          }
        } catch {
          finish('rgba(255,255,255,0.35)', 'Could not parse scan results.', true);
        }
        return;
      }

      if (Date.now() - startedAt >= SCAN_DEADLINE_MS) {
        finish('rgba(255,255,255,0.35)', 'Scan timed out — try again.', true);
        return;
      }
      setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
    };

    setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
  });

}
