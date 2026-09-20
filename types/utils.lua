---@meta

---@class utils
local utils = {}

-- ============= Time/Sleep =============

---@param milliseconds integer Number of milliseconds to sleep
function utils.sleep(milliseconds) end

---@return number timestamp Current time in seconds
function utils.time() end

---@return integer timestamp Current time in milliseconds
function utils.time_ms() end

---@return integer timestamp Current time in microseconds
function utils.time_micro() end

-- ============= Math =============

---@param num number Number to round
---@return number rounded Rounded number
function utils.round(num) end

---@param value number Value to clamp
---@param min number Minimum value
---@param max number Maximum value
---@return number clamped Clamped value
function utils.clamp(value, min, max) end

---@param num number Number to check
---@return integer sign -1 for negative, 0 for zero, 1 for positive
function utils.sign(num) end

---@param a number Start value
---@param b number End value
---@param t number Interpolation factor (0.0 to 1.0)
---@return number result Interpolated value
function utils.lerp(a, b, t) end

-- ============= Random =============

---@param min integer Minimum value
---@param max integer Maximum value
---@return integer random Random integer
function utils.random_int(min, max) end

---@param min? number Minimum value (default: 0.0)
---@param max? number Maximum value (default: 1.0)
---@return number random Random float
function utils.random_float(min, max) end

---@param seed integer Seed value
function utils.random_seed(seed) end

-- ============= String Operations =============

---@param str string String to split
---@param delim string Delimiter
---@return string[] parts Array of split strings
function utils.split(str, delim) end

---@param str string String to trim
---@return string trimmed Trimmed string
function utils.trim(str) end

---@param str string String to trim
---@return string trimmed Trimmed string
function utils.ltrim(str) end

---@param str string String to trim
---@return string trimmed Trimmed string
function utils.rtrim(str) end

---@param str string String to check
---@param prefix string Prefix to look for
---@return boolean result True if string starts with prefix
function utils.startswith(str, prefix) end

---@param str string String to check
---@param suffix string Suffix to look for
---@return boolean result True if string ends with suffix
function utils.endswith(str, suffix) end

---@param arr string[] Array of strings
---@param delim string Delimiter
---@return string joined Joined string
function utils.join(arr, delim) end

-- ============= Table Operations =============

---@param tbl table Table to search
---@param value any Value to find
---@return boolean found True if value is in table
function utils.contains(tbl, value) end

---@param tbl table Table to slice
---@param start integer Start index (1-based)
---@param end_idx? integer End index (default: length of table)
---@return table slice New table containing the slice
function utils.slice(tbl, start, end_idx) end

---@param tbl table Table to extract keys from
---@return any[] keys Array of keys
function utils.keys(tbl) end

---@param tbl table Table to extract values from
---@return any[] values Array of values
function utils.values(tbl) end

---@param tbl1 table First table
---@param tbl2 table Second table
---@return table merged New merged table
function utils.merge(tbl1, tbl2) end

-- ============= System/Environment =============

---@param name string Environment variable name
---@return string|nil value Environment variable value or nil if not found
function utils.getenv(name) end

---@param name string Environment variable name
---@param value string Environment variable value
---@return boolean success True if successful
function utils.setenv(name, value) end

---@param cmd string Command to execute
---@return string|nil output Command output or nil on error
---@return integer|string status Exit status or error message
function utils.exec(cmd) end

-- ============= Encoding =============

---@param input string String to encode
---@return string encoded Base64 encoded string
function utils.base64_encode(input) end

---@param input string String to encode
---@return string encoded URL encoded string
function utils.url_encode(input) end

---@param input string Binary data to encode
---@return string hex Hexadecimal string
function utils.hex_encode(input) end

---@param num integer Number to convert
---@return string hex Hexadecimal string (e.g., "0xff")
function utils.to_hex(num) end

---@param hex string Hexadecimal string
---@return integer num Integer value
function utils.from_hex(hex) end

-- ============= UUID & Hash =============

---@return string uuid UUID string (e.g., "550e8400-e29b-41d4-a716-446655440000")
function utils.uuid() end

---@param str string String to hash
---@return integer hash Hash value
function utils.hash(str) end

-- ============= File I/O =============

---@param path string File path
---@return string|nil content File contents or nil on error
---@return string? error Error message if failed
function utils.read_file(path) end

---@param path string File path
---@param content string Content to write
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function utils.write_file(path, content) end

---@param path string File path
---@param content string Content to append
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function utils.append_file(path, content) end

-- ============= Millennium Specific =============

---@return string|nil path Backend path or nil if not set
function utils.get_backend_path() end

return utils