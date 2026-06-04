const SUBID_PATTERNS: RegExp[] = [
  /javascript:AddFreeLicense\(\s*(\d+)\s*\)/,
  /javascript:addToCart\(\s*(\d+)\s*\)/,
  /\bAddFreeLicense\(\s*(\d+)\s*\)/,
  /\baddToCart\(\s*(\d+)\s*\)/,
  /data-ds-add-free-sub="(\d+)"/,
  /data-add-free-sub="(\d+)"/,
  /id="add_to_cart_submit_(\d+)"/,
  /name="subid"\s+value="(\d+)"/,
];

export interface ClaimResult {
  ok: boolean;
  reason: string;
}

const APP_URL  = (id: number) => `https://store.steampowered.com/app/${id}/?cc=us&l=english`;
const POST_URL = 'https://store.steampowered.com/checkout/addfreelicense';

function extractSessionId(): string | null {
  const fromCookie = (document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/) || [])[1];
  if (fromCookie) return fromCookie;
  const fromWindow = (window as any).g_sessionID;
  return typeof fromWindow === 'string' && fromWindow ? fromWindow : null;
}

function findSubid(html: string): string | null {
  for (const re of SUBID_PATTERNS) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}
function isTransientFetchError(err: unknown): boolean {
  const s = String(err || '').toLowerCase();
  return s.indexOf('failed to fetch') !== -1
      || s.indexOf('networkerror')    !== -1
      || s.indexOf('load failed')     !== -1
      || s.indexOf('network request') !== -1
      || s.indexOf('aborterror')      !== -1;
}


function _xhrGet(url: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.withCredentials = true;
      xhr.timeout = 15000;
      xhr.onload = () => {
        const headers = new Headers();
        try {
          const raw = xhr.getAllResponseHeaders() || '';
          raw.split(/\r?\n/).forEach((line) => {
            const i = line.indexOf(':');
            if (i > 0) headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
          });
        } catch {}
        resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
      };
      xhr.onerror   = () => reject(new TypeError('XHR network error'));
      xhr.ontimeout = () => reject(new TypeError('XHR timeout'));
      xhr.send();
    } catch (e) {
      reject(e);
    }
  });
}

function _xhrPostForm(url: string, body: string, referer: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.withCredentials = true;
      xhr.timeout = 15000;
      xhr.setRequestHeader('Content-Type',     'application/x-www-form-urlencoded');
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      try { xhr.setRequestHeader('Referer', referer); } catch {}
      xhr.onload = () => {
        const headers = new Headers();
        try {
          const raw = xhr.getAllResponseHeaders() || '';
          raw.split(/\r?\n/).forEach((line) => {
            const i = line.indexOf(':');
            if (i > 0) headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
          });
        } catch {}
        resolve(new Response(xhr.responseText, { status: xhr.status, headers }));
      };
      xhr.onerror   = () => reject(new TypeError('XHR network error'));
      xhr.ontimeout = () => reject(new TypeError('XHR timeout'));
      xhr.send(body);
    } catch (e) {
      reject(e);
    }
  });
}

async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries: number,
  backoffMs: number,
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (!isTransientFetchError(err)) break;

      if (init.method === undefined || init.method === 'GET') {
        try {
          return await _xhrGet(input);
        } catch (xhrErr) {
          lastErr = xhrErr;
        }
      }
      if (attempt >= retries) break;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}


export async function silentClaim(appid: number): Promise<ClaimResult> {
  try {
    document.cookie = "birthtime=283993201; path=/; max-age=31536000";
    document.cookie = "lastagecheckage=1-January-1990; path=/; max-age=31536000";
    let subid = findSubid(document.documentElement.outerHTML);


    if (!subid) {
      try {
        const pageRes = await fetchWithRetry(APP_URL(appid), { credentials: 'include' }, 1, 500);
        const html    = await pageRes.text();
        subid         = findSubid(html);
      } catch {}
    }
    if (!subid) return { ok: false, reason: 'no subid in app page' };

    const sessionid = extractSessionId();
    if (!sessionid) return { ok: false, reason: 'no sessionid' };

    const form = new URLSearchParams();
    form.set('action', 'add_to_cart');
    form.set('sessionid', sessionid);
    form.set('subid', subid);

    const referer = `https://store.steampowered.com/app/${appid}/`;
    let claimRes: Response;
    try {
      claimRes = await fetch(POST_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type':     'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer':          referer,
        },
        body: form.toString(),
      });
    } catch (err) {

      if (!isTransientFetchError(err)) throw err;
      claimRes = await _xhrPostForm(POST_URL, form.toString(), referer);
    }

    if (claimRes.status === 401 || claimRes.status === 403) {
      return { ok: false, reason: 'session expired' };
    }
    if (!claimRes.ok) return { ok: false, reason: 'http ' + claimRes.status };

    const text = await claimRes.text();

    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        if (data.success === 1 || data.success === true) {
          return { ok: true, reason: 'ok' };
        }
        if (data.purchaseresultdetail !== undefined) {

          const code = Number(data.purchaseresultdetail);
          if (code === 9 || code === 53) {
            return { ok: true, reason: 'already owned' };
          }
          return { ok: false, reason: 'purchase result ' + data.purchaseresultdetail };
        }
        return { ok: false, reason: 'claim refused' };
      }
    } catch {}

    if (/"success"\s*:\s*1\b/.test(text)) {
      return { ok: true, reason: 'ok' };
    }
    if (/Sign In|please log in|store\.steampowered\.com\/login/i.test(text)) {
      return { ok: false, reason: 'session expired' };
    }
    return { ok: false, reason: 'claim refused' };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
