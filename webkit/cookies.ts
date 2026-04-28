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

    saveCookiesIPC({ payload: JSON.stringify(jar) }).catch(() => {});
  } catch {}
}
