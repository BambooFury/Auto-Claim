local logger     = require("logger")
local millennium = require("millennium")
local http       = require("http")
local PLUGIN_DIR = debug.getinfo(1, "S").source:match("^@(.+)\\backend\\") or "."

local GRABBED_FILE   = PLUGIN_DIR .. "\\grabbed.json"
local SETTINGS_FILE  = PLUGIN_DIR .. "\\settings.json"
local WIDGETS_FILE   = PLUGIN_DIR .. "\\widget_settings.json"
local CACHE_FILE     = PLUGIN_DIR .. "\\free_games_cache.json"
local COOKIES_FILE   = PLUGIN_DIR .. "\\steam_cookies.json"
local PENDING_FILE   = PLUGIN_DIR .. "\\claim_pending.json"
local TOASTS_FILE    = PLUGIN_DIR .. "\\pending_toasts.json"

local STORE_HOST     = "https://store.steampowered.com"
local SEARCH_BASE    = STORE_HOST .. "/search/results/?specials=1&maxprice=free&json=1&count=50&l=english"
local SEARCH_REGIONS = { "us", "ua", "ru", "de", "gb", "tr" }
local GAMERPOWER_URL = "https://www.gamerpower.com/api/giveaways?platform=steam&type=game"
local APPDETAILS_URL = STORE_HOST .. "/api/appdetails"
local PKGDETAILS_URL = STORE_HOST .. "/api/packagedetails"
local CLAIM_URL      = STORE_HOST .. "/checkout/addfreelicense"

local function read_file(path)
    local f = io.open(path, "r")
    if not f then return nil end
    local body = f:read("*a")
    f:close()
    return body
end

local function write_file(path, content)
    local f = io.open(path, "w")
    if not f then return false end
    f:write(content)
    f:close()
    return true
end

local function extract_payload(data)
    if type(data) == "table" then return data.payload end
    return data
end

function load_grabbed_ipc()
    return read_file(GRABBED_FILE) or "[]"
end

function save_grabbed_ipc(data)
    local payload = extract_payload(data)
    if not payload then return 0 end
    write_file(GRABBED_FILE, payload)
    return 1
end

function load_settings_ipc()
    return read_file(SETTINGS_FILE) or "{}"
end

function save_settings_ipc(data)
    local payload = extract_payload(data)
    if not payload then return 0 end
    write_file(SETTINGS_FILE, payload)
    return 1
end

function load_widget_settings_ipc()
    return read_file(WIDGETS_FILE) or "{}"
end

function save_widget_settings_ipc(data)
    local payload = extract_payload(data)
    if not payload then return 0 end
    write_file(WIDGETS_FILE, payload)
    return 1
end

function load_free_games_cache_ipc()
    return read_file(CACHE_FILE) or "[]"
end

function save_cookies_ipc(data)
    local payload = extract_payload(data)
    if not payload or payload == "" then return 0 end
    write_file(COOKIES_FILE, payload)
    return 1
end

function load_cookies_ipc()
    return read_file(COOKIES_FILE) or "{}"
end

function set_pending_claim_ipc(data)
    local payload = extract_payload(data)
    if not payload or payload == "" then
        os.remove(PENDING_FILE)
        return 1
    end
    write_file(PENDING_FILE, tostring(payload))
    return 1
end

function get_pending_claim_ipc()
    return read_file(PENDING_FILE) or ""
end

function clear_pending_claim_ipc()
    os.remove(PENDING_FILE)
    return 1
end

function push_toast_ipc(data)
    local payload = extract_payload(data)
    if not payload or payload == "" then return 0 end

    local raw  = read_file(TOASTS_FILE) or "[]"
    local trim = raw:gsub("%s+$", "")

    local combined
    if trim == "" or trim == "[]" then
        combined = "[" .. payload .. "]"
    else
        combined = trim:sub(1, -2) .. "," .. payload .. "]"
    end

    write_file(TOASTS_FILE, combined)
    return 1
end

function pop_toasts_ipc()
    local raw = read_file(TOASTS_FILE) or "[]"
    os.remove(TOASTS_FILE)
    return raw
end

