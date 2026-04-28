import {
  loadPluginSettingsIPC, savePluginSettingsIPC,
  loadWidgetSettingsIPC, saveWidgetSettingsIPC,
} from './ipc';
import type { PanelSide, TabStyle } from './types';

const LS_KEY = 'fgg_store_settings';

export interface PluginConfig {
  tabColor: string;
  showOverlay: boolean;
  panelSide: PanelSide;
  tabStyle: TabStyle;
  autoAdd: boolean;
  pollIntervalMin: number;
  notifyOnGrab: boolean;
}

export const cfg: PluginConfig = {
  tabColor: 'gray',
  showOverlay: false,
  panelSide: 'left',
  tabStyle: 'large',
  autoAdd: true,
  pollIntervalMin: 15,
  notifyOnGrab: true,
};

export let initialWidgetRaw = '';

const VALID_PANEL_SIDES: PanelSide[] = ['left', 'right'];
const VALID_TAB_STYLES: TabStyle[]   = ['slim', 'large', 'floating'];

function isPanelSide(v: any): v is PanelSide { return VALID_PANEL_SIDES.indexOf(v) !== -1; }
function isTabStyle(v: any):  v is TabStyle  { return VALID_TAB_STYLES.indexOf(v)  !== -1; }

function applyInto(target: PluginConfig, src: any): void {
  if (!src || typeof src !== 'object') return;

  if (typeof src.tabColor    === 'string')  target.tabColor    = src.tabColor;
  if (typeof src.showOverlay === 'boolean') target.showOverlay = src.showOverlay;
  if (isPanelSide(src.panelSide))           target.panelSide   = src.panelSide;
  if (isTabStyle(src.tabStyle))             target.tabStyle    = src.tabStyle;
  if (typeof src.autoAdd     === 'boolean') target.autoAdd     = src.autoAdd;
  if (typeof src.pollIntervalMin === 'number') target.pollIntervalMin = src.pollIntervalMin;
  if (typeof src.notifyOnGrab === 'boolean') target.notifyOnGrab = src.notifyOnGrab;
}

function loadFromLocalStorage(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    applyInto(cfg, JSON.parse(raw));
  } catch {}
}

function snapshotForLocalStorage() {
  return {
    tabColor:        cfg.tabColor,
    showOverlay:     cfg.showOverlay,
    panelSide:       cfg.panelSide,
    tabStyle:        cfg.tabStyle,
    autoAdd:         cfg.autoAdd,
    pollIntervalMin: cfg.pollIntervalMin,
    notifyOnGrab:    cfg.notifyOnGrab,
  };
}

function widgetOnlyPayload() {
  return {
    tabColor:    cfg.tabColor,
    showOverlay: cfg.showOverlay,
    panelSide:   cfg.panelSide,
    tabStyle:    cfg.tabStyle,
  };
}

function pluginOnlyPayload() {
  return {
    autoAdd:         cfg.autoAdd,
    pollIntervalMin: cfg.pollIntervalMin,
    notifyOnGrab:    cfg.notifyOnGrab,
  };
}

export function saveSettings(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(snapshotForLocalStorage()));
  } catch {}

  saveWidgetSettingsIPC({ payload: JSON.stringify(widgetOnlyPayload()) })
    .catch(() => {});

  loadPluginSettingsIPC()
    .then((raw) => {
      let existing: any = {};
      try { existing = JSON.parse(raw || '{}'); } catch {}
      const merged = Object.assign({}, existing, pluginOnlyPayload());
      return savePluginSettingsIPC({ payload: JSON.stringify(merged) });
    })
    .catch(() => {});
}

export async function initSettingsFromLua(): Promise<void> {
  loadFromLocalStorage();

  try {
    const [pluginRaw, widgetRaw] = await Promise.all([
      loadPluginSettingsIPC(),
      loadWidgetSettingsIPC(),
    ]);

    initialWidgetRaw = widgetRaw || '';

    let plugin: any = {};
    let widget: any = {};
    try { plugin = JSON.parse(pluginRaw || '{}'); } catch {}
    try { widget = JSON.parse(widgetRaw || '{}'); } catch {}

    applyInto(cfg, plugin);
    applyInto(cfg, widget);

    saveSettings();
  } catch {}
}
