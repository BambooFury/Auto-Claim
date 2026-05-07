import { silentClaim } from './claim';
import {
  loadFreeGamesCacheIPC, loadWidgetSettingsIPC, pushToastIPC, logIPC,
  requestScanIPC, popScanDoneIPC,
  tryAcquireClaimLockIPC, releaseClaimLockIPC,
  popPendingClaimJobsIPC, completeClaimJobIPC,
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

const SVG_GIFT = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 7v14"></path>
    <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path>
    <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"></path>
    <rect x="3" y="7" width="18" height="4" rx="1"></rect>
  </svg>
`;

const SVG_RADAR = `
  <svg class="fgg-radar" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="4" fill="none" stroke="currentColor" stroke-width="1.5" class="fgg-radar-pulse"/>
    <circle cx="24" cy="24" r="4" fill="none" stroke="currentColor" stroke-width="1.5" class="fgg-radar-pulse fgg-radar-pulse-2"/>
    <circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="1.25" opacity="0.3"/>
    <circle cx="24" cy="24" r="3.2" fill="currentColor" class="fgg-radar-dot"/>
  </svg>
`;

const SVG_GEAR = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051 2.34 2.34 0 0 0 9.67 4.136"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;

const SVG_CHECK = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
`;

const SVG_FUNNEL = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z"/>
  </svg>
`;

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
      return acc + (isGameOwned(g.appid, ownedSet) || isInLibrary(g.appid) ? 0 : 1);
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
    const todo = games.filter((g) =>
      isClaimableGame(g) && !ownedSet.has(g.appid) && !isInLibrary(g.appid),
    );
    if (todo.length === 0) return;

    busyClaim  = true;
    claimTotal = todo.length;
    claimDone  = 0;
    refreshFooter();

    for (const g of todo) {
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
        updateNewIndicator();
        refreshGamesBadge();

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
      lastLibFetchMs = Date.now();

      updateNewIndicator();

      if (opened && activeTab === 'games') render();
      if (cfg.autoAdd && next.length > 0) void runAutoClaim();
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

  let draining = false;
  async function drainClaimQueue() {
    if (draining) return;
    draining = true;
    try {
      let raw = '';
      try { raw = await popPendingClaimJobsIPC(); } catch { return; }
      let appids: number[] = [];
      try {
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed)) {
          appids = parsed
            .map((x) => parseInt(String(x), 10))
            .filter((n) => Number.isFinite(n) && n > 0);
        }
      } catch { return; }
      if (appids.length === 0) return;

      for (const appid of appids) {
        const acquired = await tryAcquireClaimLockIPC({ payload: String(appid) }).catch(() => 0);
        if (!acquired) {
          continue;
        }

        let res;
        try {
          res = await silentClaim(appid);
        } catch (e) {
          res = { ok: false, reason: String(e) };
        } finally {
          await releaseClaimLockIPC({ payload: String(appid) }).catch(() => {});
        }

        await completeClaimJobIPC({
          payload: JSON.stringify({
            appid,
            state:  res.ok ? 'ok' : 'fail',
            reason: res.reason || (res.ok ? 'ok' : 'unknown'),
          }),
        }).catch(() => {});

        logIPC({ payload: `[${appid}] queue claim ${res.ok ? 'ok' : 'fail'} (${res.reason})` })
          .catch(() => {});

        if (res.ok) {
          ownedSet.add(appid);
          if (cfg.notifyOnGrab) {
            const game = games.find((g) => g.appid === appid);
            if (game) {
              pushToastIPC({ payload: JSON.stringify({ appid, name: game.name }) }).catch(() => {});
            }
          }
        } else if (res.reason === 'session expired' || res.reason === 'no sessionid') {
          break;
        }

        await sleep(800);
      }

      updateNewIndicator();
      refreshGamesBadge();
    } finally {
      draining = false;
    }
  }

  const claimQueuePoll = setInterval(() => { void drainClaimQueue(); }, 2000);
  void drainClaimQueue();

  _fggIntervals.push(settingsPoll, cachePoll, claimQueuePoll);

  window.addEventListener('beforeunload', () => {
    while (_fggIntervals.length) clearInterval(_fggIntervals.pop()!);
    if (hideTimer) clearTimeout(hideTimer);
  }, { once: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

const PANEL_CSS = `
  @keyframes fgg-spin    { to { transform: rotate(360deg); } }
  @keyframes fgg-fade-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes fgg-pulse   { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
  @keyframes fgg-glow    { 0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,0.3); }
                           50%      { box-shadow: 0 0 14px rgba(255,255,255,0.5); } }

  @keyframes fgg-tab-ping {
    0%   { transform: scale(0.85); opacity: 0.85; }
    80%  { transform: scale(2.6);  opacity: 0;    }
    100% { transform: scale(2.6);  opacity: 0;    }
  }
  @keyframes fgg-tab-badge-glow {
    0%, 100% { box-shadow: 0 0 6px var(--fgg-indicator-soft, rgba(255,122,60,0.55)), inset 0 0 2px rgba(255,255,255,0.45); }
    50%      { box-shadow: 0 0 12px var(--fgg-indicator-strong, rgba(255,122,60,0.95)), inset 0 0 2px rgba(255,255,255,0.55); }
  }

  .fgg-tab-badge {
    position: absolute;
    top: -3px;
    width: 9px; height: 9px;
    border-radius: 50%;
    background: var(--fgg-indicator-color, #ff7a3c);
    pointer-events: none;
    display: none;
    animation: fgg-tab-badge-glow 2s ease-in-out infinite;
  }
  .fgg-tab-badge::before,
  .fgg-tab-badge::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .fgg-tab-badge::before {
    background: var(--fgg-indicator-soft, rgba(255,122,60,0.55));
    animation: fgg-tab-ping 1.6s cubic-bezier(0,0,0.2,1) infinite;
    z-index: 0;
  }
  .fgg-tab-badge::after {
    background: var(--fgg-indicator-color, #ff7a3c);
    z-index: 1;
  }

  .fgg-card { animation: fgg-fade-in .25s ease both; }

  .fgg-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 36px 16px;
    gap: 10px;
    text-align: center;
  }
  .fgg-empty-icon {
    width: 56px; height: 56px;
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.4);
  }
  .fgg-empty-icon svg           { width: 26px; height: 26px; }
  .fgg-empty-icon svg.fgg-radar { width: 44px; height: 44px; overflow: visible; }
  .fgg-empty-title              { color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600; }
  .fgg-empty-desc               { color: rgba(255,255,255,0.35); font-size: 11px; line-height: 1.5; }

  .fgg-radar-pulse {
    opacity: 0;
    animation: fgg-radar-ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  .fgg-radar-pulse-2 { animation-delay: 1.1s; }
  .fgg-radar-dot     { animation: fgg-radar-blink 1.8s ease-in-out infinite; }

  @keyframes fgg-radar-ping {
    0%   { r: 3;  opacity: 0.85; }
    70%  { r: 19; opacity: 0.15; }
    100% { r: 22; opacity: 0;    }
  }
  @keyframes fgg-radar-blink {
    0%, 100% { opacity: 1;    }
    50%      { opacity: 0.45; }
  }

  .fgg-card {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--fgg-edge, rgba(255,255,255,0.08));
    background: #0f0f0f;
    margin-bottom: 8px;
    box-shadow: var(--fgg-glow, none);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .fgg-card-frame {
    position: relative;
    height: 68px;
    overflow: hidden;
  }
  .fgg-card-bg {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center 30%;
    filter: brightness(0.55) saturate(1.1);
  }
  .fgg-card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(90deg,
      rgba(15,15,15,0.92) 0%,
      rgba(15,15,15,0.55) 45%,
      rgba(15,15,15,0.15) 100%);
  }
  .fgg-card-accent {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: var(--fgg-accent, rgba(255,255,255,0.28));
  }
  .fgg-card.claiming .fgg-card-accent { animation: fgg-pulse 1.2s ease-in-out infinite; }

  .fgg-card-content {
    position: absolute; inset: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px 0 16px;
  }
  .fgg-card-thumb {
    width: 64px; height: 30px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(0,0,0,0.65);
    border: 1px solid rgba(255,255,255,0.08);
  }
  .fgg-card-text { flex: 1; min-width: 0; }
  .fgg-card-name {
    color: #fff;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fgg-card-status {
    color: rgba(255,255,255,0.55);
    font-size: 10px;
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .fgg-card-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--fgg-dot, #fff);
    box-shadow: 0 0 6px var(--fgg-dot-shadow, rgba(255,255,255,0.5));
  }
  .fgg-card.claiming .fgg-card-dot { animation: fgg-pulse 1s ease-in-out infinite; }

  .fgg-check {
    flex-shrink: 0;
    width: 28px; height: 28px;
    border-radius: 50%;
    background: rgba(85,204,85,0.15);
    border: 1px solid rgba(85,204,85,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #55cc55;
  }
  .fgg-check svg { width: 14px; height: 14px; }
  .fgg-spinner {
    flex-shrink: 0;
    width: 24px; height: 24px;
    border: 2px solid rgba(255,255,255,0.12);
    border-top-color: rgba(255,255,255,0.85);
    border-radius: 50%;
    animation: fgg-spin 0.8s linear infinite;
  }
  .fgg-open-btn {
    flex-shrink: 0;
    padding: 6px 13px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 20px;
    background: rgba(255,255,255,0.10);
    border: 1px solid rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.95);
    cursor: pointer;
  }

  .fgg-toggle {
    width: 44px; height: 24px;
    border-radius: 12px;
    border: none;
    cursor: pointer;
    position: relative;
    background: rgba(255,255,255,0.15);
    transition: background 0.22s ease;
  }
  .fgg-toggle.on { background: linear-gradient(135deg, #55cc55, #2a8a2a); }
  .fgg-toggle-knob {
    position: absolute;
    top: 4px; left: 4px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: left 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .fgg-toggle.on .fgg-toggle-knob { left: 24px; }

  .fgg-hint-card {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 10px;
  }
  .fgg-hint-label {
    color: rgba(255,255,255,0.3);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .fgg-hint-text {
    color: rgba(255,255,255,0.4);
    font-size: 11px;
    line-height: 1.5;
  }
  .fgg-hint-text strong { color: rgba(255,255,255,0.6); }

  .fgg-set-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 0;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .fgg-set-row.column {
    display: block;
    align-items: stretch;
  }
  .fgg-set-title { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 500; }
  .fgg-set-desc  { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 3px; }
  .fgg-set-row.column .fgg-set-title { margin-bottom: 3px; }
  .fgg-set-row.column .fgg-set-desc  { margin-top: 0; margin-bottom: 8px; }

  .fgg-int-btns { display: flex; gap: 6px; }
  .fgg-int-btn {
    flex: 1;
    padding: 7px 0;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 400;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.5);
  }
  .fgg-int-btn.active {
    font-weight: 700;
    background: rgba(255,255,255,0.18);
    color: #fff;
  }

  .fgg-action-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%;
    padding: 9px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.85);
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, opacity 0.15s;
  }
  .fgg-action-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
  .fgg-action-btn:disabled { opacity: 0.55; cursor: progress; }
  .fgg-action-icon {
    display: inline-block;
    font-size: 14px;
    transition: transform 0.4s ease;
  }
  .fgg-action-btn.busy .fgg-action-icon {
    animation: fgg-spin 1s linear infinite;
  }
  .fgg-header {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #1a1a1a 0%, #0e0e0e 100%);
  }
  .fgg-header-info { display: flex; align-items: center; gap: 11px; }
  .fgg-icon-box {
    width: 32px; height: 32px;
    border-radius: 9px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    color: rgba(255,255,255,0.95);
  }
  .fgg-icon-box svg { width: 16px; height: 16px; }
  .fgg-title    { color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
  .fgg-subtitle { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 2px; }
  .fgg-close {
    background: none; border: none;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    font-size: 18px; line-height: 1;
    padding: 4px 8px;
    border-radius: 6px;
  }

  .fgg-tabs {
    display: flex;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    position: relative;
  }
  .fgg-tab {
    flex: 1;
    padding: 11px 4px;
    background: none; border: none;
    color: rgba(255,255,255,0.35);
    font-size: 11px; font-weight: 700; letter-spacing: .05em;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: color 0.2s;
  }
  .fgg-tab.active { color: rgba(255,255,255,0.95); }
  .fgg-tab svg    { width: 13px; height: 13px; }
  .fgg-tab-indicator {
    position: absolute; bottom: -1px; left: 0;
    width: 50%; height: 2px;
    background: var(--fgg-tab-accent, rgba(255,255,255,0.95));
    box-shadow: 0 0 8px var(--fgg-tab-accent-glow, rgba(255,255,255,0.25));
    transition: left 0.25s ${SMOOTH};
  }

  .fgg-filter-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    width: 22px; height: 22px;
    padding: 0;
    border: none;
    background: rgba(255,255,255,0.10);
    color: rgba(255,255,255,0.65);
    border-radius: 5px;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .fgg-filter-btn:hover,
  .fgg-filter-btn.is-open {
    color: #fff;
    background: rgba(255,255,255,0.20);
  }
  .fgg-filter-btn.is-dimmed {
    color: rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.05);
    pointer-events: none;
  }
  .fgg-filter-btn.is-dimmed .fgg-filter-badge {
    opacity: 0.35;
  }
  .fgg-filter-btn svg {
    width: 12px; height: 12px;
    display: block;
    pointer-events: none;
  }
  .fgg-filter-badge {
    position: absolute;
    top: -6px;
    right: -7px;
    min-width: 9px;
    height: 13px;
    padding: 0 4px;
    border-radius: 7px;
    background: #d9d9d9;
    color: #1a1a1a;
    box-shadow: 0 0 0 2px #0d0d0d;
    font-size: 9px;
    font-weight: 700;
    line-height: 13px;
    text-align: center;
    pointer-events: none;
    display: none;
    box-sizing: content-box;
  }
  .fgg-filter-badge.is-shown { display: inline-block; }
  .fgg-filter-badge.is-zero {
    background: #55cc55;
    color: #0d0d0d;
  }

  .fgg-filter-pop {
    position: absolute;
    top: calc(100% + 6px);
    z-index: 10;
    background: #161616;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 999px;
    padding: 3px;
    box-shadow: 0 12px 28px rgba(0,0,0,0.55);
    animation: fgg-fade-in 0.15s ease both;
    display: inline-flex;
    flex-direction: row;
    gap: 2px;
    width: max-content;
  }
  .fgg-filter-pop[hidden] { display: none; }
  .fgg-filter-opt {
    background: none;
    border: none;
    color: rgba(255,255,255,0.6);
    padding: 6px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.12s, color 0.12s;
    white-space: nowrap;
  }
  .fgg-filter-opt:hover {
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.9);
  }
  .fgg-filter-opt.active {
    background: rgba(255,255,255,0.14);
    color: #fff;
    font-weight: 700;
  }

  #fgg-body {
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 0;
    max-height: 360px;
    overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }
  #fgg-body.is-settings {
    max-height: none;
    overflow-y: visible;
    padding-bottom: 4px;
  }
  #fgg-body.is-settings .fgg-set-row:last-child { padding-bottom: 0; }
  #fgg-body::-webkit-scrollbar             { width: 6px; }
  #fgg-body::-webkit-scrollbar-track       { background: transparent; margin: 6px 0; }
  #fgg-body::-webkit-scrollbar-thumb       { background: rgba(255,255,255,0.12); border-radius: 3px; transition: background 0.15s; }
  #fgg-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

  .fgg-footer {
    padding: 9px 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px;
  }
  .fgg-footer-info {
    display: flex; align-items: center; gap: 8px;
    min-width: 0;
  }
  #fgg-footer-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #55cc55;
    box-shadow: 0 0 6px #55cc55;
    flex-shrink: 0;
  }
  #fgg-footer {
    font-size: 11px;
    color: rgba(255,255,255,0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

function panelMarkup(): string {
  return `
    <style>${PANEL_CSS}</style>

    <div class="fgg-header">
      <div class="fgg-header-info">
        <div class="fgg-icon-box">${SVG_GIFT}</div>
        <div>
          <div class="fgg-title">Auto Claim</div>
          <div class="fgg-subtitle">Auto-claims free Steam games</div>
        </div>
      </div>
      <button id="fgg-close" class="fgg-close">✕</button>
    </div>

    <div class="fgg-tabs">
      <button id="fgg-tab-games"    class="fgg-tab active">${SVG_GIFT}<span>FREE GAMES</span><span id="fgg-filter-btn" class="fgg-filter-btn" role="button" tabindex="0" aria-label="Filter: Games">${SVG_FUNNEL}<span id="fgg-games-badge" class="fgg-filter-badge"></span></span></button>
      <button id="fgg-tab-settings" class="fgg-tab">${SVG_GEAR}<span>SETTINGS</span></button>
      <div id="fgg-tab-indicator" class="fgg-tab-indicator"></div>
    </div>

    <div id="fgg-body"></div>

    <div class="fgg-footer">
      <div class="fgg-footer-info">
        <div id="fgg-footer-dot"></div>
        <span id="fgg-footer">Active · every ${cfg.pollIntervalMin} min</span>
      </div>
    </div>
  `;
}

function renderGames(
  bodyEl: HTMLElement,
  games: FreeGame[],
  ownedSet: Set<number>,
  claiming: boolean,
  claimingAppid: number,
): void {
  if (games.length === 0) {
    bodyEl.innerHTML = `
      <div class="fgg-empty">
        <div class="fgg-empty-icon">${SVG_RADAR}</div>
        <div class="fgg-empty-title">All caught up</div>
        <div class="fgg-empty-desc">No free items detected right now.<br/>Next scan in ${cfg.pollIntervalMin} min.</div>
      </div>
    `;
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
    bodyEl.innerHTML = `
      <div class="fgg-empty">
        <div class="fgg-empty-icon">${SVG_RADAR}</div>
        <div class="fgg-empty-title">All caught up</div>
        <div class="fgg-empty-desc">${emptyMsg}<br/>Next scan in ${cfg.pollIntervalMin} min.</div>
      </div>
    `;
    return;
  }

  const cardsHtml = visibleGames.slice(0, 8).map((g) => buildCard(g, ownedSet, claiming, claimingAppid)).join('');
  const overflowHtml = visibleGames.length > 8
    ? `<div class="fgg-empty-desc" style="text-align:center;padding:6px 0 2px;">+${visibleGames.length - 8} more not shown</div>`
    : '';
  bodyEl.innerHTML = cardsHtml + overflowHtml;

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
    img.addEventListener('error', () => {
      const fb = img.getAttribute('data-fallback-src');
      img.removeAttribute('data-fallback-src');
      if (fb) img.src = fb;
    }, { once: true });
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

  const cdn       = 'https://cdn.akamai.steamstatic.com/steam/apps';
  const heroSrc   = `${cdn}/${g.appid}/library_hero.jpg`;
  const heroBack  = `${cdn}/${g.appid}/page_bg_generated_v6b.jpg`;
  const headerSrc = `${cdn}/${g.appid}/header.jpg`;

  const cls = `fgg-card${isClaim ? ' claiming' : ''}${owned ? ' owned' : ''}`;
  const vars = [
    `--fgg-accent:${accent}`,
    `--fgg-edge:${cardEdge}`,
    `--fgg-dot:${dotColor}`,
    `--fgg-dot-shadow:${dotColor}88`,
  ];
  if (cardGlow) vars.push(`--fgg-glow:${cardGlow}`);

  return `
    <div class="${cls}" data-owned="${owned ? 1 : 0}" data-claiming="${isClaim ? 1 : 0}" style="${vars.join(';')}">
      <div class="fgg-card-frame">
        <img class="fgg-card-bg" src="${heroSrc}" data-fallback-src="${heroBack}"/>
        <div class="fgg-card-overlay"></div>
        <div class="fgg-card-accent"></div>
        <div class="fgg-card-content">
          <img class="fgg-card-thumb" src="${headerSrc}"/>
          <div class="fgg-card-text">
            <div class="fgg-card-name">${escapeHtml(g.name)}</div>
            <div class="fgg-card-status">
              <span class="fgg-card-dot"></span>
              ${status}
            </div>
          </div>
          ${trailing}
        </div>
      </div>
    </div>
  `;
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

  bodyEl.innerHTML = `
    <div class="fgg-hint-card">
      <div class="fgg-hint-label">Widget appearance</div>
      <div class="fgg-hint-text">
        Change button color, side and style in the
        <strong>Steam plugin settings</strong> panel.
      </div>
    </div>

    <div class="fgg-set-row">
      <div>
        <div class="fgg-set-title">Auto-add to library</div>
        <div class="fgg-set-desc">Grab games automatically on scan</div>
      </div>
      ${toggleHtml('fgg-autoadd', cfg.autoAdd)}
    </div>

    <div class="fgg-set-row">
      <div>
        <div class="fgg-set-title">Notify on grab</div>
        <div class="fgg-set-desc">Show toast when a game is added to library</div>
      </div>
      ${toggleHtml('fgg-notifygrab', cfg.notifyOnGrab)}
    </div>

    <div class="fgg-set-row">
      <div>
        <div class="fgg-set-title">Hide owned games</div>
        <div class="fgg-set-desc">Don't show already owned games in Free Games tab</div>
      </div>
      ${toggleHtml('fgg-hideowned', cfg.hideOwned)}
    </div>

    <div class="fgg-set-row column">
      <div class="fgg-set-title">Scan interval</div>
      <div class="fgg-set-desc">How often to check for free games</div>
      <div class="fgg-int-btns">${intervalsHtml}</div>
    </div>

    <div class="fgg-set-row column">
      <div class="fgg-set-title">Manual scan</div>
      <div class="fgg-set-desc">Run a free games check immediately</div>
      <button id="fgg-scan-now" class="fgg-action-btn">
        <span class="fgg-action-icon">⟳</span>
        <span>Scan now</span>
      </button>
      <div id="fgg-scan-result" style="margin-top:6px;font-size:11px;line-height:1.4;min-height:16px;color:rgba(255,255,255,0.35);"></div>
    </div>
  `;

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
