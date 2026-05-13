import type { ScanHit, FreeGame, ScannerLogger } from './types';
import { APPDETAILS_URL } from './types';
import { safeFetch, safeParse } from './http';

interface AppDetailsData {
  type?:           string;
  is_free?:        boolean;
  header_image?:   string;
  capsule_image?:  string;
  price_overview?: { final?: number };
}

interface AppDetailsEntry {
  success?: boolean;
  data?:    AppDetailsData;
}

type AppDetailsResponse = Record<string, AppDetailsEntry>;

export async function verifyAndDecorate(
  hit: ScanHit,
  log?: ScannerLogger,
): Promise<FreeGame | null> {
  const cc  = hit.cc || 'us';
  const url = APPDETAILS_URL + '?appids=' + hit.appid + '&cc=' + cc;
  const res = await safeFetch(url, 10000, log);

  if (!res || res.status !== 200) {
    log?.info(`[scanner] appdetails ${hit.appid}: no response (status=${res?.status ?? 'null'})`);
    if (!hit.fromGamerPower) {
      return {
        appid: hit.appid,
        name:  hit.name,
        type:  'unknown',
      };
    }
    return null;
  }

  const data = safeParse<AppDetailsResponse>(res.body, log, `(appdetails ${hit.appid})`);
  if (!data) {
    log?.info(`[scanner] appdetails ${hit.appid}: JSON parse failed`);
    return null;
  }

  const entry = data[String(hit.appid)];
  if (!entry || !entry.data) {
    log?.info(`[scanner] appdetails ${hit.appid}: no data (success=${entry?.success})`);
    return null;
  }

  const d         = entry.data;
  const appType   = d.type;
  const isFree    = d.is_free === true;
  const priceZero = d.price_overview && typeof d.price_overview.final === 'number' && d.price_overview.final === 0;
  const currentlyFree = isFree || !!priceZero;

  const listable = appType === 'game'  || appType === 'dlc' ||
                   appType === 'music' || appType === 'demo';

  let accepted: boolean;
  if (hit.fromGamerPower) {
    accepted = appType === 'game' && currentlyFree;
  } else {
    accepted = listable && currentlyFree;
  }

  if (!accepted) {
    log?.info(`[scanner] appdetails ${hit.appid}: rejected type=${appType} isFree=${isFree} priceFinal=${d.price_overview?.final} fromGP=${hit.fromGamerPower}`);
    return null;
  }

  return {
    appid:   hit.appid,
    name:    hit.name,
    type:    appType || 'unknown',
    header:  typeof d.header_image  === 'string' ? d.header_image  : undefined,
    capsule: typeof d.capsule_image === 'string' ? d.capsule_image : undefined,
  };
}
