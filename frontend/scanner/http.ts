import type { ScannerLogger } from './types';

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'omit',
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e: any) {
    log?.warn(`[scanner] fetch failed (${url}): ${e?.message || e}`);
    return null;
  } finally {
    clearTimeout(timer);
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
