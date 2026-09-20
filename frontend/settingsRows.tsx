import {
  DropdownItem,
  ToggleField,
} from 'millennium';
import React from 'react';
import {
  DEFAULT_SETTINGS,
  INTERVAL_OPTIONS,
  PluginSettings,
  normalizeSettings,
} from './config';
import { loadSettingsIPC, saveSettingsIPC } from './ipc';

export function usePluginSettings(): [PluginSettings | null, (patch: Partial<PluginSettings>) => void] {
  const [settings, setSettings] = React.useState<PluginSettings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await loadSettingsIPC();
        if (!cancelled) setSettings(normalizeSettings(JSON.parse(raw || '{}')));
      } catch {
        if (!cancelled) setSettings({ ...DEFAULT_SETTINGS });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = React.useCallback((patch: Partial<PluginSettings>): void => {
    setSettings((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch };
      void loadSettingsIPC()
        .then((raw) => {
          let current: Record<string, unknown> = {};
          try { current = JSON.parse(raw || '{}'); } catch {}
          const merged = { ...current, ...patch };
          return saveSettingsIPC({ payload: JSON.stringify(merged) })
            .then(() => setSettings(normalizeSettings(merged)));
        })
        .catch(() => {});
      return next;
    });
  }, []);

  return [settings, update];
}

export function SettingsRows({
  settings,
  update,
}: {
  settings: PluginSettings;
  update: (patch: Partial<PluginSettings>) => void;
}): React.JSX.Element {
  return (
    <>
      <ToggleField
        label="Auto-add to library"
        description="Claim free games automatically on scan. When off, you only get notifications."
        checked={settings.autoAdd}
        onChange={(checked) => update({ autoAdd: checked })}
      />

      <ToggleField
        label="Notify on grab"
        description="Show a toast when a game is added to your library."
        checked={settings.notifyOnGrab}
        onChange={(checked) => update({ notifyOnGrab: checked })}
      />

      <ToggleField
        label="Hide owned games"
        description="Don't show games you already own in the manager."
        checked={settings.hideOwned}
        onChange={(checked) => update({ hideOwned: checked })}
      />

      <DropdownItem
        label="Scan interval"
        description="How often to check the Steam store for free games."
        rgOptions={INTERVAL_OPTIONS}
        selectedOption={settings.pollIntervalMin}
        onChange={(opt) => update({ pollIntervalMin: opt.data as number })}
      />
    </>
  );
}
