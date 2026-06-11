import { callable } from '@steambrew/client';
import type { ScannerLogger } from './types';
import { safeFetch, safeParse } from './http';

const fetchUrlViaCurl = callable<[{ payload: string }], string>('fetch_url_via_curl_ipc');

const QUERY_URL = 'https://api.steampowered.com/IStoreQueryService/Query/v1/?input_json=';
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

export interface WeekendGame {
  appid: number;
  name:  string;
  type:  'weekend';
  until: number;
}

interface QueryStoreItem {
  appid?: number;
  name?:  string;
  free_weekend?: { start_time?: number; end_time?: number };
}

interface QueryResponse {
  response?: {
    metadata?:    { total_matching_records?: number };
    store_items?: QueryStoreItem[];
  };
}

function buildPageUrl(start: number): string {
  const input = {
    query: {
      start,
      count: PAGE_SIZE,
      filters: {
        type_filters:  { include_apps: true },
        price_filters: { min_discount_percent: 1 },
      },
    },
    context:      { language: 'english', country_code: 'US' },
    data_request: {},
  };
  return QUERY_URL + encodeURIComponent(JSON.stringify(input));
}

async function fetchPage(url: string, log?: ScannerLogger): Promise<string | null> {
  const res = await safeFetch(url, 30000, log);
  if (res && res.status === 200 && res.body) return res.body;

  try {
    const body = await fetchUrlViaCurl({ payload: url });
    return body || null;
  } catch (e: any) {
    log?.warn(`[weekend] curl IPC threw: ${e?.message || e}`);
    return null;
  }
}

export async function scanFreeWeekend(log?: ScannerLogger): Promise<WeekendGame[] | null> {
  const found: WeekendGame[] = [];
  const seen  = new Set<number>();
  const now   = Date.now() / 1000;

  let start = 0;
  let total = Infinity;

  for (let page = 0; page < MAX_PAGES && start < total; page++) {
    const body = await fetchPage(buildPageUrl(start), log);
    if (!body) {
      log?.warn(`[weekend] page ${page} unreachable — aborting weekend scan`);
      return null;
    }

    const data = safeParse<QueryResponse>(body, log, `(weekend page ${page})`);
    if (!data || !data.response) return null;

    const items = Array.isArray(data.response.store_items) ? data.response.store_items : [];
    const meta  = data.response.metadata;
    if (meta && typeof meta.total_matching_records === 'number') {
      total = meta.total_matching_records;
    }

    for (const it of items) {
      const appid = typeof it.appid === 'number' ? it.appid : 0;
      const fw    = it.free_weekend;
      if (!appid || !fw || seen.has(appid)) continue;

      const until = typeof fw.end_time === 'number' ? fw.end_time : 0;
      if (until <= now) continue;

      seen.add(appid);
      found.push({
        appid,
        name: typeof it.name === 'string' && it.name ? it.name : 'AppID ' + appid,
        type: 'weekend',
        until,
      });
    }

    if (items.length === 0) break;
    start += items.length;
  }

  log?.info(`[weekend] scan ok — ${found.length} free-weekend game(s)`);
  return found;
}