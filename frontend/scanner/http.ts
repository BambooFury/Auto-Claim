import { callable } from 'millennium';
import type { ScannerLogger } from './types';

const fetchUrlViaCurl = callable<[{ payload: string }], string>('fetch_url_via_curl_ipc');

export interface HttpResponse {
  ok:     boolean;
  status: number;
  body:   string;
}

export async function safeFetch(
  url: string,
  timeoutMs: number,
  log?: ScannerLogger,
): Promise<HttpResponse | null> {
  try {
    const body = await fetchUrlViaCurl({ payload: url });
    if (!body || body.length === 0) return null;
    return { ok: true, status: 200, body };
  } catch {
    return null;
  }
}

export function safeParse<T>(raw: string, log?: ScannerLogger, ctx?: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (e: any) {
    log?.warn(`[scanner] JSON parse failed${ctx ? ' ' + ctx : ''}: ${e?.message || e}`);
    return null;
  }
}
