import type { FreeGame, ScannerLogger } from './types';
import { searchSteamSpecials } from './search';
import { fetchGamerPowerHits } from './gamerpower';
import { verifyAndDecorate } from './appdetails';

export type { FreeGame } from './types';

export interface ScanResult {
  games:  FreeGame[];
  anyOk:  boolean;
}

export async function runScan(log?: ScannerLogger): Promise<ScanResult> {
  const seen = new Set<number>();

  const steamResult = await searchSteamSpecials(log);
  for (const h of steamResult.hits) seen.add(h.appid);

  const gpHits = await fetchGamerPowerHits(seen, log);

  const allHits = steamResult.hits.concat(gpHits);
  const accepted: FreeGame[] = [];

  for (const hit of allHits) {
    const game = await verifyAndDecorate(hit, log);
    if (game) accepted.push(game);
  }

  return {
    games: accepted,
    anyOk: steamResult.anyOk,
  };
}
