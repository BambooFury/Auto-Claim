import { silentClaim } from './claim';
import { loadFreeGamesCacheIPC, loadWidgetSettingsIPC, pushToastIPC, logIPC } from './ipc';
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
    boxShadow: 'none',
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
  const bodyEl       = $<HTMLElement>('#fgg-body')!;
  const gamesTabBtn  = $<HTMLButtonElement>('#fgg-tab-games')!;
  const setsTabBtn   = $<HTMLButtonElement>('#fgg-tab-settings')!;
  const arrowEl      = tabBtn.querySelector<SVGPolylineElement>('#fgg-arrow')!;

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
        if (cfg.notifyOnGrab) {
          const safe = g.name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          pushToastIPC({ payload: `{"appid":${g.appid},"name":"${safe}"}` })
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
    render();
  }

  async function loadFromCache(autoClaim = true) {
    try {
      const raw = await loadFreeGamesCacheIPC();
      games = JSON.parse(raw || '[]');
    } catch {}

    if (games.length > 0) {
      try { ownedSet = await checkLibraryAsync(games.map((g) => g.appid)); } catch {}
    }

    render();

    if (autoClaim && cfg.autoAdd && games.length > 0) {
      void runAutoClaim();
    }
  }

  async function softRefresh() {
    if (busyClaim) return;
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
    gamesTabBtn.classList.toggle('active', activeTab === 'games');
    setsTabBtn .classList.toggle('active', activeTab === 'settings');
    tabIndicator.style.left = activeTab === 'games' ? '0%' : '50%';

    if (activeTab === 'games') renderGames(bodyEl, games, ownedSet, busyClaim, claimingAppid);
    else                       renderSettings(bodyEl, render, persistAndRefresh);
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
            if (w.tabColor)                                  cfg.tabColor    = w.tabColor;
            if (w.accentColor)                               cfg.accentColor = w.accentColor;
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

    if (next) void loadFromCache();
  }

  function applyChrome() {
    palette = getTabColor(cfg.tabColor);
    isLeft  = cfg.panelSide === 'left';
    geom    = tabSize(cfg.tabStyle);
    pOff    = cfg.tabStyle === 'floating' ? geom.off + geom.w + 4 : geom.w;

    const accent = cfg.accentColor || 'rgba(255,255,255,0.95)';
    panel.style.setProperty('--fgg-tab-accent', accent);
    panel.style.setProperty('--fgg-tab-accent-glow', accent.replace(')', ',0.3)').replace('rgba', 'rgba').replace('rgb(', 'rgba(').replace(',0.3)', ',0.3)'));

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
          if (w.accentColor && w.accentColor !== cfg.accentColor) {
            cfg.accentColor = w.accentColor; changed = true;
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

const PANEL_CSS = `
  @keyframes fgg-spin    { to { transform: rotate(360deg); } }
  @keyframes fgg-fade-in { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes fgg-pulse   { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
  @keyframes fgg-glow    { 0%, 100% { box-shadow: 0 0 8px rgba(255,255,255,0.3); }
                           50%      { box-shadow: 0 0 14px rgba(255,255,255,0.5); } }

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

  #fgg-body {
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 0;
    max-height: 360px;
    overflow-y: auto; overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.12) transparent;
  }
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
      <button id="fgg-tab-games"    class="fgg-tab active">${SVG_GIFT}<span>FREE GAMES</span></button>
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
        <div class="fgg-empty-desc">No free games detected right now.<br/>Next scan in ${cfg.pollIntervalMin} min.</div>
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
        <img class="fgg-card-bg" src="${heroSrc}" onerror="this.onerror=null;this.src='${heroBack}'"/>
        <div class="fgg-card-overlay"></div>
        <div class="fgg-card-accent"></div>
        <div class="fgg-card-content">
          <img class="fgg-card-thumb" src="${headerSrc}"/>
          <div class="fgg-card-text">
            <div class="fgg-card-name">${g.name}</div>
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
): void {
  const toggleHtml = (id: string, value: boolean) =>
    `<button id="${id}" class="fgg-toggle${value ? ' on' : ''}">
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

    <div class="fgg-set-row column">
      <div class="fgg-set-title">Scan interval</div>
      <div class="fgg-set-desc">How often to check for free games</div>
      <div class="fgg-int-btns">${intervalsHtml}</div>
    </div>
  `;

  function animateToggle(btn: HTMLButtonElement, on: boolean) {
    btn.classList.toggle('on', on);
  }

  bodyEl.querySelector<HTMLButtonElement>('#fgg-autoadd')?.addEventListener('click', (e) => {
    cfg.autoAdd = !cfg.autoAdd;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.autoAdd);
    persistAndRefresh();
    logIPC({ payload: `Auto-add toggled: ${cfg.autoAdd ? 'ON' : 'OFF'}` }).catch(() => {});
  });

  bodyEl.querySelector<HTMLButtonElement>('#fgg-notifygrab')?.addEventListener('click', (e) => {
    cfg.notifyOnGrab = !cfg.notifyOnGrab;
    animateToggle(e.currentTarget as HTMLButtonElement, cfg.notifyOnGrab);
    persistAndRefresh();
    logIPC({ payload: `Notify on grab toggled: ${cfg.notifyOnGrab ? 'ON' : 'OFF'}` }).catch(() => {});
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
}
