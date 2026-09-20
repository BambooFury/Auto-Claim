import { callable } from 'millennium';
import type { GrabbedEntry } from './config';
import { getOwnership, isAppOwned as getIsAppOwned } from './ownership';

type StrIn = [{ payload: string }];
type Empty = [];

export const loadGrabbedIPC = callable<Empty, string>('load_grabbed_ipc');
export const saveGrabbedIPC = callable<StrIn, number>('save_grabbed_ipc');
export const loadSettingsIPC = callable<Empty, string>('load_settings_ipc');
export const saveSettingsIPC = callable<StrIn, number>('save_settings_ipc');
export const loadFreeGamesCacheIPC = callable<Empty, string>('load_free_games_cache_ipc');
export const saveFreeGamesCacheIPC = callable<StrIn, number>('save_free_games_cache_ipc');
export const loadFreeWeekendCacheIPC = callable<Empty, string>('load_free_weekend_cache_ipc');
export const saveFreeWeekendCacheIPC = callable<StrIn, number>('save_free_weekend_cache_ipc');
export const loadLastDailyScanIPC = callable<Empty, string>('load_last_daily_scan_ipc');
export const saveLastDailyScanIPC = callable<StrIn, number>('save_last_daily_scan_ipc');
export const logIPC = callable<StrIn, number>('log_plugin');
export const setCurrentSteamIdIPC = callable<StrIn, number>('set_current_steamid_ipc');
export const tryAcquireClaimLockIPC = callable<StrIn, number>('try_acquire_claim_lock_ipc');
export const releaseClaimLockIPC = callable<StrIn, number>('release_claim_lock_ipc');
export const fetchUrlViaCurlIPC = callable<StrIn, string>('fetch_url_via_curl_ipc');

export function isAlreadyInLibrary(appid: number): boolean {
  try {
    const store = (window as any).appStore;
    const overview = store?.GetAppOverviewByAppID?.(appid);
    if (!overview) return false;
    if (overview.installed === true) return true;
    const lpcd = overview.local_per_client_data;
    if (lpcd) {
      if (lpcd.is_owned === true) return true;
      if (lpcd.installed === true) return true;
    }
    if (Array.isArray(overview.licenses) && overview.licenses.length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

export async function checkLibraryOwnership(appids: number[]): Promise<Set<number> | null> {
  const map = await getOwnership(appids);
  if (map === null) return null;

  const owned = new Set<number>();
  for (const [id, isOwned] of map) {
    if (isOwned) owned.add(id);
  }
  return owned;
}

export async function isAppOwned(appid: number, fresh = false): Promise<boolean | null> {
  return getIsAppOwned(appid, fresh);
}

export async function loadOwnedFromGrabbed(): Promise<Set<number>> {
  const owned = new Set<number>();
  try {
    const raw = await loadGrabbedIPC();
    const list: GrabbedEntry[] = JSON.parse(raw || '[]');
    for (const entry of list) {
      if (entry && entry.added === true) owned.add(entry.appid);
    }
  } catch {}
  return owned;
}
