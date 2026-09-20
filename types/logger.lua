---@meta

---@class logger
local logger = {}

---@param message string The message to log
function logger:info(message) end

---@param message string The warning message to log
function logger:warn(message) end

---@param message string The error message to log
function logger:error(message) end

return logger