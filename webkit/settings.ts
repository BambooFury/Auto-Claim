import {
  loadPluginSettingsIPC, savePluginSettingsIPC,
  loadWidgetSettingsIPC, saveWidgetSettingsIPC,
} from './ipc';
import type { PanelSide, TabStyle, FilterMode } from './types';

const LS_KEY = 'fgg_store_settings';

interface PluginConfig {
  tabColor: string;
  accentColor: string;
  indicatorColor: string;
  showOverlay: boolean;
  panelSide: PanelSide;
  tabStyle: TabStyle;
  autoAdd: boolean;
  pollIntervalMin: number;
  notifyOnGrab: boolean;
  hideOwned: boolean;
  filterMode: FilterMode;
}

export const cfg: PluginConfig = {
  tabColor: 'gray',
  accentColor: 'rgba(255,255,255,0.5)',
  indicatorColor: '#ff7a3c',
  showOverlay: false,
  panelSide: 'left',
  tabStyle: 'large',
  autoAdd: false,
  pollIntervalMin: 30,
  notifyOnGrab: true,
  hideOwned: false,
  filterMode: 'games',
};

export let initialWidgetRaw = '';

const VALID_PANEL_SIDES: PanelSide[]  = ['left', 'right'];
const VALID_TAB_STYLES: TabStyle[]    = ['slim', 'large', 'floating'];
const VALID_FILTER_MODES: FilterMode[] = ['games', 'all', 'weekend'];

function isPanelSide(v: any):  v is PanelSide  { return VALID_PANEL_SIDES.indexOf(v)  !== -1; }
function isTabStyle(v: any):   v is TabStyle   { return VALID_TAB_STYLES.indexOf(v)   !== -1; }
function isFilterMode(v: any): v is FilterMode { return VALID_FILTER_MODES.indexOf(v) !== -1; }

function applyInto(target: PluginConfig, src: any): void {
  if (!src || typeof src !== 'object') return;

  if (typeof src.tabColor       === 'string') target.tabColor       = src.tabColor;
  if (typeof src.accentColor    === 'string') target.accentColor    = src.accentColor;
  if (typeof src.indicatorColor === 'string') target.indicatorColor = src.indicatorColor;
  if (typeof src.showOverlay === 'boolean') target.showOverlay = src.showOverlay;
  if (isPanelSide(src.panelSide))           target.panelSide   = src.panelSide;
  if (isTabStyle(src.tabStyle))             target.tabStyle    = src.tabStyle;
  if (typeof src.autoAdd     === 'boolean') target.autoAdd     = src.autoAdd;
  if (typeof src.pollIntervalMin === 'number') {
   const ALLOWED_INTERVALS = [30, 120, 1440];
const iv = src.pollIntervalMin === 60 ? 120 : src.pollIntervalMin;
target.pollIntervalMin = ALLOWED_INTERVALS.indexOf(iv) !== -1
  ? iv
  : 30;
  }
  if (typeof src.notifyOnGrab === 'boolean') target.notifyOnGrab = src.notifyOnGrab;
  if (typeof src.hideOwned   === 'boolean') target.hideOwned    = src.hideOwned;
  if (isFilterMode(src.filterMode))          target.filterMode   = src.filterMode;
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
    accentColor:     cfg.accentColor,
    indicatorColor:  cfg.indicatorColor,
    showOverlay:     cfg.showOverlay,
    panelSide:       cfg.panelSide,
    tabStyle:        cfg.tabStyle,
    autoAdd:         cfg.autoAdd,
    pollIntervalMin: cfg.pollIntervalMin,
    notifyOnGrab:    cfg.notifyOnGrab,
    hideOwned:       cfg.hideOwned,
    filterMode:      cfg.filterMode,
  };
}

function widgetOnlyPayload() {
  return {
    tabColor:       cfg.tabColor,
    accentColor:    cfg.accentColor,
    indicatorColor: cfg.indicatorColor,
    showOverlay:    cfg.showOverlay,
    panelSide:      cfg.panelSide,
    tabStyle:       cfg.tabStyle,
    filterMode:     cfg.filterMode,
  };
}

function pluginOnlyPayload() {
  return {
    autoAdd:         cfg.autoAdd,
    pollIntervalMin: cfg.pollIntervalMin,
    notifyOnGrab:    cfg.notifyOnGrab,
    hideOwned:       cfg.hideOwned,
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
      const merged: any = Object.assign({}, existing, pluginOnlyPayload());
      delete merged.notifyOnly;
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
