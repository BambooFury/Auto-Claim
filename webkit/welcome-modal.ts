const SEEN_FLAG = 'fgg_welcomed_v2';
const sa = 'xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor"';
const sb = 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const SVG_ATTRS = sa + ' ' + sb;
const ico = {
  gift: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="44" height="44">
    <rect x="3" y="8" width="18" height="4" rx="1"/>
    <path d="M12 8v13"/>
    <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>
    <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>
  </svg>`,
  search: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="18" height="18">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>`,
  sparkles: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="18" height="18">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    <path d="M20 3v4"/><path d="M22 5h-4"/>
    <path d="M4 17v2"/><path d="M5 18H3"/>
  </svg>`,
  eye: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="18" height="18">
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  settings: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="18" height="18">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`,
  rocket: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="16" height="16">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>`,
  x: `<svg ${SVG_ATTRS} viewBox="0 0 24 24" width="16" height="16">
    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
  </svg>`,
};

function alreadySeen(): boolean {
  try { return localStorage.getItem(SEEN_FLAG) === '1'; }
  catch { return true; }
}

function markSeen() {
  try { localStorage.setItem(SEEN_FLAG, '1'); } catch {}
}

export function showWelcomeIfFirstTime(): void {
  if (alreadySeen()) return;

  let tries = 0;
  const tryMount = () => {
    if (tries++ > 60) return;
    if (!document.body) {
      setTimeout(tryMount, 250);
      return;
    }
    if (document.getElementById('fgg-welcome-host')) return;
    build();
  };

  setTimeout(tryMount, 1500);
}

function dismiss(root: HTMLDivElement, dlg: HTMLDivElement, dim: HTMLDivElement) {
  markSeen();
  dlg.style.animation = 'fgg-welcome-out 0.18s ease-in forwards';
  dim.style.animation = 'fgg-welcome-fade-out 0.18s ease-in forwards';
  setTimeout(() => { try { root.remove(); } catch (_e) {} }, 220);
}

function build() {
  const root = document.createElement('div');
  root.id = 'fgg-welcome-host';
  root.style.cssText = "all:initial;font-family:'Motiva Sans','Segoe UI',Arial,sans-serif";

  const css = [
    '@keyframes fgg-welcome-fade { from { opacity: 0 } to { opacity: 1 } }',
    '@keyframes fgg-welcome-fade-out { from { opacity: 1 } to { opacity: 0 } }',
    '@keyframes fgg-welcome-pop { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }',
    '@keyframes fgg-welcome-out { from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.96) } }',
    '#fgg-welcome-host { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }',
    '#fgg-welcome-host *, #fgg-welcome-host *::before, #fgg-welcome-host *::after { box-sizing: border-box }',
    '#fgg-welcome-host #fgg-welcome-cta:hover { background: linear-gradient(135deg, rgba(85,204,85,0.30) 0%, rgba(85,204,85,0.20) 100%) !important; border-color: rgba(85,204,85,0.5) !important; }',
    '#fgg-welcome-host #fgg-welcome-cta:active { transform: scale(0.98) !important }',
    '#fgg-welcome-host #fgg-welcome-x:hover { background: rgba(255,255,255,0.10) !important; color: #fff !important; }',
    '#fgg-welcome-host #fgg-welcome-x:active { transform: scale(0.92) !important }',
  ].join('');

  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  root.appendChild(styleEl);

  const dim = document.createElement('div');
  dim.style.cssText =
    'position:fixed;inset:0;z-index:2147483600;' +
    'background:rgba(0,0,0,0.85);' +
    'display:flex;align-items:center;justify-content:center;' +
    'animation:fgg-welcome-fade 0.25s ease-out;' +
    'contain:strict';

  const dlg = document.createElement('div');
  dlg.style.cssText =
    'position:relative;width:440px;max-width:90vw;' +
    'background:linear-gradient(180deg,#161616 0%,#0d0d0d 100%);' +
    'border:1px solid rgba(255,255,255,0.10);' +
    'border-radius:16px;overflow:hidden;' +
    'box-shadow:0 24px 60px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04);' +
    'animation:fgg-welcome-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);' +
    'color:#fff;contain:layout style';

  dlg.innerHTML = `
    <button id="fgg-welcome-x" type="button" aria-label="Close" style="
      position:absolute;top:14px;right:14px;width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      border:none;border-radius:8px;cursor:pointer;
      background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.55);
      font-family:inherit;padding:0;
      transition:background 0.15s,color 0.15s,transform 0.1s;
      z-index:2;
    ">${ico.x}</button>

    <div style="padding:32px 26px 22px;text-align:center;background:radial-gradient(ellipse at top,rgba(85,204,85,0.12) 0%,transparent 60%);">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:18px;background:linear-gradient(135deg,rgba(85,204,85,0.20) 0%,rgba(85,204,85,0.08) 100%);border:1px solid rgba(85,204,85,0.25);color:#7ddc7d;margin-bottom:14px;filter:drop-shadow(0 6px 16px rgba(85,204,85,0.25));">
        ${ico.gift}
      </div>
      <div style="color:#fff;font-size:21px;font-weight:700;margin-bottom:6px;letter-spacing:-0.01em;">Welcome to Auto Claim!</div>
      <div style="color:rgba(255,255,255,0.55);font-size:13px;line-height:1.5;max-width:320px;margin:0 auto;">
        Free Steam games will now land in your library &mdash; automatically.
      </div>
    </div>

    <div style="padding:6px 26px 0;">
      ${row(ico.search,   'Watches the Steam Store',
        'Every 15 minutes the plugin checks for games at 100% off.')}
      ${row(ico.sparkles, 'Adds them silently',
        "Most of the time you won't see anything &mdash; just a small toast saying the game was added.")}
      ${row(ico.eye,      'First time only &mdash; a quick flash',
        "On the very first free game the Steam Store may briefly open and close itself. That's normal &mdash; it's how Steam confirms the giveaway. After that, everything stays invisible.")}
      ${row(ico.settings, 'Fully customizable',
        'Use the side-tab on the storefront, or open Plugin Settings to change the widget style, scan interval, or switch to notify-only mode.')}
    </div>

    <div style="padding:22px 26px 26px;">
      <button id="fgg-welcome-cta" type="button" style="
        width:100%;padding:13px 0;border-radius:10px;
        border:1px solid rgba(85,204,85,0.30);cursor:pointer;
        background:linear-gradient(135deg,rgba(85,204,85,0.20) 0%,rgba(85,204,85,0.12) 100%);
        color:#fff;font-size:14px;font-weight:600;font-family:inherit;
        transition:background 0.15s,border-color 0.15s,transform 0.1s;
        display:inline-flex;align-items:center;justify-content:center;gap:8px;
      ">
        Got it &mdash; start grabbing!
        <span style="display:inline-flex;color:#7ddc7d;">${ico.rocket}</span>
      </button>
      <div style="color:rgba(255,255,255,0.30);font-size:10px;text-align:center;margin-top:12px;">
        This message won't appear again.
      </div>
    </div>
  `;

  dim.appendChild(dlg);
  root.appendChild(dim);
  document.body.appendChild(root);

  function bye() { dismiss(root, dlg, dim); }

  const cta = dlg.querySelector<HTMLButtonElement>('#fgg-welcome-cta');
  const xBtn = dlg.querySelector<HTMLButtonElement>('#fgg-welcome-x');
  if (cta)  cta.addEventListener('click', bye);
  if (xBtn) xBtn.addEventListener('click', bye);

  function escHandler(ev: KeyboardEvent) {
    if (ev.key !== 'Escape') return;
    bye();
    window.removeEventListener('keydown', escHandler);
  }
  window.addEventListener('keydown', escHandler);
}

function row(svg: string, head: string, body: string): string {
  return (
    '<div style="display:flex;gap:14px;align-items:flex-start;padding:11px 0;">' +
      '<div style="flex-shrink:0;width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);">' +
        svg +
      '</div>' +
      '<div style="flex:1;min-width:0;padding-top:1px;">' +
        '<div style="color:#fff;font-size:13px;font-weight:600;margin-bottom:3px;letter-spacing:0.01em;">' + head + '</div>' +
        '<div style="color:rgba(255,255,255,0.55);font-size:12px;line-height:1.55;">' + body + '</div>' +
      '</div>' +
    '</div>'
  );
}
