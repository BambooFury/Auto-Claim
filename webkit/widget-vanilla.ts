import { silentClaim } from './claim';
import { loadFreeGamesCacheIPC, loadWidgetSettingsIPC } from './ipc';
import { isGameOwned, isInLibrary, checkLibraryAsync } from './library';
import { cfg, initialWidgetRaw, saveSettings } from './settings';
import { getTabColor } from './tab-colors';
import type { FreeGame } from './types';

const ROOT_ID  = 'fgg-widget-root';
const PANEL_W  = 340;
const PANEL_RIGHT_OFFSET_WHEN_OPEN = 341;
const SMOOTH = 'cubic-bezier(0.4,0,0.2,1)';

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


export function injectVanillaWidget(): void {
  if (document.getElementById(ROOT_ID)) return;

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
    boxShadow: cfg.tabStyle === 'floating' ? '0 6px 20px rgba(0,0,0,0.45)' : 'none',
    cursor: 'pointer', pointerEvents: 'all',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: (isLeft ? 'left' : 'right') + ` 0.25s ${SMOOTH}, background 0.15s`,
  } as Partial<CSSStyleDeclaration>);
  if (isLeft) tabBtn.style.left = geom.off + 'px';
  else        tabBtn.style.right = geom.off + 'px';

  tabBtn.innerHTML =
    '<svg width="10" height="14" viewBox="0 0 10 14" fill="none">' +
      '<polyline id="fgg-arrow" points="' + arrowPoints(isLeft, false) + '"' +
      ' stroke="' + palette.arrow + '" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round"></polyline>' +
    '</svg>';

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
  let busyScan  = false;
  let busyClaim = false;
  let claimingAppid = 0;
  let claimDone  = 0;
  let claimTotal = 0;
  let ownedSet  = new Set<number>();

  const $ = <T extends Element = HTMLElement>(sel: string) =>
    panel.querySelector(sel) as T | null;

  const footerEl     = $<HTMLElement>('#fgg-footer')!;
  const footerDot    = $<HTMLElement>('#fgg-footer-dot')!;
  const tabIndicator = $<HTMLElement>('#fgg-tab-indicator')!;
  const scanBtn      = $<HTMLButtonElement>('#fgg-scan-now')!;
  const bodyEl       = $<HTMLElement>('#fgg-body')!;
  const gamesTabBtn  = $<HTMLButtonElement>('#fgg-tab-games')!;
  const setsTabBtn   = $<HTMLButtonElement>('#fgg-tab-settings')!;
  const arrowEl      = tabBtn.querySelector<SVGPolylineElement>('#fgg-arrow')!;

  function refreshFooter() {
    if (busyScan) {
      footerEl.textContent = 'Scanning Steam Store…';
      footerDot.style.background = 'rgba(255,255,255,0.85)';
      footerDot.style.boxShadow  = '0 0 6px rgba(255,255,255,0.4)';
      return;
    }
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
    const todo = games.filter((g) => !ownedSet.has(g.appid) && !isInLibrary(g.appid));
    if (todo.length === 0) return;

    busyClaim  = true;
    claimTotal = todo.length;
    claimDone  = 0;
    refreshFooter();

    for (const g of todo) {
      claimingAppid = g.appid;
      render();

      const result = await silentClaim(g.appid);
      if (result.ok) {
        ownedSet.add(g.appid);
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
    render();
  }

  async function fullScan(autoClaim = true) {
    if (busyScan) return;
    busyScan = true;
    refreshFooter();
    render();

    try {
      const raw = await loadFreeGamesCacheIPC();
      games = JSON.parse(raw || '[]');
    } catch {}

    if (games.length > 0) {
      try { ownedSet = await checkLibraryAsync(games.map((g) => g.appid)); } catch {}
    }

    busyScan = false;
    refreshFooter();
    render();

    if (autoClaim && cfg.autoAdd && games.length > 0) {
      void runAutoClaim();
    }
  }

  async function softRefresh() {
    if (busyScan || busyClaim) return;
    try {
      const raw = await loadFreeGamesCacheIPC();
      const next: FreeGame[] = JSON.parse(raw || '[]');

      const unchanged =
        next.length === games.length &&
        next.every((g, i) => g.appid === games[i]?.appid);
      if (unchanged) return;

      games = next;
      ownedSet = next.length > 0
        ? await checkLibraryAsync(next.map((g) => g.appid)).catch(() => new Set<number>())
        : new Set<number>();

      if (opened && activeTab === 'games') render();
      if (cfg.autoAdd && next.length > 0) void runAutoClaim();
    } catch {}
  }

  function render() {
    gamesTabBtn.style.color = activeTab === 'games'    ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    setsTabBtn.style.color  = activeTab === 'settings' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    tabIndicator.style.left = activeTab === 'games' ? '0%' : '50%';

    if (activeTab === 'games') renderGames(bodyEl, games, ownedSet, busyScan, busyClaim, claimingAppid);
    else                       renderSettings(bodyEl, render, persistAndRefresh);
  }

  gamesTabBtn.addEventListener('click', () => { activeTab = 'games';    render(); });
  setsTabBtn.addEventListener('click',  () => { activeTab = 'settings'; render(); });

  scanBtn.addEventListener('click', () => {
    if (busyScan || busyClaim) return;
    activeTab = 'games';
    render();
    void fullScan();
  });
  scanBtn.addEventListener('mouseenter', () => {
    if (busyScan || busyClaim) return;
    scanBtn.style.background = 'rgba(255,255,255,0.10)';
    scanBtn.style.color      = 'rgba(255,255,255,0.95)';
  });
  scanBtn.addEventListener('mouseleave', () => {
    scanBtn.style.background = 'rgba(255,255,255,0.06)';
    scanBtn.style.color      = 'rgba(255,255,255,0.75)';
  });

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function setOpen(next: boolean) {
    opened = next;

    if (next) {
      loadWidgetSettingsIPC()
        .then((raw) => {
          try {
            const w = JSON.parse(raw || '{}');
            if (w.tabColor)                                  cfg.tabColor    = w.tabColor;
            if (w.showOverlay !== undefined)                 cfg.showOverlay = w.showOverlay;
            if (w.panelSide === 'left' || w.panelSide === 'right') cfg.panelSide = w.panelSide;
            if (w.tabStyle === 'slim' || w.tabStyle === 'large' || w.tabStyle === 'floating') {
              cfg.tabStyle = w.tabStyle;
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

    arrowEl.setAttribute('points', arrowPoints(isLeft, opened));

    if (next && !busyScan) void fullScan();
  }

  function applyChrome() {
    palette = getTabColor(cfg.tabColor);
    isLeft  = cfg.panelSide === 'left';
    geom    = tabSize(cfg.tabStyle);
    pOff    = cfg.tabStyle === 'floating' ? geom.off + geom.w + 4 : geom.w;

    tabBtn.style.width        = geom.w + 'px';
    tabBtn.style.height       = geom.h + 'px';
    tabBtn.style.borderRadius = tabRadius(cfg.tabStyle, isLeft);
    tabBtn.style.background   = opened ? palette.bgHover : palette.bg;
    tabBtn.style.boxShadow    = cfg.tabStyle === 'floating'
      ? '0 6px 20px rgba(0,0,0,0.45)'
      : 'none';
    tabBtn.style.transition   = `left 0.3s ${SMOOTH}, right 0.3s ${SMOOTH}, background 0.15s`;

    const slideOff = opened ? pOff + PANEL_RIGHT_OFFSET_WHEN_OPEN : geom.off;
    if (isLeft) {
      tabBtn.style.right = '';
      tabBtn.style.left  = slideOff + 'px';
    } else {
      tabBtn.style.left  = '';
      tabBtn.style.right = slideOff + 'px';
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
    dim.style.display = opened && cfg.showOverlay ? 'block' : 'none';
    render();
  }

  tabBtn.addEventListener('click', () => setOpen(!opened));
  dim.addEventListener('click',    () => setOpen(false));
  $<HTMLButtonElement>('#fgg-close')?.addEventListener('click', () => setOpen(false));
  applyChrome();

  root.appendChild(dim);
  root.appendChild(panel);
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

          if (changed) applyChrome();
        } catch {}
      })
      .catch(() => {});
  }, 2000);

  void softRefresh();
  const cachePoll = setInterval(() => { void softRefresh(); }, 30000);

  window.addEventListener('beforeunload', () => {
    clearInterval(settingsPoll);
    clearInterval(cachePoll);
    if (hideTimer) clearTimeout(hideTimer);
  }, { once: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function panelMarkup(): string {
  return `
    <style>
      @keyframes fgg-spin{to{transform:rotate(360deg)}}
      @keyframes fgg-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
      @keyframes fgg-fade-in{0%{opacity:0;transform:translateY(4px)}100%{opacity:1;transform:translateY(0)}}
      @keyframes fgg-pulse{0%,100%{opacity:.6}50%{opacity:1}}
      @keyframes fgg-glow{0%,100%{box-shadow:0 0 8px rgba(255,255,255,0.3)}50%{box-shadow:0 0 14px rgba(255,255,255,0.5)}}
      .fgg-card{animation:fgg-fade-in .25s ease both}
      .fgg-skel{background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 100%);background-size:200% 100%;animation:fgg-shimmer 1.4s ease-in-out infinite;border-radius:12px;height:68px}
      #fgg-body::-webkit-scrollbar{width:6px}
      #fgg-body::-webkit-scrollbar-track{background:transparent;margin:6px 0}
      #fgg-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px;transition:background 0.15s}
      #fgg-body::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.25)}
      #fgg-body{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent}
    </style>
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#1a1a1a 0%,#0e0e0e 100%);">
      <div style="display:flex;align-items:center;gap:11px;">
        <div style="width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;border:1px solid rgba(255,255,255,0.08);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 7v14"></path>
            <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path>
            <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"></path>
            <rect x="3" y="7" width="18" height="4" rx="1"></rect>
          </svg>
        </div>
        <div>
          <div style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.01em;">Auto Claim</div>
          <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px;">Silent auto-claim · 100% off</div>
        </div>
      </div>
      <button id="fgg-close" style="background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:18px;line-height:1;padding:4px 8px;border-radius:6px;">✕</button>
    </div>
    <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.08);position:relative;">
      <button id="fgg-tab-games" style="flex:1;padding:11px 4px;background:none;border:none;color:rgba(255,255,255,0.92);font-size:11px;font-weight:700;letter-spacing:.05em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:color 0.2s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 7v14"></path>
          <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path>
          <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"></path>
          <rect x="3" y="7" width="18" height="4" rx="1"></rect>
        </svg>
        <span>FREE GAMES</span>
      </button>
      <button id="fgg-tab-settings" style="flex:1;padding:11px 4px;background:none;border:none;color:rgba(255,255,255,0.35);font-size:11px;font-weight:700;letter-spacing:.05em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:color 0.2s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051 2.34 2.34 0 0 0 9.67 4.136"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>SETTINGS</span>
      </button>
      <div id="fgg-tab-indicator" style="position:absolute;bottom:-1px;height:2px;left:0;width:50%;background:linear-gradient(90deg,rgba(255,255,255,0.95),rgba(255,255,255,0.5));box-shadow:0 0 8px rgba(255,255,255,0.25);transition:left 0.25s ${SMOOTH};"></div>
    </div>
    <div id="fgg-body" style="padding:14px 16px;display:flex;flex-direction:column;gap:0;max-height:360px;overflow-y:auto;overflow-x:hidden;"></div>
    <div style="padding:9px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(0,0,0,0.25);">
      <div style="display:flex;align-items:center;gap:8px;min-width:0;">
        <div id="fgg-footer-dot" style="width:6px;height:6px;border-radius:50%;background:#55cc55;box-shadow:0 0 6px #55cc55;flex-shrink:0;"></div>
        <span id="fgg-footer" style="font-size:11px;color:rgba(255,255,255,0.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Active · every ${cfg.pollIntervalMin} min</span>
      </div>
      <button id="fgg-scan-now" style="padding:5px 10px;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.75);font-size:10px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;flex-shrink:0;letter-spacing:.03em;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>
        Scan
      </button>
    </div>
  `;
}


function renderGames(
  bodyEl: HTMLElement,
  games: FreeGame[],
  ownedSet: Set<number>,
  scanning: boolean,
  claiming: boolean,
  claimingAppid: number,
): void {
  if (scanning) {
    bodyEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">
        <div class="fgg-skel" style="width:38px;height:38px;border-radius:10px;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <div class="fgg-skel" style="height:11px;width:70%;border-radius:4px;"></div>
          <div class="fgg-skel" style="height:9px;width:50%;border-radius:4px;"></div>
        </div>
        <div class="fgg-skel" style="width:46px;height:38px;border-radius:10px;"></div>
      </div>
      <div class="fgg-skel" style="margin-bottom:8px;"></div>
      <div class="fgg-skel" style="margin-bottom:8px;opacity:0.7;"></div>
      <div class="fgg-skel" style="opacity:0.5;"></div>
    `;
    return;
  }

  if (games.length === 0) {
    bodyEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 16px;gap:10px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 7v14"></path>
            <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path>
            <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"></path>
            <rect x="3" y="7" width="18" height="4" rx="1"></rect>
          </svg>
        </div>
        <div style="color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;">All caught up</div>
        <div style="color:rgba(255,255,255,0.35);font-size:11px;line-height:1.5;">No free games detected right now.<br/>Next scan in ${cfg.pollIntervalMin} min.</div>
      </div>
    `;
    return;
  }

  bodyEl.innerHTML = games.slice(0, 8).map((g) => buildCard(g, ownedSet, claiming, claimingAppid)).join('');

  bodyEl.querySelectorAll<HTMLElement>('.fgg-card').forEach((card) => {
    card.addEventListener('mouseenter', () => {
      card.style.transform   = 'translateY(-1px)';
      card.style.borderColor = 'rgba(255,255,255,0.18)';
      card.style.boxShadow   = '0 6px 18px rgba(0,0,0,0.4)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform   = '';
      card.style.borderColor = 'rgba(255,255,255,0.08)';
      card.style.boxShadow   = '';
    });
  });

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-open-app]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-open-app');
      if (id) location.href = `https://store.steampowered.com/app/${id}/`;
    });
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

  const accent    = owned ? 'rgba(85,204,85,0.35)' : isClaim ? 'rgba(255,255,255,0.6)'  : 'rgba(255,255,255,0.28)';
  const dotColor  = owned ? '#55cc55'              : 'rgba(255,255,255,0.7)';
  const status    = owned ? 'Owned · in your library' : isClaim ? 'Claiming silently…' : '100% off · pending';
  const cardEdge  = owned ? 'rgba(85,204,85,0.18)' : isClaim ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
  const cardGlow  = isClaim ? '0 0 16px rgba(255,255,255,0.10)' : '';

  let trailing: string;
  if (owned) {
    trailing = `<div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:rgba(85,204,85,0.15);border:1px solid rgba(85,204,85,0.4);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#55cc55" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
    </div>`;
  } else if (isClaim) {
    trailing = `<div style="flex-shrink:0;width:24px;height:24px;border:2px solid rgba(255,255,255,0.12);border-top-color:rgba(255,255,255,0.85);border-radius:50%;animation:fgg-spin 0.8s linear infinite;"></div>`;
  } else {
    trailing = `<button data-open-app="${g.appid}" style="padding:6px 13px;font-size:11px;font-weight:600;border-radius:20px;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.95);cursor:pointer;flex-shrink:0;">Open</button>`;
  }

  return `
    <div class="fgg-card" data-owned="${owned ? 1 : 0}" data-claiming="${isClaim ? 1 : 0}" style="position:relative;overflow:hidden;border-radius:12px;border:1px solid ${cardEdge};margin-bottom:8px;background:#0f0f0f;transition:transform 0.15s ease,border-color 0.15s ease,box-shadow 0.15s ease;box-shadow:${cardGlow};">
      <div style="position:relative;height:68px;overflow:hidden;">
        <img src="https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/library_hero.jpg"
             onerror="this.onerror=null;this.src='https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/page_bg_generated_v6b.jpg'"
             style="width:100%;height:100%;object-fit:cover;object-position:center 30%;filter:brightness(0.55) saturate(1.1);"/>
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,15,15,0.92) 0%,rgba(15,15,15,0.55) 45%,rgba(15,15,15,0.15) 100%);"></div>
        <div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:${accent};${isClaim ? 'animation:fgg-pulse 1.2s ease-in-out infinite;' : ''}"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;gap:12px;padding:0 14px 0 16px;">
          <img src="https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg"
               style="width:64px;height:30px;object-fit:cover;border-radius:6px;flex-shrink:0;box-shadow:0 4px 14px rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.08);"/>
          <div style="flex:1;min-width:0;">
            <div style="color:#fff;font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.01em;">${g.name}</div>
            <div style="color:rgba(255,255,255,0.55);font-size:10px;margin-top:3px;display:flex;align-items:center;gap:6px;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor}88;${isClaim ? 'animation:fgg-pulse 1s ease-in-out infinite;' : ''}"></span>
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
): void {
  const onGrad  = 'linear-gradient(135deg,#55cc55,#2a8a2a)';
  const offBg   = 'rgba(255,255,255,0.15)';

  const toggleHtml = (id: string, value: boolean) =>
    `<button id="${id}" style="width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;background:${value ? onGrad : offBg};transition:background 0.22s ease;">
      <span style="position:absolute;top:4px;left:${value ? '24px' : '4px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left 0.22s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 1px 3px rgba(0,0,0,0.3);"></span>
    </button>`;

  bodyEl.innerHTML = `
    <div style="padding:10px 12px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
      <div style="color:rgba(255,255,255,0.3);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">Widget appearance</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;line-height:1.5;">Change button color, side and style in the <strong style="color:rgba(255,255,255,0.6);">Steam plugin settings</strong> panel.</div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:500;">Auto-add to library</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:3px;">Grab games automatically on scan</div>
      </div>
      ${toggleHtml('fgg-autoadd', cfg.autoAdd)}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:500;">Notify on grab</div>
        <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:3px;">Show toast when a game is added to library</div>
      </div>
      ${toggleHtml('fgg-notifygrab', cfg.notifyOnGrab)}
    </div>
    <div style="padding:10px 0;border-top:1px solid rgba(255,255,255,0.06);">
      <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:500;margin-bottom:3px;">Scan interval</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-bottom:8px;">How often to check for free games</div>
      <div style="display:flex;gap:6px;">
        ${[15, 30, 60].map((m) => {
          const sel = cfg.pollIntervalMin === m;
          return `<button data-interval="${m}" style="flex:1;padding:7px 0;border-radius:6px;border:none;cursor:pointer;font-size:12px;font-weight:${sel ? 700 : 400};background:${sel ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'};color:${sel ? '#fff' : 'rgba(255,255,255,0.5)'};">${m} min</button>`;
        }).join('')}
      </div>
    </div>
  `;

  function animateToggle(btn: HTMLButtonElement, on: boolean) {
    btn.style.background = on ? onGrad : offBg;
    const knob = btn.querySelector<HTMLElement>('span');
    if (knob) knob.style.left = on ? '24px' : '4px';
  }

  bodyEl.querySelector<HTMLButtonElement>('#fgg-autoadd')?.addEventListener('click', (e) => {
    cfg.autoAdd = !cfg.autoAdd;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.autoAdd);
    persistAndRefresh();
  });

  bodyEl.querySelector<HTMLButtonElement>('#fgg-notifygrab')?.addEventListener('click', (e) => {
    cfg.notifyOnGrab = !cfg.notifyOnGrab;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.notifyOnGrab);
    persistAndRefresh();
  });

  bodyEl.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((el) => {
    el.addEventListener('click', () => {
      const next = parseInt(el.getAttribute('data-interval') || '30', 10);
      cfg.pollIntervalMin = next;
      persistAndRefresh();
      rerender();
    });
  });
}
