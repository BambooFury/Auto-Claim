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

export function setScanBusyState(busy: boolean): void {
  scanBusy = busy;
  notify();
}

export async function requestManualScan(): Promise<boolean> {
  if (!scanTrigger || scanBusy) return false;
  return await scanTrigger();
}

let newGamesCount = 0;
let indicatorEnabled = true;

export function getNewGamesCount(): number {
  return indicatorEnabled ? newGamesCount : 0;
}

export function setIndicatorEnabled(enabled: boolean): void {
  const next = enabled === true;
  if (next === indicatorEnabled) return;
  indicatorEnabled = next;
  notify();
}

export function setNewGamesCount(count: number): void {
  const next = Math.max(0, Math.floor(count));
  if (next === newGamesCount) return;
  newGamesCount = next;
  notify();
}

export function resetNewGamesCount(): void {
  if (newGamesCount === 0) return;
  newGamesCount = 0;
  notify();
}

export interface ScanProgressState {
  stage: 'search' | 'giveaways' | 'verify';
  current: number;
  total: number;
}

let scanProgress: ScanProgressState | null = null;
const progressListeners = new Set<() => void>();

function notifyProgress(): void {
  for (const fn of Array.from(progressListeners)) {
    try { fn(); } catch {}
  }
}

export function setScanProgress(progress: ScanProgressState | null): void {
  scanProgress = progress;
  notifyProgress();
}

export function getScanProgress(): ScanProgressState | null {
  return scanProgress;
}

export function subscribeScanProgress(fn: () => void): () => void {
  progressListeners.add(fn);
  return () => { progressListeners.delete(fn); };
}
