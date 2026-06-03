import { callable } from '@steambrew/client';
import type { ScanHit, ScannerLogger } from './types';
import { safeParse } from './http';

const GAMERPOWER_API_URL = 'https://www.gamerpower.com/api/giveaways?platform=steam&type=game';

const fetchUrlViaCurl = callable<[{ payload: string }], string>('fetch_url_via_curl_ipc');

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
  const fullUrl =
    'https://store.steampowered.com/api/storesearch/?term=' +
    encodeURIComponent(clean) + '&l=english&cc=us';

  let body = '';
  try {
    body = await fetchUrlViaCurl({ payload: fullUrl });
  } catch (e: any) {
    log?.warn(`[scanner] storesearch curl IPC threw: ${e?.message || e}`);
    return null;
  }
  if (!body) return null;

  const data = safeParse<StoreSearchResponse>(body, log, '(storesearch)');
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
  let body = '';
  try {
    body = await fetchUrlViaCurl({ payload: GAMERPOWER_API_URL });
  } catch (e: any) {
    log?.warn(`[scanner] gamerpower curl IPC threw: ${e?.message || e}`);
    return [];
  }
  if (!body || body.trim() === '') {
    return [];
  }
  log?.info(`[scanner] gamerpower curl ok (${body.length} bytes)`);

  const data = safeParse<GamerPowerEntry[]>(body, log, '(gamerpower)');
  if (!Array.isArray(data)) {
    log?.info(`[scanner] gamerpower ignored non-array response`);
    return [];
  }
  log?.info(`[scanner] gamerpower returned ${data.length} entries`);

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
      log?.info(`GamerPower found: ${hit.appid} - ${hit.name}`);
    }
  }

  return out;
}
