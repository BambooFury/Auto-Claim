local logger     = require("logger")
local millennium = require("millennium")
local http       = require("http")
local _PURE_LUA_JSON_NULL = {}

local function _cp_to_utf8(code)
    if code < 0x80 then
        return string.char(code)
    elseif code < 0x800 then
        return string.char(0xC0 + math.floor(code/0x40), 0x80 + (code%0x40))
    elseif code < 0x10000 then
        return string.char(
            0xE0 + math.floor(code/0x1000),
            0x80 + (math.floor(code/0x40) % 0x40),
            0x80 + (code % 0x40))
    else
        return string.char(
            0xF0 + math.floor(code/0x40000),
            0x80 + (math.floor(code/0x1000) % 0x40),
            0x80 + (math.floor(code/0x40) % 0x40),
            0x80 + (code % 0x40))
    end
end

local function _pure_lua_json_decode(src)
    if type(src) ~= "string" then return nil end
    local pos, len = 1, #src

    local function skip_ws()
        while pos <= len do
            local c = src:byte(pos)
            if c == 32 or c == 9 or c == 10 or c == 13 then pos = pos + 1
            else return end
        end
    end

    local parse_value

    local function parse_string()
        if src:byte(pos) ~= 34 then error("expected string at " .. pos) end
        pos = pos + 1
        local out = {}
        while pos <= len do
            local c = src:byte(pos)
            if c == 34 then pos = pos + 1; return table.concat(out)
            elseif c == 92 then
                local esc = src:byte(pos + 1)
                if     esc == 34  then out[#out+1] = '"';  pos = pos + 2
                elseif esc == 92  then out[#out+1] = '\\'; pos = pos + 2
                elseif esc == 47  then out[#out+1] = '/';  pos = pos + 2
                elseif esc == 98  then out[#out+1] = '\b'; pos = pos + 2
                elseif esc == 102 then out[#out+1] = '\f'; pos = pos + 2
                elseif esc == 110 then out[#out+1] = '\n'; pos = pos + 2
                elseif esc == 114 then out[#out+1] = '\r'; pos = pos + 2
                elseif esc == 116 then out[#out+1] = '\t'; pos = pos + 2
                elseif esc == 117 then
                    local code = tonumber(src:sub(pos + 2, pos + 5), 16) or 0
                    pos = pos + 6
                    if code >= 0xD800 and code <= 0xDBFF
                        and src:byte(pos) == 92 and src:byte(pos + 1) == 117 then
                        local low = tonumber(src:sub(pos + 2, pos + 5), 16) or 0
                        if low >= 0xDC00 and low <= 0xDFFF then
                            code = (code - 0xD800) * 0x400 + (low - 0xDC00) + 0x10000
                            pos = pos + 6
                        end
                    end
                    out[#out+1] = _cp_to_utf8(code)
                else
                    out[#out+1] = string.char(esc); pos = pos + 2
                end
            else
                out[#out+1] = string.char(c); pos = pos + 1
            end
        end
        error("unterminated string")
    end

    local function parse_number()
        local start = pos
        while pos <= len do
            local c = src:byte(pos)
            if (c >= 48 and c <= 57) or c == 45 or c == 43 or c == 46 or c == 101 or c == 69 then
                pos = pos + 1
            else break end
        end
        return tonumber(src:sub(start, pos - 1))
    end

    local function parse_literal(word, value)
        if src:sub(pos, pos + #word - 1) == word then
            pos = pos + #word
            return value
        end
        error("unknown literal at " .. pos)
    end

    local function parse_array()
        pos = pos + 1
        local arr = {}
        skip_ws()
        if src:byte(pos) == 93 then pos = pos + 1; return arr end
        while pos <= len do
            skip_ws()
            arr[#arr + 1] = parse_value()
            skip_ws()
            local c = src:byte(pos)
            if c == 44 then pos = pos + 1
            elseif c == 93 then pos = pos + 1; return arr
            else error("expected , or ] at " .. pos) end
        end
        error("unterminated array")
    end

    local function parse_object()
        pos = pos + 1
        local obj = {}
        skip_ws()
        if src:byte(pos) == 125 then pos = pos + 1; return obj end
        while pos <= len do
            skip_ws()
            local key = parse_string()
            skip_ws()
            if src:byte(pos) ~= 58 then error("expected : at " .. pos) end
            pos = pos + 1
            skip_ws()
            obj[key] = parse_value()
            skip_ws()
            local c = src:byte(pos)
            if c == 44 then pos = pos + 1
            elseif c == 125 then pos = pos + 1; return obj
            else error("expected , or } at " .. pos) end
        end
        error("unterminated object")
    end

    parse_value = function()
        skip_ws()
        local c = src:byte(pos)
        if c == 123 then return parse_object()
        elseif c == 91 then return parse_array()
        elseif c == 34 then return parse_string()
        elseif c == 116 then return parse_literal("true",  true)
        elseif c == 102 then return parse_literal("false", false)
        elseif c == 110 then return parse_literal("null",  _PURE_LUA_JSON_NULL)
        elseif c == 45 or (c >= 48 and c <= 57) then return parse_number()
        else error("unexpected char at " .. pos) end
    end

    local ok, result = pcall(parse_value)
    if not ok then return nil end
    return result
end

local _pure_lua_json = {
    null   = _PURE_LUA_JSON_NULL,
    decode = _pure_lua_json_decode,
}

local cjson = (function()
    local ok, mod = pcall(require, "cjson.safe")
    if ok and mod and type(mod.decode) == "function" then
        logger:info("[AutoClaim] JSON backend: cjson.safe (native)")
        return mod
    end
    local ok2, mod2 = pcall(require, "cjson")
    if ok2 and mod2 and type(mod2.decode) == "function" then
        logger:info("[AutoClaim] JSON backend: cjson (native)")
        return mod2
    end
    return _pure_lua_json
end)()
local PLUGIN_DIR = (function()
    local src = debug.getinfo(1, "S").source or ""
    if src:sub(1, 1) == "@" then src = src:sub(2) end
    src = src:gsub("/", "\\")
    return src:match("^(.+)\\backend\\") or "."
end)()

local GRABBED_FILE      = PLUGIN_DIR .. "\\grabbed.json"

local _current_steamid  = ""

local function _grabbed_file_for_current_user()
    if _current_steamid ~= "" and _current_steamid:match("^%d+$") then
        return PLUGIN_DIR .. "\\grabbed_" .. _current_steamid .. ".json"
    end
    return GRABBED_FILE
end
local SETTINGS_FILE     = PLUGIN_DIR .. "\\settings.json"
local WIDGETS_FILE      = PLUGIN_DIR .. "\\widget_settings.json"
local CACHE_FILE        = PLUGIN_DIR .. "\\free_games_cache.json"
local TOASTS_FILE       = PLUGIN_DIR .. "\\pending_toasts.json"
local CLAIM_LOCK_FILE   = PLUGIN_DIR .. "\\claim_inflight.json"
local CLAIM_LOCK_TTL    = 60

_G.__autoclaim_scan_seq      = _G.__autoclaim_scan_seq or 0
_G.__autoclaim_scan_done_seq = _G.__autoclaim_scan_done_seq or 0

local STORE_HOST     = "https://store.steampowered.com"
local SEARCH_BASE    = STORE_HOST .. "/search/results/?specials=1&maxprice=free&json=1&count=50&l=english"
local SEARCH_REGIONS = { "us", "de", "tr" }
local GAMERPOWER_URL = "https://www.gamerpower.com/api/giveaways?platform=steam&type=game"
local APPDETAILS_URL = STORE_HOST .. "/api/appdetails"

local function _urlencode(s)
    return (s:gsub("[^%w%-_%.~]", function(c)
        return string.format("%%%02X", c:byte())
    end))
end

local function _json_escape_string(s)
    s = s:gsub('\\', '\\\\')
         :gsub('"', '\\"')
         :gsub('\n', '\\n')
         :gsub('\r', '\\r')
         :gsub('\t', '\\t')
         :gsub('\b', '\\b')
         :gsub('\f', '\\f')
    return (s:gsub('[%z\1-\31]', function(c)
        return string.format('\\u%04x', c:byte())
    end))
end

local function read_file(path)
    local f = io.open(path, "r")
    if not f then return nil end
    local body = f:read("*a")
    f:close()
    return body
end

local function safe_http_get(url, opts)
    local ok, res = pcall(http.get, url, opts or {})
    if not ok then
        logger:warn("[AutoClaim] safe_http_get crashed: " .. tostring(res))
        return nil
    end
    return res
end

local function write_file(path, content)
    local tmp = path .. ".tmp"
    local f = io.open(tmp, "w")
    if not f then return false end
    f:write(content)
    f:flush()
    f:close()

    if os.rename(tmp, path) then return true end

    os.remove(path)
    if os.rename(tmp, path) then return true end

    local f2 = io.open(path, "w")
    if not f2 then
        return false
    end
    f2:write(content)
    f2:close()
    os.remove(tmp)
    return true
end

local _MAX_IPC_PAYLOAD = 2 * 1024 * 1024

local function extract_payload(data)
    local payload
    if type(data) == "table" then payload = data.payload
    else payload = data end
    if type(payload) == "string" and #payload > _MAX_IPC_PAYLOAD then
        logger:warn("[AutoClaim] dropped oversized IPC payload (" .. #payload ..
            " bytes, max " .. _MAX_IPC_PAYLOAD .. ")")
        return nil
    end
    return payload
end

function load_grabbed_ipc()

    return read_file(_grabbed_file_for_current_user()) or "[]"
end

function set_current_steamid_ipc(data)
    local sid = extract_payload(data) or ""

    if sid == "76561197960265728" then
        _current_steamid = ""
    elseif sid:match("^%d+$") then
        _current_steamid = sid
    else
        _current_steamid = ""
    end
    return 1
end

function get_current_steamid_ipc()
    return _current_steamid
end

local function _is_array_table(t)
    if type(t) ~= "table" then return false end
    local n = 0
    for k, _ in pairs(t) do
        if type(k) ~= "number" then return false end
        n = n + 1
    end
    if n == 0 then return true end
    for i = 1, n do
        if t[i] == nil then return false end
    end
    return true
end

local function _is_object_table(t)
    if type(t) ~= "table" then return false end
    if next(t) == nil then return true end
    for k, _ in pairs(t) do
        if type(k) ~= "string" then return false end
    end
    return true
end

local function _is_valid_json_payload(payload, expected_kind)
    if type(payload) ~= "string" or payload == "" then return false end
    local ok, parsed = pcall(cjson.decode, payload)
    if not ok or type(parsed) ~= "table" then return false end
    if expected_kind == "array"  and not _is_array_table(parsed)  then return false end
    if expected_kind == "object" and not _is_object_table(parsed) then return false end
    return true
end

function save_grabbed_ipc(data)
    local payload = extract_payload(data)
    if not _is_valid_json_payload(payload, "array") then return 0 end
    write_file(_grabbed_file_for_current_user(), payload)
    return 1
end

function load_settings_ipc()
    return read_file(SETTINGS_FILE) or "{}"
end

function save_settings_ipc(data)
    local payload = extract_payload(data)
    if not _is_valid_json_payload(payload, "object") then return 0 end
    write_file(SETTINGS_FILE, payload)
    return 1
end

function load_widget_settings_ipc()
    return read_file(WIDGETS_FILE) or "{}"
end

function save_widget_settings_ipc(data)
    local payload = extract_payload(data)
    if not _is_valid_json_payload(payload, "object") then return 0 end
    write_file(WIDGETS_FILE, payload)
    return 1
end

function load_free_games_cache_ipc()
    return read_file(CACHE_FILE) or "[]"
end

function push_toast_ipc(data)
    local payload = extract_payload(data)
    if not _is_valid_json_payload(payload, "object") then return 0 end

    local raw  = read_file(TOASTS_FILE) or "[]"
    local trim = raw:gsub("%s+$", "")
    local combined
    if trim == "" or trim == "[]" then
        combined = "[" .. payload .. "]"
    elseif trim:sub(1, 1) == "[" and trim:sub(-1) == "]" then
        combined = trim:sub(1, -2) .. "," .. payload .. "]"
    else
        combined = "[" .. payload .. "]"
    end
    write_file(TOASTS_FILE, combined)

    return 1
end

local function _merge_toast_arrays(a, b)
    a = (a or ""):gsub("%s+$", "")
    b = (b or ""):gsub("%s+$", "")
    if a == "" or a == "[]" then return b ~= "" and b or "[]" end
    if b == "" or b == "[]" then return a end
    return a:sub(1, -2) .. "," .. b:sub(2)
end

function pop_toasts_ipc()
    local stash = TOASTS_FILE .. ".popping"

    local orphan = read_file(stash)
    if orphan then os.remove(stash) end

    if os.rename(TOASTS_FILE, stash) then
        local raw = read_file(stash) or "[]"
        os.remove(stash)
        return _merge_toast_arrays(orphan, raw)
    end

    os.remove(stash)
    if os.rename(TOASTS_FILE, stash) then
        local raw = read_file(stash) or "[]"
        os.remove(stash)
        return _merge_toast_arrays(orphan, raw)
    end

    if orphan and orphan ~= "" then
        return orphan
    end

    return read_file(TOASTS_FILE) or "[]"
end

function request_scan_ipc()
    _G.__autoclaim_scan_seq = (_G.__autoclaim_scan_seq or 0) + 1
    return 1
end

function pop_scan_request_ipc()
    return tostring(_G.__autoclaim_scan_seq or 0)
end

function pop_scan_done_ipc()
    return tostring(_G.__autoclaim_scan_done_seq or 0)
end

function log_plugin(data)
    local payload = extract_payload(data)
    if payload and payload ~= "" then
        logger:info("[AutoClaim] " .. tostring(payload))
    end
    return 1
end

local function _read_claim_locks()
    local raw = read_file(CLAIM_LOCK_FILE) or "{}"
    local ok, data = pcall(cjson.decode, raw)
    if ok and type(data) == "table" then return data end
    return {}
end

local function _prune_claim_locks(locks, now)
    for k, ts in pairs(locks) do
        if type(ts) ~= "number" or now - ts > CLAIM_LOCK_TTL then
            locks[k] = nil
        end
    end
    return locks
end

local function _write_claim_locks(locks)
    local chunks = {}
    for k, v in pairs(locks) do
        chunks[#chunks + 1] = '"' .. tostring(k) .. '":' .. tostring(v)
    end
    write_file(CLAIM_LOCK_FILE, "{" .. table.concat(chunks, ",") .. "}")
end

function try_acquire_claim_lock_ipc(data)
    local payload = extract_payload(data)
    local appid = tostring(tonumber(payload) or "")
    if appid == "" then return 0 end

    local now = os.time()
    local locks = _prune_claim_locks(_read_claim_locks(), now)
    if locks[appid] then return 0 end
    locks[appid] = now
    _write_claim_locks(locks)
    return 1
end

function release_claim_lock_ipc(data)
    local payload = extract_payload(data)
    local appid = tostring(tonumber(payload) or "")
    if appid == "" then return 0 end

    local locks = _prune_claim_locks(_read_claim_locks(), os.time())
    locks[appid] = nil
    _write_claim_locks(locks)
    return 1
end

local function _fetch_free_games_impl()
    local found     = {}
    local seen      = {}
    local fetch_ok  = false

    for _, cc in ipairs(SEARCH_REGIONS) do
        local url = SEARCH_BASE .. "&cc=" .. cc
        local res = safe_http_get(url, { timeout = 25 })
        if res and res.status == 200 then
            fetch_ok = true
            local ok, data = pcall(cjson.decode, res.body)
            if ok and type(data) == "table" and type(data.items) == "table" then
                for _, item in ipairs(data.items) do
                    local logo_url = type(item.logo) == "string" and item.logo or ""
                    logo_url = logo_url:gsub("\\/", "/")
                    local appid_str = logo_url:match("/apps/(%d+)/")
                    if appid_str then
                        local id = tonumber(appid_str)
                        if id and id > 0 and not seen[id] then
                            seen[id] = true
                            found[#found + 1] = {
                                appid = id,
                                name  = type(item.name) == "string" and item.name or ("AppID " .. appid_str),
                                cc    = cc,
                            }
                        end
                    end
                end
            end
        end
    end

    do
        local res = safe_http_get(GAMERPOWER_URL, { timeout = 15 })
        if res and res.status == 200 then
            local ok, data = pcall(cjson.decode, res.body)
            if ok and type(data) == "table" then
                local processed = 0
                for _, entry in ipairs(data) do
                    if processed >= 20 then break end
                    processed = processed + 1
                    local raw_title = type(entry.title) == "string" and entry.title or ""
                    local clean = raw_title
                        :gsub(" %(Steam%) [%w%s]+ Giveaway$", "")
                        :gsub(" %(Steam%) Giveaway$", "")
                        :gsub(" %(Steam%)$", "")
                        :gsub(" Giveaway$", "")
                    if clean and clean ~= "" then
                        local search_url = "https://store.steampowered.com/api/storesearch/?term=" ..
                            _urlencode(clean) .. "&l=english&cc=us"
                        local sres = safe_http_get(search_url, { timeout = 10 })
                        if sres and sres.status == 200 then
                            local sok, sdata = pcall(cjson.decode, sres.body)
                            if sok and type(sdata) == "table" and type(sdata.items) == "table" and sdata.items[1] then
                                local item = sdata.items[1]
                                local id = tonumber(item.id)
                                local name = type(item.name) == "string" and item.name or clean
                                if id and id > 0 and not seen[id] then
                                    seen[id] = true
                                    found[#found + 1] = { appid = id, name = name, from_gamerpower = true }
                                    logger:info("[AutoClaim] GamerPower found: " .. id .. " - " .. name)
                                end
                            end
                        end
                    end
                end
            end
        end
    end

    if not fetch_ok then
        return read_file(CACHE_FILE) or "[]"
    end

    local accepted_items = {}
    for _, g in ipairs(found) do
        local verify_cc = g.cc or "us"
        local dres = safe_http_get(APPDETAILS_URL .. "?appids=" .. g.appid .. "&cc=" .. verify_cc, { timeout = 10 })
        local accepted = false
        local detected_type = nil
        if dres and dres.status == 200 then
            local dok, ddata = pcall(cjson.decode, dres.body)
            if dok and type(ddata) == "table" then
                local entry = ddata[tostring(g.appid)]
                if entry and entry.data then
                    local app_type = entry.data.type
                    detected_type = app_type
                    if type(entry.data.header_image) == "string" then
                        g.header = entry.data.header_image
                    end
                    if type(entry.data.capsule_image) == "string" then
                        g.capsule = entry.data.capsule_image
                    end
                    local is_free = entry.data.is_free == true
                    local price_final = nil
                    if entry.data.price_overview and type(entry.data.price_overview.final) == "number" then
                        price_final = entry.data.price_overview.final
                    end
                    local is_currently_free = is_free or price_final == 0
                    local is_listable_type =
                        app_type == "game" or app_type == "dlc" or
                        app_type == "music" or app_type == "demo"
                    if g.from_gamerpower then
                        if app_type == "game" and is_currently_free then
                            accepted = true
                        end
                    else
                        if is_listable_type and is_currently_free then
                            accepted = true
                        end
                    end
                end
            end
        elseif not g.from_gamerpower then
            accepted = true
        end
        if accepted then
            g.type = detected_type or "unknown"
            accepted_items[#accepted_items + 1] = g
        end
    end

    local chunks = {}
    for _, g in ipairs(accepted_items) do
        local safe_name = _json_escape_string(g.name)
        local safe_type = _json_escape_string(g.type or "unknown")
        local extra = ""
        if type(g.header) == "string" and g.header ~= "" then
            extra = extra .. ',"header":"' .. _json_escape_string(g.header) .. '"'
        end
        if type(g.capsule) == "string" and g.capsule ~= "" then
            extra = extra .. ',"capsule":"' .. _json_escape_string(g.capsule) .. '"'
        end
        chunks[#chunks + 1] = '{"appid":' .. g.appid ..
            ',"name":"' .. safe_name ..
            '","type":"' .. safe_type .. '"' .. extra .. '}'
    end
    local json_out = "[" .. table.concat(chunks, ",") .. "]"
    write_file(CACHE_FILE, json_out)
    return json_out
end

function fetch_free_games_backend()
    local ok, result = pcall(_fetch_free_games_impl)
    _G.__autoclaim_scan_done_seq = (_G.__autoclaim_scan_done_seq or 0) + 1
    if not ok then
        logger:info("[AutoClaim] scan failed: " .. tostring(result))
        return read_file(CACHE_FILE) or "[]"
    end
    return result
end

local function on_load()
    logger:info("[AutoClaim] Loaded, Millennium " .. millennium.version())
    millennium.ready()
end

local function on_unload() end

local function on_frontend_loaded() end

return {
    on_load            = on_load,
    on_unload          = on_unload,
    on_frontend_loaded = on_frontend_loaded,
}
