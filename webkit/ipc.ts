import { callable } from '@steambrew/webkit';

type StrIn = [{ payload: string }];
type Empty = [];

export const loadPluginSettingsIPC = callable<Empty, string>('load_settings_ipc');
export const savePluginSettingsIPC = callable<StrIn, number>('save_settings_ipc');
export const loadWidgetSettingsIPC = callable<Empty, string>('load_widget_settings_ipc');
export const saveWidgetSettingsIPC = callable<StrIn, number>('save_widget_settings_ipc');
export const loadFreeGamesCacheIPC = callable<Empty, string>('load_free_games_cache_ipc');
export const loadFreeWeekendCacheIPC = callable<Empty, string>('load_free_weekend_cache_ipc');
export const loadGrabbedIPC        = callable<Empty, string>('load_grabbed_ipc');
export const pushToastIPC = callable<StrIn, number>('push_toast_ipc');
export const logIPC = callable<StrIn, number>('log_plugin');
export const tryAcquireClaimLockIPC = callable<StrIn, number>('try_acquire_claim_lock_ipc');
export const releaseClaimLockIPC    = callable<StrIn, number>('release_claim_lock_ipc');

