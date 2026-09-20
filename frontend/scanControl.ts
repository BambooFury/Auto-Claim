type ScanTrigger = () => Promise<boolean>;

let scanTrigger: ScanTrigger | null = null;
let scanBusy = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of Array.from(listeners)) {
    try { fn(); } catch {}
  }
}

export function registerScanTrigger(fn: ScanTrigger): void {
  scanTrigger = fn;
}

export function isScanBusy(): boolean {
  return scanBusy;
}

export function subscribeScanState(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function requestManualScan(): Promise<boolean> {
  if (!scanTrigger || scanBusy) return false;
  scanBusy = true;
  notify();
  try {
    return await scanTrigger();
  } finally {
    scanBusy = false;
    notify();
  }
}
