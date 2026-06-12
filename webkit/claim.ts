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

interface ClaimTarget {
  subid: string;
  action: string | null;
}

const FREE_FORM_RE = /<form[^>]+action="([^"]*\/freelicense\/addfreelicense\/?[^"]*)"[^>]*>([\s\S]*?)<\/form>/gi;

function findClaimTarget(html: string): ClaimTarget | null {
  FREE_FORM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FREE_FORM_RE.exec(html))) {
    const sub = (m[2].match(/name="subid"\s+value="(\d+)"/) || [])[1];
    if (sub) return { subid: sub, action: m[1] };
  }
  const ds = html.match(/data-ds-add-free-sub="(\d+)"/) || html.match(/data-add-free-sub="(\d+)"/);
  if (ds && ds[1]) return { subid: ds[1], action: null };
  const afl = html.match(/AddFreeLicense\(\s*(\d+)\s*\)/);
  if (afl && afl[1]) return { subid: afl[1], action: null };
  const sub = findSubid(html);
  return sub ? { subid: sub, action: null } : null;
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

    let target: ClaimTarget | null = null;
    if (window.location.href.indexOf('/app/' + appid) !== -1) {
      target = findClaimTarget(document.documentElement.outerHTML);
    }

    if (!target) {
      try {
        const pageRes = await fetchWithRetry(APP_URL(appid), { credentials: 'include' }, 1, 500);
        const html    = await pageRes.text();
        target        = findClaimTarget(html);
      } catch {}
    }
    if (!target) return { ok: false, reason: 'no subid in app page' };
    const subid = target.subid;

    const sessionid = extractSessionId();
    if (!sessionid) return { ok: false, reason: 'no sessionid' };

    const form = new URLSearchParams();
    form.set('action', 'add_to_cart');
    form.set('sessionid', sessionid);
    form.set('subid', subid);

    const referer = `https://store.steampowered.com/app/${appid}/`;
    const postUrl = target.action || POST_URL;
    let claimRes: Response;
    try {
      claimRes = await fetch(postUrl, {
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
      claimRes = await _xhrPostForm(postUrl, form.toString(), referer);
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
    if (/game_area_already_owned|already in your Steam library/i.test(text)) {
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