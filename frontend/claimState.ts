const listeners = new Set<() => void>();
const claiming = new Set<number>();
const claimed = new Set<number>();
const failed = new Set<number>();

function notify(): void {
  for (const fn of Array.from(listeners)) {
    try { fn(); } catch {}
  }
}

export function subscribeClaimState(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getClaimSnapshot(): { claiming: Set<number>; claimed: Set<number>; failed: Set<number> } {
  return { claiming, claimed, failed };
}

export function setClaiming(appid: number): void {
  claiming.add(appid);
  claimed.delete(appid);
  failed.delete(appid);
  notify();
}

export function setClaimed(appid: number): void {
  claiming.delete(appid);
  claimed.add(appid);
  notify();
}

export function setClaimFailed(appid: number): void {
  claiming.delete(appid);
  failed.add(appid);
  notify();
}

export function clearClaimStatus(appid: number): void {
  claiming.delete(appid);
  claimed.delete(appid);
  failed.delete(appid);
  notify();
}
