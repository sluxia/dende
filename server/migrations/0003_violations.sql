-- Up Migration

-- Zone provenance
ALTER TABLE zones.roads ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE zones.roads ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE zones.reserves ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE zones.reserves ADD COLUMN IF NOT EXISTS imported_at timestamptz NOT NULL DEFAULT now();

-- One row per spatial check execution (the measurement timeline).
CREATE TABLE registry.check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  source_upload text,
  parse_method text,
  confidence double precision,
  plot_area_sqm double precision,
  "overlaps" jsonb NOT NULL DEFAULT '[]'::jsonb,
  zoning_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_runs_plot_id_idx ON registry.check_runs (plot_id);
CREATE INDEX check_runs_ran_at_idx ON registry.check_runs (ran_at);

-- One case per (plot x other-plot) or (plot x zone).
CREATE TABLE registry.violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('overlap', 'zoning')),
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  other_plot_id uuid REFERENCES registry.plots(id) ON DELETE CASCADE,
  zone_id bigint,
  zone_layer text,
  zone_name text,
  zone_type text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'in_dispute', 'resolved', 'false_positive')),
  severity text NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  current_distance_m double precision,
  current_area_sqm double precision,
  current_percent double precision,
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX violations_overlap_uq ON registry.violations (plot_id, other_plot_id) WHERE kind = 'overlap';
CREATE UNIQUE INDEX violations_zoning_uq ON registry.violations (plot_id, zone_id, zone_layer) WHERE kind = 'zoning';
CREATE INDEX violations_plot_id_idx ON registry.violations (plot_id);
CREATE INDEX violations_status_idx ON registry.violations (status);

-- Immutable event feed per violation (who/when/why).
CREATE TABLE registry.violation_events (
  id bigserial PRIMARY KEY,
  violation_id uuid NOT NULL REFERENCES registry.violations(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('detected', 'measurement_changed', 'status_changed', 'zone_changed', 'note')),
  actor text NOT NULL,
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  check_run_id uuid REFERENCES registry.check_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX violation_events_violation_id_idx ON registry.violation_events (violation_id);

-- Backfill legacy overlap records.
INSERT INTO registry.violations
  (kind, plot_id, other_plot_id, zone_id, zone_layer, zone_name, zone_type,
   status, severity, current_area_sqm, current_percent, current_distance_m,
   first_detected_at, last_checked_at, created_at, updated_at)
SELECT 'overlap', plot_id, other_plot_id, NULL, NULL, NULL, NULL,
       'open', 'warning', intersection_area_sqm, intersection_percent, NULL,
       created_at, created_at, created_at, created_at
  FROM registry.plot_overlaps;

-- Backfill legacy zoning alerts (best-effort zone_id resolution by name).
INSERT INTO registry.violations
  (kind, plot_id, other_plot_id, zone_id, zone_layer, zone_name, zone_type,
   status, severity, current_area_sqm, current_percent, current_distance_m,
   first_detected_at, last_checked_at, created_at, updated_at)
SELECT 'zoning', plot_id, NULL,
       CASE layer
         WHEN 'roads' THEN (SELECT id FROM zones.roads r WHERE r.name = a.zone_name LIMIT 1)
         WHEN 'reserves' THEN (SELECT id FROM zones.reserves r WHERE r.name = a.zone_name LIMIT 1)
       END,
       layer, zone_name, zone_type,
       'open', 'warning', intersection_area_sqm, NULL, distance_m,
       created_at, created_at, created_at, created_at
  FROM registry.plot_zoning_alerts a;

INSERT INTO registry.violation_events (violation_id, event_type, actor, reason, snapshot, check_run_id, created_at)
SELECT id, 'detected', 'system:backfill', 'Migrated from legacy alert record',
       jsonb_build_object('severity', severity, 'areaSqm', current_area_sqm,
                          'percent', current_percent, 'distanceM', current_distance_m),
       NULL, created_at
  FROM registry.violations;

DROP TABLE registry.plot_zoning_alerts;
DROP TABLE registry.plot_overlaps;

-- Down Migration
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
DROP TABLE registry.violation_events;
DROP TABLE registry.check_runs;
DROP TABLE registry.violations;
ALTER TABLE zones.roads DROP COLUMN IF EXISTS source_url;
ALTER TABLE zones.roads DROP COLUMN IF EXISTS imported_at;
ALTER TABLE zones.reserves DROP COLUMN IF EXISTS source_url;
ALTER TABLE zones.reserves DROP COLUMN IF EXISTS imported_at;
