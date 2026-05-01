import { loadFreeGamesCacheIPC, loadWidgetSettingsIPC } from './ipc';
import { cfg, initialWidgetRaw, saveSettings } from './settings';
import { getTabColor } from './tab-colors';
import { injectVanillaWidget } from './widget-vanilla';
import type { FreeGame, PanelSide, TabStyle } from './types';

const ROOT_ID = 'fgg-widget-root';
const PANEL_W = 340;
const SMOOTH  = 'cubic-bezier(0.4,0,0.2,1)';
function arrowPoints(isLeft: boolean, opened: boolean): string {
  if (isLeft)  return opened ? '7,2 3,7 7,12' : '3,2 7,7 3,12';
  return opened ? '3,2 7,7 3,12' : '7,2 3,7 7,12';
}

function tabGeom(style: TabStyle): { w: number; h: number; off: number } {
  if (style === 'slim')     return { w: 20, h: 48, off: 0 };
  if (style === 'floating') return { w: 26, h: 56, off: 8 };
  return { w: 28, h: 64, off: 0 };
}

function tabRadius(style: TabStyle, isLeft: boolean): string {
  if (style === 'floating') return '8px';
  return isLeft ? '0 6px 6px 0' : '6px 0 0 6px';
}

function panelRadius(style: TabStyle, isLeft: boolean): string {
  if (style === 'floating') return '12px';
  return isLeft ? '0 12px 12px 0' : '12px 0 0 12px';
}

