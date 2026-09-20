---@meta

---@class millennium
local millennium = {}

---@class PluginLogEntry
---@field message string Base64 encoded log message
---@field level integer Log level (0=debug, 1=info, 2=warn, 3=error)

---@class PluginLogs
---@field name string Display name of the plugin
---@field logs PluginLogEntry[] Array of log entries for this plugin

---@return boolean success True if the ready message was sent successfully
function millennium.ready() end

---@param moduleItem string Path to CSS file relative to steamui directory
---@param regexSelector? string Regex pattern for URL matching (default: ".*")
---@return integer moduleId Module ID for later removal, or 0 on failure
function millennium.add_browser_css(moduleItem, regexSelector) end

---@param moduleItem string Path to JS file relative to steamui directory
---@param regexSelector? string Regex pattern for URL matching (default: ".*")
---@return integer moduleId Module ID for later removal, or 0 on failure
function millennium.add_browser_js(moduleItem, regexSelector) end

---@param moduleId integer Module ID returned from add_browser_css or add_browser_js
---@return boolean success True if module was successfully removed
function millennium.remove_browser_module(moduleId) end

---@deprecated This function is not implemented and may be removed
---@return any
function millennium.get_user_settings() end

---@deprecated This function is not implemented and may be removed
---@return any
function millennium.set_user_settings_key() end

---@return string version Millennium version string (e.g., "1.0.0")
function millennium.version() end

---@return string steamPath Full path to Steam installation directory
function millennium.steam_path() end

---@return string installPath Full path to Millennium installation directory
function millennium.get_install_path() end

---@return string logsJson JSON string containing array of PluginLogs objects
function millennium.get_plugin_logs() end

---@param methodName string Name of the method to call on the frontend
---@param params? (string|number|boolean)[] Array of parameters (only string, number, boolean supported)
---@return any result Result from the frontend method call
function millennium.call_frontend_method(methodName, params) end

---@param pluginName string Name of the plugin to toggle
---@return any result Result of the toggle operation
function millennium.change_plugin_status(pluginName) end

---@param pluginName string Name of the plugin to check
---@return boolean enabled True if the plugin is enabled
function millennium.is_plugin_enabled(pluginName) end

---@return string buildDate Build timestamp string
function millennium.__internal_get_build_date() end

---@param version1 string The first version to compare
---@param version2 string version2
---@return number status -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2, -2 if there was an error parsing or comparing versions.
function millennium.cmp_version(version1, version2) end

return millennium
