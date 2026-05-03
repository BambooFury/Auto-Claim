import { captureCookiesToBackend } from './cookies';
import { clearPendingClaimIPC, getPendingClaimIPC } from './ipc';
import { initSettingsFromLua } from './settings';
import { handleAgeCheck, tryClickButton } from './store-actions';
import { showWelcomeIfFirstTime } from './welcome-modal';
import { injectVanillaWidget } from './widget-vanilla';
const STORE_HOST = 'store.steampowered.com';
const APP_PAGE_RE = /\/(?:app|agecheck\/app)\/(\d+)/;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isStorefront(): boolean {
  if (location.hostname !== STORE_HOST) return false;
  const p = location.pathname;
  return p === '' || p === '/' ||
         p.indexOf('/featured') === 0 ||
         p.indexOf('/explore')  === 0;
}

async function readPendingClaim(): Promise<string> {
  try {
    const v = await getPendingClaimIPC();
    return (v || '').trim();
  } catch {
    return '';
  }
}

async function handleAppPage(appid: string): Promise<void> {
  const pending = await readPendingClaim();
  if (pending !== appid) return;
  try { await clearPendingClaimIPC(); } catch {}
  await wait(1500);

  if (location.pathname.indexOf('agecheck') !== -1) {
    await handleAgeCheck();
    return;
  }

  const clicked = await tryClickButton();
  if (clicked) await wait(2500);

  history.back();
}

async function injectWidget(): Promise<void> {
  if (document.getElementById('fgg-widget-root')) return;
  await initSettingsFromLua();
  injectVanillaWidget();
}

async function handleStorefront(): Promise<void> {
  showWelcomeIfFirstTime();

  await wait(800);

  try {
    await injectWidget();
  } catch {
    setTimeout(() => { injectWidget().catch(() => {}); }, 1000);
  }
}

export default async function WebkitMain(): Promise<void> {
  captureCookiesToBackend();

  const m = location.pathname.match(APP_PAGE_RE);
  if (m) {
    await handleAppPage(m[1]);
    return;
  }

  if (!isStorefront()) return;
  await handleStorefront();
}
