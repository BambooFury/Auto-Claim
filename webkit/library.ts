const APPUSER_URL = 'https://store.steampowered.com/api/appuserdetails/';
const USERDATA_URL = 'https://store.steampowered.com/dynamicstore/userdata/';

export async function checkLibraryAsync(appids: number[]): Promise<Set<number>> {
  const owned = new Set<number>();
  if (appids.length === 0) return owned;

  try {
    const url = APPUSER_URL + '?appids=' + appids.join(',') + '&cc=us';
    const r = await fetch(url, { credentials: 'include' });
    const data: any = await r.json();

    for (const id of appids) {
      const entry = data && data[id];
      if (entry && entry.success && entry.data) {
        if (entry.data.is_owned || entry.data.added_to_package) {
          owned.add(id);
        }
      }
    }
  } catch {}

  const missing = appids.filter((id) => !owned.has(id));
  if (missing.length > 0) {
    try {
      const r = await fetch(USERDATA_URL, { credentials: 'include' });
      const data: any = await r.json();
      if (data && Array.isArray(data.rgOwnedApps)) {
        const ownedApps = new Set<number>(data.rgOwnedApps);
        for (const id of missing) {
          if (ownedApps.has(id)) owned.add(id);
        }
      }
    } catch {}
  }

  return owned;
}
export function isInLibrary(appid: number): boolean {
  try {
    const appStore = (window as any).appStore;
    const fn = appStore && appStore.GetAppOverviewByAppID;
    if (typeof fn !== 'function') return false;
    const ov = fn.call(appStore, appid);
    if (!ov) return false;

    if (ov.installed === true) return true;

    const lpcd = ov.local_per_client_data;
    if (lpcd) {
      if (lpcd.is_owned === true)  return true;
      if (lpcd.installed === true) return true;
      if (lpcd.is_owned !== false) return true;
    }

    if (Array.isArray(ov.licenses) && ov.licenses.length > 0) return true;
  } catch {}

  return false;
}

export function isGameOwned(appid: number, ownedSet: Set<number>): boolean {
  return ownedSet.has(appid) || isInLibrary(appid);
}
