import { callable, ChromeDevToolsProtocol } from 'millennium';

const logIPC = callable<[{ payload: string }], number>('log_plugin');
const log = (msg: string) => { logIPC({ payload: msg }).catch(() => {}); };

const MARKER = 'fggownership=1';
const TTL_MS = 5 * 60 * 1000;

const cdp = ChromeDevToolsProtocol;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const cached = new Map<number, { owned: boolean; ts: number }>();
let inflight: Promise<Map<number, boolean> | null> | null = null;

interface HiddenSession {
  browserView: any;
  popupWindow: Window | null;
  sessionId: string;
}

let hidden: HiddenSession | null = null;

function destroyHidden(): void {
  if (!hidden) return;
  try { (window as any).SteamClient?.BrowserView?.Destroy?.(hidden.browserView); } catch {}
  try { hidden.popupWindow?.close(); } catch {}
  hidden = null;
}

async function ensureHiddenSession(): Promise<HiddenSession | null> {
  if (hidden) return hidden;

  const bv = (window as any).SteamClient?.BrowserView;
  if (!bv?.CreatePopup) {
    log('ownership: BrowserView.CreatePopup unavailable');
    return null;
  }

  let res: any = null;
  try {
    res = bv.CreatePopup({
      strInitialURL: `https://store.steampowered.com/?${MARKER}`,
      bOnlyAllowTrustedPopups: false,
    });
  } catch (e) {
    log(`ownership: CreatePopup failed: ${String(e)}`);
    return null;
  }
  if (!res?.browserView) return null;

  let popupWindow: Window | null = null;
  try {
    popupWindow = window.open(
      res.strCreateURL,
      'fgg-ownership',
      'width=1,height=1,left=-32000,top=-32000,toolbar=0,menubar=0,location=0,status=0,scrollbars=0,resizable=0',
    );
  } catch {}
  try { res.browserView.SetBounds(-32000, -32000, 400, 300); } catch {}
  try { res.browserView.SetFocus(false); } catch {}

  hidden = { browserView: res.browserView, popupWindow, sessionId: '' };
  return hidden;
}

async function attachSession(): Promise<string | null> {
  if (!hidden) return null;
  if (hidden.sessionId) return hidden.sessionId;

  for (let i = 0; i < 40; i++) {
    try {
      const { targetInfos } = (await cdp.send('Target.getTargets', {})) as any;
      const target = (targetInfos || []).find((t: any) => (t.url || '').includes(MARKER));
      if (target) {
        const { sessionId } = (await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })) as any;
        hidden.sessionId = sessionId;
        return sessionId;
      }
    } catch (e) {
      log(`ownership: cdp attach failed: ${String(e)}`);
      return null;
    }
    await sleep(500);
  }
  log('ownership: ownership popup target never appeared');
  return null;
}

async function evaluate<T>(expression: string): Promise<T | null> {
  const sessionId = await attachSession();
  if (!sessionId) return null;

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const result = (await cdp.send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId,
      )) as any;
      if (result?.result?.value !== undefined) return result.result.value as T;
    } catch {}
    await sleep(500);
  }
  return null;
}

async function fetchOwnershipViaStore(appids: number[]): Promise<Map<number, boolean> | null> {
  const session = await ensureHiddenSession();
  if (!session) return null;

  const expression = `(async () => {
    const ids = ${JSON.stringify(appids)};
    const out = { owned: [], error: '' };
    try {
      const r = await fetch('https://store.steampowered.com/api/appuserdetails/?appids=' + ids.join(',') + '&cc=us', { credentials: 'include' });
      const d = await r.json();
      for (const id of ids) {
        const e = d[id];
        if (e && e.success && (e.data.is_owned || e.data.added_to_package)) out.owned.push(id);
      }
    } catch (e) { out.error = String(e); return JSON.stringify(out); }
    const missing = ids.filter((id) => !out.owned.includes(id));
    if (missing.length) {
      try {
        const r2 = await fetch('https://store.steampowered.com/dynamicstore/userdata/', { credentials: 'include' });
        const d2 = await r2.json();
        if (Array.isArray(d2.rgOwnedApps)) {
          const set = new Set(d2.rgOwnedApps);
          for (const id of missing) if (set.has(id)) out.owned.push(id);
        }
      } catch {}
    }
    return JSON.stringify(out);
  })()`;

  const raw = await evaluate<string>(expression);
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed.error) log(`ownership: store fetch error: ${parsed.error}`);
    const map = new Map<number, boolean>();
    for (const id of appids) map.set(id, parsed.owned.includes(id));
    return map;
  } catch {
    return null;
  }
}

export async function getOwnership(appids: number[]): Promise<Map<number, boolean> | null> {
  if (appids.length === 0) return new Map<number, boolean>();

  const now = Date.now();
  const result = new Map<number, boolean>();
  const missing: number[] = [];
  for (const id of appids) {
    const entry = cached.get(id);
    if (entry && now - entry.ts < TTL_MS) result.set(id, entry.owned);
    else missing.push(id);
  }

  if (missing.length > 0) {
    if (!inflight) {
      inflight = fetchOwnershipViaStore(missing).finally(() => { inflight = null; });
    }
    const fresh = await inflight;
    if (fresh === null) return null;
    for (const id of missing) {
      const owned = fresh.get(id) ?? false;
      cached.set(id, { owned, ts: now });
      result.set(id, owned);
    }
  }

  return result;
}

export async function isAppOwned(appid: number, fresh = false): Promise<boolean | null> {
  if (fresh) cached.delete(appid);
  const map = await getOwnership([appid]);
  if (map === null) return null;
  return map.get(appid) ?? false;
}

export function clearOwnershipCache(): void {
  cached.clear();
  destroyHidden();
}
