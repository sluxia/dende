-- Up Migration

CREATE SCHEMA IF NOT EXISTS zones;

CREATE TABLE zones.roads (
  id bigserial PRIMARY KEY,
  osm_id text,
  name text,
  highway_class text,
  geometry geometry(MultiLineString, 4326)
);
CREATE INDEX roads_geometry_gix ON zones.roads USING GIST (geometry);

CREATE TABLE zones.reserves (
  id bigserial PRIMARY KEY,
  osm_id text,
  name text,
  protection_class text,
  landuse text,
  geometry geometry(MultiPolygon, 4326)
);
CREATE INDEX reserves_geometry_gix ON zones.reserves USING GIST (geometry);

CREATE TABLE zones.meta (
  id serial PRIMARY KEY,
  layer text NOT NULL,
  source_url text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer
);

-- Down Migration
DROP TABLE zones.meta;
DROP TABLE zones.reserves;
DROP TABLE zones.roads;
DROP SCHEMA zones;
