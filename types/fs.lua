---@meta

---@class fs
local fs = {}

---@class fs.Entry
---@field name string Filename or directory name
---@field path string Full path
---@field is_directory boolean True if entry is a directory
---@field is_file boolean True if entry is a regular file
---@field is_symlink boolean True if entry is a symbolic link
---@field size? integer File size in bytes (only for regular files)
---@field depth? integer Depth in directory tree (only for recursive listings)

---@class fs.SpaceInfo
---@field capacity integer Total disk capacity in bytes
---@field free integer Free space in bytes
---@field available integer Available space in bytes for non-privileged users

-- ============= Path Queries =============

---@param path string Path to check
---@return boolean exists True if path exists
function fs.exists(path) end

---@param path string Path to check
---@return boolean is_dir True if path is a directory
function fs.is_directory(path) end

---@param path string Path to check
---@return boolean is_file True if path is a regular file
function fs.is_file(path) end

---@param path string Path to check
---@return boolean is_symlink True if path is a symbolic link
function fs.is_symlink(path) end

---@param path string Path to check
---@return boolean is_empty True if directory/file is empty
function fs.is_empty(path) end

-- ============= Directory Operations =============

---@param path string Directory path
---@return boolean|nil success True if created, false if already exists, nil on error
---@return string? error Error message if failed
function fs.create_directory(path) end

---@param path string Directory path
---@return boolean|nil success True if created, false if already exists, nil on error
---@return string? error Error message if failed
function fs.create_directories(path) end

---@param path string Path to remove
---@return boolean|nil success True if removed, false if doesn't exist, nil on error
---@return string? error Error message if failed
function fs.remove(path) end

---@param path string Path to remove
---@return integer|nil count Number of items removed, nil on error
---@return string? error Error message if failed
function fs.remove_all(path) end

---@param path string Directory path
---@return fs.Entry[]|nil entries Array of directory entries, nil on error
---@return string? error Error message if failed
function fs.list(path) end

---@param path string Directory path
---@return fs.Entry[]|nil entries Array of directory entries with depth info, nil on error
---@return string? error Error message if failed
function fs.list_recursive(path) end

-- ============= File Operations =============

---@param from string Source path
---@param to string Destination path
---@param throw_error? boolean If true, throws error on failure (default: false)
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function fs.copy(from, to, throw_error) end

---@param from string Source directory path
---@param to string Destination directory path
---@param throw_error? boolean If true, throws error on failure (default: false)
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function fs.copy_recursive(from, to, throw_error) end

---@param from string Source path
---@param to string Destination path
---@param throw_error? boolean If true, throws error on failure (default: false)
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function fs.rename(from, to, throw_error) end

---@param path string File path
---@return integer|nil size File size in bytes, nil on error
---@return string? error Error message if failed
function fs.file_size(path) end

---@param path string File path
---@return integer|nil timestamp Last write time in seconds since epoch, nil on error
---@return string? error Error message if failed
function fs.last_write_time(path) end

-- ============= Path Operations =============

---@return string|nil path Current working directory, nil on error
---@return string? error Error message if failed
function fs.current_path() end

---@param path string New working directory
---@return boolean|nil success True if successful, nil on error
---@return string? error Error message if failed
function fs.set_current_path(path) end

---@param path string Path to convert
---@return string|nil absolute Absolute path, nil on error
---@return string? error Error message if failed
function fs.absolute(path) end

---@param path string Path to convert
---@return string|nil canonical Canonical path, nil on error
---@return string? error Error message if failed
function fs.canonical(path) end

---@param path string Path to convert
---@param base? string Base path (default: current directory)
---@return string|nil relative Relative path, nil on error
---@return string? error Error message if failed
function fs.relative(path, base) end

---@param path string Path
---@return string filename Filename with extension
function fs.filename(path) end

---@param path string Path
---@return string extension File extension including the dot (e.g., ".txt")
function fs.extension(path) end

---@param path string Path
---@return string stem Filename without extension
function fs.stem(path) end

---@param path string Path
---@return string parent Parent directory path
function fs.parent_path(path) end

---@param ... string Path components to join
---@return string path Joined path
function fs.join(...) end

-- ============= Space Information =============

---@param path string Path to check
---@return fs.SpaceInfo|nil info Space information, nil on error
---@return string? error Error message if failed
function fs.space_info(path) end

return fs