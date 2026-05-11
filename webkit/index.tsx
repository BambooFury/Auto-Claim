import { initSettingsFromLua } from './settings';
import { showWelcomeIfFirstTime } from './welcome-modal';
import { injectVanillaWidget } from './widget-vanilla';

const STORE_HOST = 'store.steampowered.com';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isStorefront(): boolean {
  if (location.hostname !== STORE_HOST) return false;
  const p = location.pathname;
  return p === '' || p === '/' ||
         p.indexOf('/featured') === 0 ||
         p.indexOf('/explore')  === 0;
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
  if (!isStorefront()) return;
  await handleStorefront();
}
