import { callable } from 'millennium';

const logIPC = callable<[{ payload: string }], number>('log_plugin');
const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const TTL_MS = 5 * 60 * 1000;

function bounded<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const cached = new Map<number, { owned: boolean; ts: number }>();
let inflight: Promise<Map<number, boolean> | null> | null = null;
let cacheSteamId = '';

export function setOwnershipOwner(sid: string): void {
  if (sid && sid !== cacheSteamId) {
    cached.clear();
    cacheSteamId = sid;
  }
}

async function fetchOwnershipViaStore(appids: number[]): Promise<Map<number, boolean> | null> {
  const owned = new Set<number>();
  const result = new Map<number, boolean>();
  try {
    const url = 'https://store.steampowered.com/api/appuserdetails/?appids=' + appids.join(',') + '&cc=us&_=' + Date.now();
    const r = await bounded(
      fetch(url, { credentials: 'include', cache: 'no-store' }).then((x) => x.json()),
      12000,
      null,
    );
    if (r && typeof r === 'object') {
      for (const id of appids) {
        const e = (r as any)[id];
        if (e && e.success && e.data && (e.data.is_owned || e.data.added_to_package)) {
          owned.add(id);
        }
      }
    }
  } catch (e) {
    log(`ownership: appuserdetails fetch error: ${String(e)}`);
  }

  const missing = appids.filter((id) => !owned.has(id));
  if (missing.length > 0) {
    try {
      const r2 = await bounded(
        fetch('https://store.steampowered.com/dynamicstore/userdata/?_=' + Date.now(), { credentials: 'include', cache: 'no-store' })
          .then((x) => x.json()),
        12000,
        null,
      );
      if (r2 && Array.isArray((r2 as any).rgOwnedApps)) {
        const set = new Set<number>((r2 as any).rgOwnedApps as number[]);
        for (const id of missing) {
          if (set.has(id)) owned.add(id);
        }
      }
    } catch (e) {
      log(`ownership: dynamicstore fetch error: ${String(e)}`);
    }
  }

  for (const id of appids) result.set(id, owned.has(id));
  return result;
}

export async function getOwnership(appids: number[]): Promise<Map<number, boolean> | null> {
  if (appids.length === 0) return new Map<number, boolean>();

  const now = Date.now();
  const result = new Map<number, boolean>();
  const missing: number[] = [];
  for (const id of appids) {
    const entry = cached.get(id);
    if (entry && now - entry.ts < TTL_MS) result.set(id, entry.owned);
    else missing.push(id);
  }

  if (missing.length > 0) {
    if (!inflight) {
      inflight = fetchOwnershipViaStore(missing).finally(() => { inflight = null; });
    }
    const fresh = await inflight;
    if (fresh === null) return null;
    for (const id of missing) {
      const owned = fresh.get(id) ?? false;
      cached.set(id, { owned, ts: now });
      result.set(id, owned);
    }
  }

  return result;
}

export async function isAppOwned(appid: number, fresh = false): Promise<boolean | null> {
  if (fresh) cached.delete(appid);
  const map = await getOwnership([appid]);
  if (map === null) return null;
  return map.get(appid) ?? false;
}

export function clearOwnershipCache(): void {
  cached.clear();
  cacheSteamId = '';
  inflight = null;
}
