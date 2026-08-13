-- Up Migration

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS registry;

CREATE TABLE registry.plots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active',
  method text,
  confidence double precision,
  crs text,
  computed_area_sqm double precision,
  printed_area_sqm double precision,
  source_file text,
  raw_vertices jsonb,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plots_geometry_gix ON registry.plots USING GIST (geometry);

CREATE TABLE registry.plot_overlaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  other_plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  intersection_area_sqm double precision NOT NULL,
  intersection_percent double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plot_id, other_plot_id)
);

CREATE TABLE registry.plot_zoning_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  layer text NOT NULL,
  zone_name text,
  zone_type text,
  distance_m double precision,
  intersection_area_sqm double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plot_zoning_alerts_plot_id_idx ON registry.plot_zoning_alerts (plot_id);

-- Down Migration
DROP TABLE registry.plot_zoning_alerts;
DROP TABLE registry.plot_overlaps;
DROP TABLE registry.plots;
DROP SCHEMA registry;