local function load_cookie_header()
    local raw = read_file(COOKIES_FILE)
    if not raw then return "", "" end

    local pairs_list = {}
    local sid = ""

    for k, v in raw:gmatch('"([^"]+)"%s*:%s*"([^"]*)"') do
        if v ~= "" then
            pairs_list[#pairs_list + 1] = k .. "=" .. v
            if k == "sessionid" then sid = v end
        end
    end

    return table.concat(pairs_list, "; "), sid
end

function log_plugin(data)
    local payload = extract_payload(data)
    if payload and payload ~= "" then
        logger:info("[AutoClaim] " .. tostring(payload))
    end
    return 1
end

local function claim_subid(subid, sessionid_override, appid_hint)
    if not subid or subid == "" or subid == "-1" then
        return false, "no subid"
    end

    local cookie_header, stored_sid = load_cookie_header()
    local sessionid = (sessionid_override and sessionid_override ~= "")
        and sessionid_override
        or  stored_sid

    if cookie_header == "" then
        return false, "no cookies — open Steam Store once so the widget can capture them"
    end
    if sessionid == "" then
        return false, "no sessionid in stored cookies"
    end

    local body    = "action=add_to_cart&sessionid=" .. sessionid .. "&subid=" .. subid
    local referer = appid_hint
        and (STORE_HOST .. "/app/" .. appid_hint .. "/")
        or  (STORE_HOST .. "/")

    local res, err = http.post(CLAIM_URL, body, {
        timeout = 15,
        headers = {
            ["Content-Type"]      = "application/x-www-form-urlencoded",
            ["Referer"]           = referer,
            ["Origin"]            = STORE_HOST,
            ["Cookie"]            = cookie_header,
            ["X-Requested-With"]  = "XMLHttpRequest",
        },
    })

    if not res then
        return false, "http error: " .. tostring(err)
    end
    if res.status ~= 200 then
        return false, "http " .. tostring(res.status)
    end
    if res.body:find("Sign In", 1, true) or res.body:find("login", 1, true) then
        return false, "session expired"
    end
    return true, "ok"
end

function add_free_license(data)
    local payload = extract_payload(data)
    if not payload then return "0" end

    local subid, sessionid = payload:match("^([^|]+)|(.*)$")
    if not subid then
        subid = payload
        sessionid = ""
    end

    local ok = claim_subid(subid, sessionid, nil)
    return ok and "1" or "0"
end

local function fetch_subid_for_appid(appid)
    local url = APPDETAILS_URL
        .. "?appids=" .. appid
        .. "&filters=packages,package_groups,price_overview&cc=ua"

    local res = http.get(url, { timeout = 15 })
    if not res or res.status ~= 200 then return nil end

    local subid = res.body:match('"price_in_cents_with_discount"%s*:%s*0%s*,%s*"packageid"%s*:%s*(%d+)')
    if not subid then
        subid = res.body:match('"packageid"%s*:%s*(%d+)%s*,[^}]-"price_in_cents_with_discount"%s*:%s*0')
    end
    if not subid then
        subid = res.body:match('"packages"%s*:%s*%[%s*(%d+)')
    end

    if not subid then
        local candidates = {}
        for inner in res.body:gmatch('"packages"%s*:%s*%[([^%]]+)%]') do
            for p in inner:gmatch("%d+") do
                candidates[#candidates + 1] = p
            end
        end

        for _, pid in ipairs(candidates) do
            local pres = http.get(PKGDETAILS_URL .. "?packageids=" .. pid .. "&cc=us",
                                  { timeout = 10 })
            if pres and pres.status == 200 then
                local price = pres.body:match('"final"%s*:%s*(%d+)')
                if price == "0" then
                    subid = pid
                    break
                end
            end
        end
    end

    return subid
end

function get_subid_backend(data)
    local payload = data
    if type(data) == "table" then
        payload = data.payload or data.appid or ""
    end

    local appid = tonumber(payload)
    if not appid then return "-1" end

    local subid = fetch_subid_for_appid(appid)
    return subid and tostring(subid) or "-1"
end

function claim_free_game_backend(data)
    local payload = data
    if type(data) == "table" then
        payload = data.payload or data.appid or ""
    end

    local appid = tonumber(payload)
    if not appid then return "0|invalid appid" end

    local subid = fetch_subid_for_appid(appid)
    if not subid then return "0|no free subid" end

    local ok, reason = claim_subid(tostring(subid), nil, tostring(appid))
    return (ok and "1|" or "0|") .. tostring(reason)
end

function fetch_free_games_backend()
    local found     = {}
    local seen      = {}
    local fetch_ok  = false

    do
        for _, cc in ipairs(SEARCH_REGIONS) do
            local url = SEARCH_BASE .. "&cc=" .. cc
            local res = http.get(url, { timeout = 25 })
            if res and res.status == 200 then
                fetch_ok = true
                local names, logos = {}, {}
                for n in res.body:gmatch('"name"%s*:%s*"(.-)"') do
                    names[#names + 1] = n
                end
                for u in res.body:gmatch('"logo"%s*:%s*"(.-)"') do
                    logos[#logos + 1] = u
                end
                for i, logo_url in ipairs(logos) do
                    logo_url = logo_url:gsub("\\/", "/")
                    local appid_str = logo_url:match("/apps/(%d+)/")
                    if appid_str then
                        local id = tonumber(appid_str)
                        if id and id > 0 and not seen[id] then
                            seen[id] = true
                            found[#found + 1] = {
                                appid = id,
                                name  = names[i] or ("AppID " .. appid_str),
                            }
                        end
                    end
                end
            end
        end

    do
        local res = http.get(GAMERPOWER_URL, { timeout = 15 })
        if res and res.status == 200 then
            for title in res.body:gmatch('"title"%s*:%s*"(.-) %(Steam%) Giveaway"') do
                local search_url = "https://store.steampowered.com/api/storesearch/?term=" ..
                    title:gsub(" ", "+"):gsub("%-", "%%2D") .. "&l=english&cc=us"
                local sres = http.get(search_url, { timeout = 10 })
                if sres and sres.status == 200 then
                    local appid_str = sres.body:match('"id"%s*:%s*(%d+)')
                    if appid_str then
                        local id = tonumber(appid_str)
                        if id and id > 0 and not seen[id] then
                            local name = sres.body:match('"name"%s*:%s*"(.-)"') or title
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

    if not fetch_ok then
        return read_file(CACHE_FILE) or "[]"
    end

    local games_only = {}
    for _, g in ipairs(found) do
        if g.from_gamerpower then
            games_only[#games_only + 1] = g
        else
            local dres = http.get(APPDETAILS_URL .. "?appids=" .. g.appid .. "&cc=us", { timeout = 10 })
            if dres and dres.status == 200 then
                local app_type = dres.body:match('"type"%s*:%s*"([^"]+)"')
                if app_type == "game" then
                    games_only[#games_only + 1] = g
                end
            else
                games_only[#games_only + 1] = g
            end
        end
    end

    local chunks = {}
    for _, g in ipairs(games_only) do
        local safe = g.name:gsub('\\', '\\\\'):gsub('"', '\\"')
        chunks[#chunks + 1] = '{"appid":' .. g.appid .. ',"name":"' .. safe .. '"}'
    end
    local json_out = "[" .. table.concat(chunks, ",") .. "]"
    write_file(CACHE_FILE, json_out)
    return json_out
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
