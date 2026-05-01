import { callable } from '@steambrew/webkit';

type StrIn = [{ payload: string }];
type Empty = [];
export const loadPluginSettingsIPC = callable<Empty, string>('load_settings_ipc');
export const savePluginSettingsIPC = callable<StrIn, number>('save_settings_ipc');

export const loadWidgetSettingsIPC = callable<Empty, string>('load_widget_settings_ipc');
export const saveWidgetSettingsIPC = callable<StrIn, number>('save_widget_settings_ipc');

export const loadFreeGamesCacheIPC = callable<Empty, string>('load_free_games_cache_ipc');

export const saveCookiesIPC = callable<StrIn, number>('save_cookies_ipc');

export const getPendingClaimIPC   = callable<Empty, string>('get_pending_claim_ipc');
export const clearPendingClaimIPC = callable<Empty, number>('clear_pending_claim_ipc');

export const pushToastIPC = callable<StrIn, number>('push_toast_ipc');

export const logIPC = callable<StrIn, number>('log_plugin');
