--[[
**
**  multiple-sources-refresh.lua -- OBS Studio Lua Script for Auto Refreshing Multiple Browser Sources
**  Copyright (c) 2025 Brice
**  Distributed under MIT license <https://spdx.org/licenses/MIT.html>
**
--]]

-- global OBS API
local obs = obslua

-- script settings
local refresh_interval = 1800000  -- 30 minutes in milliseconds
local delay_between_sources = 700  -- 0.7 second delay between sources

-- list of sources to refresh in order
local sources_to_refresh = {
    "Yesterday",
    "Bucket list",
    "Runs",
    "Cum"
}

-- function to refresh a specific browser source
local function refresh_browser_source(source_name)
    local source = obs.obs_get_source_by_name(source_name)
    if source ~= nil then
        local source_id = obs.obs_source_get_unversioned_id(source)
        if source_id == "browser_source" then
            local properties = obs.obs_source_properties(source)
            local property = obs.obs_properties_get(properties, "refreshnocache")
            obs.obs_property_button_clicked(property, source)
            obs.obs_properties_destroy(properties)
        end
        obs.obs_source_release(source)
    end
end

-- Add a variable to track the current source index
local current_source_index = 1

-- Add timestamps tracking
local last_refresh_times = {}
local function can_refresh_source(index)
    local current_time = os.time() * 1000  -- Convert to milliseconds
    if not last_refresh_times[index] then
        last_refresh_times[index] = 0
        return true
    end
    return (current_time - last_refresh_times[index]) >= refresh_interval
end

-- script hook: description
function script_description()
    return [[
        <h2>Auto Refresh Multiple Sources</h2>
        Automatically refreshes multiple browser sources every 30 minutes,
        with 0.7-second delay between each refresh.
    ]]
end

-- Modify the script_load function to use a single timer
function script_load(settings)
    -- Set up a single timer that handles all sources
    obs.timer_add(function()
        -- Reset index at the start of each cycle
        if current_source_index > #sources_to_refresh then
            current_source_index = 1
        end
        
        -- Only refresh if enough time has passed
        if can_refresh_source(current_source_index) then
            refresh_browser_source(sources_to_refresh[current_source_index])
            last_refresh_times[current_source_index] = os.time() * 1000
        end
        
        current_source_index = current_source_index + 1
    end, delay_between_sources)
end

-- Modify script_unload to remove the single timer
function script_unload()
    obs.timer_remove(function()
        refresh_browser_source(sources_to_refresh[current_source_index])
    end)
end
