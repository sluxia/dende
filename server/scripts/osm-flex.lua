local roads = osm2pgsql.define_table({
  name = 'roads',
  schema = 'zones',
  ids = { type = 'way', id_column = 'osm_id' },
  columns = {
    { column = 'name', type = 'text' },
    { column = 'highway_class', type = 'text' },
    { column = 'geometry', type = 'linestring', projection = 4326 }
  }
})

local reserves = osm2pgsql.define_table({
  name = 'reserves',
  schema = 'zones',
  ids = { type = 'way', id_column = 'osm_id' },
  columns = {
    { column = 'name', type = 'text' },
    { column = 'protection_class', type = 'text' },
    { column = 'landuse', type = 'text' },
    { column = 'geometry', type = 'area', projection = 4326 }
  }
})

local allowed_highways = {
  motorway = true, trunk = true, primary = true,
  secondary = true, tertiary = true, unclassified = true
}

function osm2pgsql.process_way(object)
  local highway = object.tags.highway
  if highway and allowed_highways[highway] then
    roads:insert({
      name = object.tags.name,
      highway_class = highway
    })
  end

  local boundary = object.tags.boundary
  local landuse = object.tags.landuse
  local leisure = object.tags.leisure
  local is_reserve =
    boundary == 'protected_area' or
    boundary == 'national_park' or
    leisure == 'nature_reserve' or
    landuse == 'forest' or
    landuse == 'farmland'
  if is_reserve then
    reserves:insert({
      name = object.tags.name,
      protection_class = object.tags.protect_class or boundary or leisure,
      landuse = landuse
    })
  end
end