export function injectReactWidget(): void {
  if (document.getElementById(ROOT_ID)) return;

  const react = (window as any).SP_REACT as typeof import('react') | undefined;
  if (!react) {
    injectVanillaWidget();
    return;
  }

  const h = react.createElement.bind(react);

  type ToggleProps = { value: boolean; onChange: (v: boolean) => void };

  function Toggle({ value, onChange }: ToggleProps) {
    return h('button',
      {
        onClick: () => onChange(!value),
        style: {
          width: 44, height: 24, borderRadius: 12, border: 'none',
          cursor: 'pointer', flexShrink: 0,
          background: value
            ? 'linear-gradient(135deg,#55cc55,#2a8a2a)'
            : 'rgba(255,255,255,0.15)',
          position: 'relative', transition: 'background 0.2s',
        },
      },
      h('span', {
        style: {
          position: 'absolute', top: 4, width: 16, height: 16,
          borderRadius: '50%', background: 'white',
          transition: 'left 0.2s',
          left: value ? 24 : 4,
        },
      }),
    );
  }

  type RowProps = {
    title: string; desc: string; first?: boolean; children: any;
  };

  function Row({ title, desc, first, children }: RowProps) {
    return h('div',
      {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0',
          borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.06)',
        },
      },
      h('div', null,
        h('div', { style: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 } }, title),
        h('div', { style: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 3 } }, desc),
      ),
      children,
    );
  }

  const FreeGameWidget = () => {
    const [opened,        setOpened]        = react.useState(false);
    const [tabColor,      setTabColor]      = react.useState(cfg.tabColor);
    const [_accentColor,  setAccentColor]   = react.useState(cfg.accentColor || 'rgba(255,255,255,0.5)');
    const [showOverlay,   setShowOverlay]   = react.useState(cfg.showOverlay);
    const [panelSide,     setPanelSide]     = react.useState<PanelSide>(cfg.panelSide);
    const [tabStyle,      setTabStyle]      = react.useState<TabStyle>(cfg.tabStyle);

    const [autoAdd,       setAutoAdd]       = react.useState(cfg.autoAdd);
    const [notifyOnGrab,  setNotifyOnGrab]  = react.useState(cfg.notifyOnGrab);

    const [games,         setGames]         = react.useState<FreeGame[]>([]);
    const [grabbed,       setGrabbed]       = react.useState<FreeGame[]>([]);
    const [ownedIds,      setOwnedIds]      = react.useState<Set<number>>(new Set());
    const [scanning,      setScanning]      = react.useState(false);

    react.useEffect(() => {
      try {
        const raw = localStorage.getItem('fgg_grabbed_cache') || '[]';
        setGrabbed(JSON.parse(raw));
      } catch {}
    }, []);

    function applyWidgetJson(raw: string) {
      try {
        const w = JSON.parse(raw || '{}');
        if (w.tabColor) {
          cfg.tabColor = w.tabColor;
          setTabColor(w.tabColor);
        }
        if (w.accentColor) {
          cfg.accentColor = w.accentColor;
          setAccentColor(w.accentColor);
        }
        if (w.showOverlay !== undefined) {
          cfg.showOverlay = w.showOverlay;
          setShowOverlay(w.showOverlay);
        }
        if (w.panelSide === 'left' || w.panelSide === 'right') {
          cfg.panelSide = w.panelSide;
          setPanelSide(w.panelSide);
        }
        const okStyle = w.tabStyle === 'slim' || w.tabStyle === 'large' || w.tabStyle === 'floating';
        if (okStyle) {
          cfg.tabStyle = w.tabStyle;
          setTabStyle(w.tabStyle);
        }
      } catch {}
    }

    react.useEffect(() => {
      if (!opened) return;
      if (!scanning) void scan();
      loadWidgetSettingsIPC().then(applyWidgetJson).catch(() => {});
    }, [opened]);

    react.useEffect(() => {
      let lastJson = initialWidgetRaw;
      const tick = () => {
        loadWidgetSettingsIPC().then((raw) => {
          if (raw === lastJson) return;
          lastJson = raw;
          applyWidgetJson(raw);
        }).catch(() => {});
      };
      const id = setInterval(tick, 2000);
      return () => clearInterval(id);
    }, []);

    react.useEffect(() => {
      let lastCache = '';
      const refresh = () => {
        loadFreeGamesCacheIPC().then((raw: string) => {
          if (raw === lastCache) return;
          lastCache = raw;
          try { setGames(JSON.parse(raw || '[]')); }
          catch {}
        }).catch(() => {});
      };
      refresh();
      const id = setInterval(refresh, 30000);
      return () => clearInterval(id);
    }, []);

    type Patch = {
      tabColor?: string;
      showOverlay?: boolean;
      panelSide?: PanelSide;
      tabStyle?: TabStyle;
      autoAdd?: boolean;
      notifyOnGrab?: boolean;
    };
    const update = (p: Patch) => {
      if (p.tabColor !== undefined)     { cfg.tabColor    = p.tabColor;    setTabColor(p.tabColor); }
      if (p.showOverlay !== undefined)  { cfg.showOverlay = p.showOverlay; setShowOverlay(p.showOverlay); }
      if (p.panelSide !== undefined)    { cfg.panelSide   = p.panelSide;   setPanelSide(p.panelSide); }
      if (p.tabStyle !== undefined)     { cfg.tabStyle    = p.tabStyle;    setTabStyle(p.tabStyle); }
      if (p.autoAdd !== undefined)      { cfg.autoAdd     = p.autoAdd;     setAutoAdd(p.autoAdd); }
      if (p.notifyOnGrab !== undefined) { cfg.notifyOnGrab = p.notifyOnGrab; setNotifyOnGrab(p.notifyOnGrab); }
      saveSettings();
    };

    const tc       = getTabColor(tabColor);
    const isLeft   = panelSide === 'left';
    const geom     = tabGeom(tabStyle);
    const pOff     = tabStyle === 'floating' ? geom.off + geom.w + 4 : geom.w;
    const tabBorder= tabRadius(tabStyle, isLeft);
    const panBorder= panelRadius(tabStyle, isLeft);

    const tabPos: any = isLeft
      ? { left:  opened ? pOff + PANEL_W + 1 : geom.off }
      : { right: opened ? pOff + PANEL_W + 1 : geom.off };
    const panPos: any = isLeft ? { left: pOff } : { right: pOff };
    const slideX = opened ? '0' : isLeft ? '-110%' : '110%';

    async function scan(): Promise<void> {
      setScanning(true);
      try {
        const rawCache = await loadFreeGamesCacheIPC();
        const list: FreeGame[] = JSON.parse(rawCache || '[]');
        setGames(list);

        if (list.length > 0) {
          try {
            const ids   = list.map((g) => g.appid).join(',');
            const url   = `https://store.steampowered.com/api/appuserdetails/?appids=${ids}&cc=us`;
            const res   = await fetch(url, { credentials: 'include' });
            const data: any = await res.json();
            const owned = new Set<number>();
            const appStore = (window as any).appStore;

            for (const g of list) {
              const remote = data && data[g.appid];
              if (remote && remote.success && remote.data && remote.data.is_owned) {
                owned.add(g.appid);
                continue;
              }
              if (appStore && typeof appStore.GetAppOverviewByAppID === 'function') {
                const ov = appStore.GetAppOverviewByAppID(g.appid);
                if (ov && (ov.local_per_client_data || ov.appid)) {
                  owned.add(g.appid);
                }
              }
            }
            setOwnedIds(owned);
          } catch {}
        }
      } catch {}
      setScanning(false);
    }

    let statusText: string;
    let statusClr:  string;
    if (scanning) {
      statusText = 'Scanning Steam Store...';
      statusClr  = 'rgba(255,255,255,0.85)';
    } else if (games.length > 0) {
      statusText = `${games.length} free game(s) found`;
      statusClr  = '#55cc55';
    } else {
      statusText = 'Idle';
      statusClr  = 'rgba(255,255,255,0.35)';
    }
    const sideTab = h('button',
      {
        onClick: () => setOpened((o: boolean) => !o),
        style: {
          position: 'fixed', top: '65%', ...tabPos,
          transform: 'translateY(-50%)',
          width: geom.w, height: geom.h, borderRadius: tabBorder,
          border: '1px solid rgba(255,255,255,0.14)',
          cursor: 'pointer', zIndex: 2147483000,
          background: opened ? tc.bgHover : tc.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'none',
          transition: `${isLeft ? 'left' : 'right'} 0.25s ${SMOOTH}, background 0.15s`,
        },
      },
      h('svg', { width: 10, height: 14, viewBox: '0 0 10 14', fill: 'none' },
        h('polyline', {
          points:         arrowPoints(isLeft, opened),
          stroke:         tc.arrow,
          strokeWidth:    '2',
          strokeLinecap:  'round',
          strokeLinejoin: 'round',
        }),
      ),
    );

    const header = h('div',
      { style: {
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#1a1a1a',
      } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        h('svg', {
          width: 20, height: 20, viewBox: '0 0 24 24',
          fill: 'none', stroke: '#aaa', strokeWidth: '2',
          strokeLinecap: 'round', strokeLinejoin: 'round',
        },
          h('path', { d: 'M12 7v14' }),
          h('path', { d: 'M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8' }),
          h('path', { d: 'M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5' }),
          h('rect', { x: '3', y: '7', width: '18', height: '4', rx: '1' }),
        ),
        h('span', { style: { color: 'white', fontSize: 15, fontWeight: 700 } }, 'Auto Claim'),
      ),
      h('button',
        {
          onClick: () => setOpened(false),
          style: {
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 18,
          },
        },
        '✕',
      ),
    );

    let bodyContent: any;
    if (scanning) {
      bodyContent = h('div',
        { style: {
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 0', gap: 10,
        } },
        h('div', { style: {
          width: 28, height: 28,
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: 'rgba(255,255,255,0.85)',
          borderRadius: '50%',
          animation: 'fgg-spin 0.8s linear infinite',
        } }),
        h('div', { style: { color: 'rgba(255,255,255,0.4)', fontSize: 12 } }, 'Scanning Steam Store...'),
      );
    } else if (games.length === 0) {
      bodyContent = h('div',
        { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 8 } },
        h('div', { style: { fontSize: 28, opacity: 0.3 } }, '🎮'),
        h('div', { style: { color: 'rgba(255,255,255,0.25)', fontSize: 12 } }, 'No free games right now'),
        h('div', { style: { color: 'rgba(255,255,255,0.15)', fontSize: 10 } }, `Next scan in ${cfg.pollIntervalMin} min`),
      );
    } else {
      bodyContent = h('div',
        { style: { display: 'flex', flexDirection: 'column', gap: 0 } },
        ...games.slice(0, 8).map((g) => {
          const owned  = ownedIds.has(g.appid);
          const accent = owned ? 'rgba(85,204,85,0.35)' : 'rgba(255,255,255,0.28)';
          const dot    = owned ? '#55cc55' : 'rgba(255,255,255,0.7)';
          const dotShadow = owned ? '#55cc5588' : 'rgba(255,255,255,0.3)';

          const trailing = owned
            ? h('div',
                { style: {
                  flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(85,204,85,0.15)',
                  border: '1px solid rgba(85,204,85,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                } },
                h('svg', {
                  width: 14, height: 14, viewBox: '0 0 24 24',
                  fill: 'none', stroke: '#55cc55', strokeWidth: '3',
                  strokeLinecap: 'round', strokeLinejoin: 'round',
                }, h('path', { d: 'M20 6 9 17l-5-5' })),
              )
            : h('button',
                {
                  onClick: () => { location.href = `https://store.steampowered.com/app/${g.appid}/`; },
                  style: {
                    padding: '6px 13px', fontSize: 11, fontWeight: 600,
                    borderRadius: 20, background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.95)', cursor: 'pointer', flexShrink: 0,
                  },
                },
                'Open',
              );

          return h('div',
            {
              key: g.appid,
              style: {
                position: 'relative', overflow: 'hidden',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 8, background: '#0f0f0f', cursor: 'default',
              },
            },
            h('div', { style: { position: 'relative', height: 68, overflow: 'hidden' } },
              h('img', {
                src: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/library_hero.jpg`,
                onError: (e: any) => {
                  e.target.src = `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/page_bg_generated_v6b.jpg`;
                },
                style: {
                  width: '100%', height: '100%', objectFit: 'cover',
                  objectPosition: 'center 30%',
                  filter: 'brightness(0.55) saturate(1.1)',
                },
              }),
              h('div', { style: {
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg,rgba(15,15,15,0.92) 0%,rgba(15,15,15,0.55) 45%,rgba(15,15,15,0.15) 100%)',
              } }),
              h('div', { style: {
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 3, background: accent,
              } }),
              h('div', { style: {
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '0 14px 0 16px',
              } },
                h('img', {
                  src: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
                  style: {
                    width: 64, height: 30, objectFit: 'cover',
                    borderRadius: 6, flexShrink: 0,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.65)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  },
                }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: {
                    color: '#fff', fontSize: 12.5, fontWeight: 700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    letterSpacing: '0.01em',
                  } }, g.name),
                  h('div', { style: {
                    color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 3,
                    display: 'flex', alignItems: 'center', gap: 6,
                  } },
                    h('span', { style: {
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: dot, boxShadow: `0 0 6px ${dotShadow}`,
                    } }),
                    owned ? 'Owned · in your library' : '100% off · auto-claiming',
                  ),
                ),
                trailing,
              ),
            ),
          );
        }),
      );
    }

    const statusRow = h('div',
      { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        h('div', { style: { width: 6, height: 6, borderRadius: '50%', background: statusClr, flexShrink: 0 } }),
        h('span', { style: { color: 'rgba(255,255,255,0.7)', fontSize: 12 } }, statusText),
      ),
      h('span', { style: { color: 'rgba(255,255,255,0.35)', fontSize: 10 } }, `${grabbed.length} grabbed`),
    );

    const appearanceHint = h('div',
      { style: {
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 4,
      } },
      h('div', { style: {
        color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700,
        letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4,
      } }, 'Widget appearance'),
      h('div', { style: { color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.5 } },
        'Change button color, side and style in the ',
        h('strong', { style: { color: 'rgba(255,255,255,0.6)' } }, 'Steam plugin settings'),
        ' panel.',
      ),
    );

    const autoAddRow = h(Row,
      { title: 'Auto-add to library', desc: 'Grab games automatically on scan', first: true },
      h(Toggle, { value: autoAdd, onChange: (v: boolean) => update({ autoAdd: v }) }),
    );

    const notifyRow = h(Row,
      { title: 'Notify on grab', desc: 'Show toast when a game is added to library' },
      h(Toggle, { value: notifyOnGrab, onChange: (v: boolean) => update({ notifyOnGrab: v }) }),
    );

    const panel = h('div',
      { style: {
        position: 'fixed', top: '65%', ...panPos,
        transform: `translateY(-50%) translateX(${slideX})`,
        zIndex: 999, width: PANEL_W,
        background: '#0d0d0d',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: panBorder,
        overflow: 'hidden',
        transition: `transform 0.25s ${SMOOTH}`,
        pointerEvents: opened ? 'all' : 'none',
        visibility: opened || tabStyle !== 'floating' ? 'visible' : 'hidden',
      } },
      header,
      h('div',
        { style: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 } },
        h('div', null, bodyContent),
        statusRow,
        appearanceHint,
        autoAddRow,
        notifyRow,
      ),
    );

    const overlay = (opened && showOverlay)
      ? h('div', {
          onClick: () => setOpened(false),
          style: { position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.4)' },
        })
      : null;

    return h(react.Fragment, null, sideTab, panel, overlay);
  };

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.style.userSelect = 'none';
  (root.style as any).webkitUserSelect = 'none';
  document.body.appendChild(root);

  const rdom = (window as any).SP_REACTDOM || (window as any).ReactDOM;
  if (rdom && typeof rdom.createRoot === 'function') {
    rdom.createRoot(root).render(react.createElement(FreeGameWidget));
    return;
  }
  if (rdom && typeof rdom.render === 'function') {
    rdom.render(react.createElement(FreeGameWidget), root);
    return;
  }

  root.remove();
  setTimeout(injectReactWidget, 500);
}
