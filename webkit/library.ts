import type { GrabbedItem } from './types';
const APPUSER_URL = 'https://store.steampowered.com/api/appuserdetails/';
export async function checkLibraryAsync(appids: number[]): Promise<Set<number>> {
  const owned = new Set<number>();
  if (appids.length === 0) return owned;

  try {
    const url = APPUSER_URL + '?appids=' + appids.join(',') + '&cc=us';
    const r = await fetch(url, { credentials: 'include' });
    const data: any = await r.json();

    for (const id of appids) {
      const entry = data && data[id];
      if (entry && entry.success && entry.data && entry.data.is_owned) {
        owned.add(id);
      }
    }
  } catch {
  }
  return owned;
}
export function isInLibrary(appid: number): boolean {
  try {
    const appStore = (window as any).appStore;
    const fn = appStore && appStore.GetAppOverviewByAppID;
    if (typeof fn === 'function') {
      const ov = fn.call(appStore, appid);
      if (ov && (ov.local_per_client_data || ov.appid)) return true;
    }
  } catch {}

  try {
    const raw = localStorage.getItem('fgg_grabbed') || localStorage.getItem('fgg_grabbed_cache');
    if (raw) {
      const arr = JSON.parse(raw) as GrabbedItem[];
      for (const g of arr) {
        if (g.appid === appid && g.added !== false) return true;
      }
    }
  } catch {}

  return false;
}

export function isGameOwned(appid: number, ownedSet: Set<number>): boolean {
  return ownedSet.has(appid) || isInLibrary(appid);
}
