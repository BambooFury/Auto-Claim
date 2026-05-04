import { saveCookiesIPC } from './ipc';

const STORE_HOST = 'store.steampowered.com';
export function captureCookiesToBackend(): void {
  if (location.hostname !== STORE_HOST) return;

  const jar: Record<string, string> = {};
  try {
    const raw = document.cookie || '';
    if (!raw) return;

    raw.split(/;\s*/).forEach((piece) => {
      const i = piece.indexOf('=');
      if (i < 0) return;
      const name  = piece.slice(0, i).trim();
      const value = piece.slice(i + 1).trim();
      if (name) jar[name] = value;
    });

    if (!jar.sessionid) {
      const w = window as any;
      if (typeof w.g_sessionID === 'string' && w.g_sessionID) {
        jar.sessionid = w.g_sessionID;
      }
    }

    if (!jar.sessionid) return;
    if (!jar.steamLoginSecure || jar.steamLoginSecure.length < 40) return;

    const payload = JSON.stringify(jar);
    try {
      if (localStorage.getItem('fgg_last_cookies') === payload) return;
      localStorage.setItem('fgg_last_cookies', payload);
    } catch {}
    saveCookiesIPC({ payload }).catch(() => {});
  } catch {}
}
