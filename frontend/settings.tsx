import {
  ButtonItem,
  Spinner,
} from 'millennium';
import React from 'react';
import { MdRefresh, MdSportsEsports } from 'react-icons/md';
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            <MdSportsEsports size={16} />
            Open Games Manager
          </span>
        </ButtonItem>
      )}

      <ButtonItem
        layout="below"
        onClick={() => {
          update({ ...DEFAULT_SETTINGS });
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
          <MdRefresh size={16} />
          Reset to defaults
        </span>
      </ButtonItem>
    </div>
  );
};
