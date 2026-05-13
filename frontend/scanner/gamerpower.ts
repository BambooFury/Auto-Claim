import { callable } from '@steambrew/client';
import type { ScanHit, ScannerLogger } from './types';
import { safeParse } from './http';

type Empty = [];
type StrIn = [{ payload: string }];
const fetchGamerPowerIPC = callable<Empty, string>('fetch_gamerpower_ipc');
const fetchStoreSearchIPC = callable<StrIn, string>('fetch_storesearch_ipc');

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
  let body = '';
  try {
    body = await fetchStoreSearchIPC({ payload: clean });
  } catch (e: any) {
    log?.warn(`[scanner] storesearch IPC failed: ${e?.message || e}`);
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
    body = await fetchGamerPowerIPC();
  } catch (e: any) {
    log?.warn(`[scanner] gamerpower IPC failed: ${e?.message || e}`);
    return [];
  }
  if (!body) return [];

  const data = safeParse<GamerPowerEntry[]>(body, log, '(gamerpower)');
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
      log?.info(`GamerPower found: ${hit.appid} - ${hit.name}`);
    }
  }

  return out;
}
