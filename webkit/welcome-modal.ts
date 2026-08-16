const SEEN_FLAG = 'fgg_welcomed_v8';

interface SteamDialogs {
  ShowAlertDialog?: (
    title: string,
    description: string,
    okButtonText?: string,
  ) => void;
  ShowConfirmDialog?: (
    title: string,
    description: string,
    okButtonText?: string,
    cancelButtonText?: string,
  ) => Promise<boolean>;
}

function getDialogs(): SteamDialogs | null {
  const d = (window as unknown as { ShowAlertDialog?: unknown; ShowConfirmDialog?: unknown });
  if (typeof d.ShowAlertDialog === 'function' || typeof d.ShowConfirmDialog === 'function') {
    return d as SteamDialogs;
  }
  return null;
}

function alreadySeen(): boolean {
  try { return localStorage.getItem(SEEN_FLAG) === '1'; }
  catch { return true; }
}

function markSeen(): void {
  try { localStorage.setItem(SEEN_FLAG, '1'); } catch {}
}

function buildWelcomeText(): string {
  return [
    'Free Steam games will now land in your library — automatically.',
    '',
    '• Watches the Steam Store for games at 100% off — every 30 min, 120 min, or once a day.',
    '• Claims run fully silently in a hidden off-screen window. No store pages flash open, just a small toast when a game lands in your library.',
    '• Use the funnel next to "Free Games" in the side widget to switch modes: Games (auto-claim), All (manual, includes DLC/soundtracks/demos) or Free Weekend.',
    '• Customize everything via the side-tab on the storefront or in Plugin Settings.',
  ].join('\n');
}

export function showWelcomeIfFirstTime(): void {
  if (alreadySeen()) return;
  let tries = 0;
  const tryShow = () => {
    if (tries++ > 60) return;
    const dialogs = getDialogs();
    if (!dialogs) {
      setTimeout(tryShow, 250);
      return;
    }
    if (alreadySeen()) return;
    markSeen();
    if (typeof dialogs.ShowAlertDialog === 'function') {
      dialogs.ShowAlertDialog!(
        'Welcome to Auto Claim!',
        buildWelcomeText(),
        'Got it — start grabbing!',
      );
    } else {
      dialogs.ShowConfirmDialog!(
        'Welcome to Auto Claim!',
        buildWelcomeText(),
        'Got it — start grabbing!',
      );
    }
  };
  setTimeout(tryShow, 1500);
}
