const SUBID_PATTERNS: RegExp[] = [
  /javascript:AddFreeLicense\(\s*(\d+)\s*\)/,
  /id="add_to_cart_submit_(\d+)"/,
  /name="subid"\s+value="(\d+)"/,
  /data-ds-packageid="(\d+)"[^>]*>[^<]*Free/i,
  /data-ds-packageid="(\d+)"/,
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
export async function silentClaim(appid: number): Promise<ClaimResult> {
  try {
    const pageRes = await fetch(APP_URL(appid), { credentials: 'include' });
    const html = await pageRes.text();

    const subid = findSubid(html);
    if (!subid) return { ok: false, reason: 'no subid in app page' };

    const sessionid = extractSessionId();
    if (!sessionid) return { ok: false, reason: 'no sessionid' };

    const form = new URLSearchParams();
    form.set('action', 'add_to_cart');
    form.set('sessionid', sessionid);
    form.set('subid', subid);

    const claimRes = await fetch(POST_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type':     'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer':          `https://store.steampowered.com/app/${appid}/`,
      },
      body: form.toString(),
    });

    if (!claimRes.ok) return { ok: false, reason: 'http ' + claimRes.status };

    const text = await claimRes.text();
    if (/Sign In|please log in/i.test(text)) {
      return { ok: false, reason: 'session expired' };
    }
    return { ok: true, reason: 'ok' };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}
