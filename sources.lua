function print_sources()
    local sources = obslua.obs_enum_sources()
    for _, source in pairs(sources) do
        local source_name = obslua.obs_source_get_name(source)
        local source_id = obslua.obs_source_get_unversioned_id(source)
        print("Source Name: " .. source_name .. ", Source ID: " .. source_id)
    end
    obslua.source_list_release(sources)
end

function script_load(settings)
    print_sources()
end