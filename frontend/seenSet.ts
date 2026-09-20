const SEEN_LS_KEY_PREFIX = 'fgg_seen_appids';

let _seenSet = new Set<number>();
let _ownerSid = '';

function buildSeenLsKey(sid: string): string {
  return sid ? `${SEEN_LS_KEY_PREFIX}_${sid}` : SEEN_LS_KEY_PREFIX;
}

function loadSeenSet(sid: string): Set<number> {
  const out = new Set<number>();
  try {
    const raw = localStorage.getItem(buildSeenLsKey(sid));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const v of arr) {
          if (typeof v === 'number') out.add(v);
        }
      }
    }
  } catch {}
  return out;
}

function saveSeenSet(): void {
  try {
    localStorage.setItem(buildSeenLsKey(_ownerSid), JSON.stringify(Array.from(_seenSet)));
  } catch {}
}

export function setSeenOwner(sid: string): void {
  if (sid && sid === _ownerSid) return;
  _ownerSid = sid || '';
  _seenSet = loadSeenSet(_ownerSid);
}

export function isSeen(appid: number): boolean {
  return _seenSet.has(appid);
}

export function markSeen(appid: number): void {
  if (!_seenSet.has(appid)) {
    _seenSet.add(appid);
    saveSeenSet();
  }
}

export function markAllSeen(appids: number[]): void {
  let changed = false;
  for (const id of appids) {
    if (typeof id === 'number' && !_seenSet.has(id)) {
      _seenSet.add(id);
      changed = true;
    }
  }
  if (changed) saveSeenSet();
}

export function resetSeenSet(): void {
  _seenSet = loadSeenSet(_ownerSid);
}
