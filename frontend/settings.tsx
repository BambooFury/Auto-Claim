import {
  ButtonItem,
  Spinner,
} from 'millennium';
import React from 'react';
import { DEFAULT_SETTINGS } from './config';
import { openManager } from './manager';
import { SettingsRows, usePluginSettings } from './settingsRows';

export const SettingsTab: React.FC<{ showManagerButton?: boolean }> = ({ showManagerButton = true }) => {
  const [settings, update] = usePluginSettings();

  if (!settings) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 16px' }}>
      <SettingsRows settings={settings} update={update} />

      {showManagerButton && (
        <ButtonItem layout="below" onClick={openManager}>
          Open Games Manager
        </ButtonItem>
      )}

      <ButtonItem
        layout="below"
        onClick={() => {
          update({ ...DEFAULT_SETTINGS });
        }}
      >
        Reset to defaults
      </ButtonItem>
    </div>
  );
};
