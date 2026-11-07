import type { FreeGame, ScannerLogger } from './types';
import { searchSteamSpecials } from './search';
import { fetchGamerPowerHits } from './gamerpower';
import { verifyAndDecorate } from './appdetails';

export type { FreeGame } from './types';

export interface ScanProgress {
  stage: 'search' | 'giveaways' | 'verify';
  current: number;
  total: number;
}

export interface ScanResult {
  games:  FreeGame[];
  anyOk:  boolean;
}

export async function runScan(log?: ScannerLogger, onProgress?: (progress: ScanProgress) => void): Promise<ScanResult> {
  const seen = new Set<number>();

  onProgress?.({ stage: 'search', current: 0, total: 0 });

  const steamResult = await searchSteamSpecials(log);
  for (const h of steamResult.hits) seen.add(h.appid);

  onProgress?.({ stage: 'giveaways', current: 0, total: 0 });

  const gpHits = await fetchGamerPowerHits(seen, log);

  const allHits = steamResult.hits.concat(gpHits);
  const accepted: FreeGame[] = [];

  onProgress?.({ stage: 'verify', current: 0, total: allHits.length });

  let verified = 0;
  for (const hit of allHits) {
    const game = await verifyAndDecorate(hit, log);
    verified += 1;
    onProgress?.({ stage: 'verify', current: verified, total: allHits.length });
    if (game) accepted.push(game);
  }

  return {
    games: accepted,
    anyOk: steamResult.anyOk,
  };
}
