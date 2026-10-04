import {
  DropdownItem,
  ToggleField,
} from 'millennium';
import React from 'react';
import {
  ALLOWED_INTERVALS,
  DEFAULT_SETTINGS,
  intervalLabel,
  PluginSettings,
  normalizeSettings,
} from './config';
import { loadSettingsIPC, saveSettingsIPC } from './ipc';
import { getLocalizationVersion, setLocalizationEnabled, subscribeLocalization, t } from './i18n';

export function useLocalization(): number {
  return React.useSyncExternalStore(subscribeLocalization, getLocalizationVersion);
}

export function usePluginSettings(): [PluginSettings | null, (patch: Partial<PluginSettings>) => void] {
  const [settings, setSettings] = React.useState<PluginSettings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await loadSettingsIPC();
        if (!cancelled) {
          const loaded = normalizeSettings(JSON.parse(raw || '{}'));
          setLocalizationEnabled(loaded.localized !== false);
          setSettings(loaded);
        }
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
  useLocalization();
  return (
    <>
      <ToggleField
        label={t('Auto-add to library')}
        description={t('Claim free games automatically on scan. When off, you only get notifications.')}
        checked={settings.autoAdd}
        onChange={(checked) => update({ autoAdd: checked })}
      />

      <ToggleField
        label={t('Notify on grab')}
        description={t('Show a toast when a game is added to your library.')}
        checked={settings.notifyOnGrab}
        onChange={(checked) => update({ notifyOnGrab: checked })}
      />

      <ToggleField
        label={t('Hide owned games')}
        description={t("Don't show games you already own in the manager.")}
        checked={settings.hideOwned}
        onChange={(checked) => update({ hideOwned: checked })}
      />

      <ToggleField
        label={t('Interface language')}
        description={t('The plugin uses your Steam language.')}
        checked={settings.localized !== false}
        onChange={(checked) => {
          setLocalizationEnabled(checked);
          update({ localized: checked });
        }}
      />

      <ToggleField
        label={t('New games indicator')}
        description={t('Show a red dot on the gift button when new free games are found.')}
        checked={settings.showIndicator}
        onChange={(checked) => update({ showIndicator: checked })}
      />

      <DropdownItem
        label={t('Scan interval')}
        description={t('How often to check the Steam store for free games.')}
        rgOptions={ALLOWED_INTERVALS.map((min) => ({ data: min, label: intervalLabel(min) }))}
        selectedOption={settings.pollIntervalMin}
        onChange={(opt) => update({ pollIntervalMin: opt.data as number })}
      />
    </>
  );
}
