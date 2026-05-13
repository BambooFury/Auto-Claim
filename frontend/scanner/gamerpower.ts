import type { ScanHit, ScannerLogger } from './types';
import { GAMERPOWER_URL, STORE_HOST } from './types';
import { safeFetch, safeParse } from './http';

interface GamerPowerEntry {
  title?: string;
}

interface StoreSearchItem {
  id?:   number;
  name?: string;
}

interface StoreSearchResponse {
  items?: StoreSearchItem[];
}

const GAMERPOWER_LIMIT = 20;

function cleanTitle(raw: string): string {
  return raw
    .replace(/ \(Steam\) [\w\s]+ Giveaway$/, '')
    .replace(/ \(Steam\) Giveaway$/, '')
    .replace(/ \(Steam\)$/, '')
    .replace(/ Giveaway$/, '');
}

async function resolveTitle(
  clean: string,
  seen: Set<number>,
  log?: ScannerLogger,
): Promise<ScanHit | null> {
  const url = STORE_HOST + '/api/storesearch/?term=' + encodeURIComponent(clean) + '&l=english&cc=us';
  const res = await safeFetch(url, 10000, log);
  if (!res || res.status !== 200) return null;

  const data = safeParse<StoreSearchResponse>(res.body, log, '(storesearch)');
  if (!data || !Array.isArray(data.items) || !data.items[0]) return null;

  const item = data.items[0];
  const id   = typeof item.id === 'number' ? item.id : NaN;
  if (!id || id <= 0 || seen.has(id)) return null;

  return {
    appid: id,
    name:  typeof item.name === 'string' ? item.name : clean,
    fromGamerPower: true,
  };
}

export async function fetchGamerPowerHits(
  seen: Set<number>,
  log?: ScannerLogger,
): Promise<ScanHit[]> {
  const res = await safeFetch(GAMERPOWER_URL, 15000, log);
  if (!res || res.status !== 200) return [];

  const data = safeParse<GamerPowerEntry[]>(res.body, log, '(gamerpower)');
  if (!Array.isArray(data)) return [];

  const out: ScanHit[] = [];
  const limit = Math.min(data.length, GAMERPOWER_LIMIT);

  for (let i = 0; i < limit; i++) {
    const raw = typeof data[i].title === 'string' ? data[i].title! : '';
    const clean = cleanTitle(raw);
    if (!clean) continue;

    const hit = await resolveTitle(clean, seen, log);
    if (hit) {
      seen.add(hit.appid);
      out.push(hit);
      log?.info(`[AutoClaim] GamerPower found: ${hit.appid} - ${hit.name}`);
    }
  }

  return out;
}
