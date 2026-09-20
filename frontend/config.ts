export type FilterMode = 'games' | 'all' | 'weekend';

export interface FreeGame {
  appid: number;
  name: string;
  type?: string;
  header?: string;
  capsule?: string;
  until?: number;
}

export interface GrabbedEntry {
  appid: number;
  name: string;
  grabbed_at: number;
  added: boolean;
}

export interface PluginSettings {
  autoAdd: boolean;
  pollIntervalMin: number;
  notifyOnGrab: boolean;
  hideOwned: boolean;
  showIndicator: boolean;
  filterMode: FilterMode;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  autoAdd: false,
  pollIntervalMin: 30,
  notifyOnGrab: true,
  hideOwned: false,
  showIndicator: true,
  filterMode: 'games',
};

export const MIN_POLL_INTERVAL_MIN = 30;

const ALLOWED_INTERVALS = [30, 120, 1440];
const ALLOWED_FILTERS: FilterMode[] = ['games', 'all', 'weekend'];

export function normalizeSettings(raw: unknown): PluginSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw as object || {}) } as PluginSettings;
  let poll = typeof s.pollIntervalMin === 'number' ? s.pollIntervalMin : MIN_POLL_INTERVAL_MIN;
  if (poll === 60) poll = 120;
  if (ALLOWED_INTERVALS.indexOf(poll) === -1) poll = MIN_POLL_INTERVAL_MIN;
  if (ALLOWED_FILTERS.indexOf(s.filterMode) === -1) s.filterMode = 'games';
  return { ...s, pollIntervalMin: poll };
}

export const FILTER_LABELS: Record<FilterMode, string> = {
  games: 'Games only',
  all: 'All free items',
  weekend: 'Free weekend',
};

export const FILTER_OPTIONS = ALLOWED_FILTERS.map((mode) => ({
  data: mode,
  label: FILTER_LABELS[mode],
}));

export const INTERVAL_OPTIONS = ALLOWED_INTERVALS.map((min) => ({
  data: min,
  label: min >= 1440 ? 'Once a day' : `Every ${min} min`,
}));

export function isClaimableGame(game: FreeGame): boolean {
  return !game.type || game.type === 'game';
}

export function headerImageUrl(game: FreeGame): string {
  return (
    game.header ||
    game.capsule ||
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`
  );
}

export function formatUntil(unix?: number): string {
  if (!unix) return 'this weekend';
  try {
    return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'this weekend';
  }
}
