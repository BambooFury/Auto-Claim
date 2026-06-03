import type { ScanHit, ScannerLogger } from './types';
import { SEARCH_BASE, SEARCH_REGIONS } from './types';
import { safeFetch, safeParse } from './http';

interface SteamSearchItem {
  name?: string;
  logo?: string;
}

interface SteamSearchResponse {
  items?: SteamSearchItem[];
}

export interface SearchResult {
  hits:    ScanHit[];
  anyOk:   boolean;
}

export async function searchSteamSpecials(
  log?: ScannerLogger,
): Promise<SearchResult> {
  const seen = new Set<number>();
  const hits: ScanHit[] = [];
  let anyOk = false;

  for (const cc of SEARCH_REGIONS) {
    const url = SEARCH_BASE + '&cc=' + cc;
    const res = await safeFetch(url, 25000, log);
    if (!res || res.status !== 200) continue;

    anyOk = true;
    const data = safeParse<SteamSearchResponse>(res.body, log, `(search ${cc})`);
    if (!data || !Array.isArray(data.items)) continue;

    for (const item of data.items) {
      const logoUrl = typeof item.logo === 'string' ? item.logo.replace(/\\\//g, '/') : '';
      const m = logoUrl.match(/\/apps\/(\d+)\//);
      if (!m) continue;

      const id = parseInt(m[1], 10);
      if (!id || id <= 0 || seen.has(id)) continue;

      seen.add(id);
      hits.push({
        appid: id,
        name:  typeof item.name === 'string' ? item.name : 'AppID ' + m[1],
        cc,
      });
    }
  }

  return { hits, anyOk };
}
