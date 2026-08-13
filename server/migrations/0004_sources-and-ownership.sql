-- Up Migration

CREATE SCHEMA IF NOT EXISTS provenance;

CREATE TABLE provenance.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('road', 'reserve', 'cadastral', 'user_plot', 'survey', 'other')),
  name text NOT NULL,
  provider text,
  country_code char(2),
  admin_level_1 text,
  admin_level_2 text,
  format text,
  source_url text,
  license text,
  authority_level text NOT NULL DEFAULT 'user_submitted'
    CHECK (authority_level IN ('official', 'open_data', 'commercial', 'user_submitted', 'internal_test')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'partial', 'stale', 'test', 'archived')),
  coverage_geometry geometry(MultiPolygon, 4326),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX data_sources_geo_idx ON provenance.data_sources (country_code, admin_level_1, type);
CREATE INDEX data_sources_coverage_gix ON provenance.data_sources USING GIST (coverage_geometry);

CREATE TABLE provenance.data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES provenance.data_sources(id) ON DELETE RESTRICT,
  filename text,
  file_type text,
  checksum text,
  record_count integer,
  imported_by text NOT NULL DEFAULT 'system',
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'complete', 'failed')),
  error_summary text,
  imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX data_imports_source_id_idx ON provenance.data_imports (source_id, imported_at DESC);
CREATE UNIQUE INDEX data_imports_checksum_uq ON provenance.data_imports (source_id, checksum) WHERE checksum IS NOT NULL;

ALTER TABLE registry.plots
  ADD COLUMN record_type text NOT NULL DEFAULT 'survey_submission'
    CHECK (record_type IN ('survey_submission', 'manual_submission', 'ownership_notice', 'official_cadastral', 'reference_test')),
  ADD COLUMN source_id uuid REFERENCES provenance.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN import_id uuid REFERENCES provenance.data_imports(id) ON DELETE SET NULL;

ALTER TABLE zones.roads
  ADD COLUMN source_id uuid REFERENCES provenance.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN import_id uuid REFERENCES provenance.data_imports(id) ON DELETE SET NULL;
ALTER TABLE zones.reserves
  ADD COLUMN source_id uuid REFERENCES provenance.data_sources(id) ON DELETE SET NULL,
  ADD COLUMN import_id uuid REFERENCES provenance.data_imports(id) ON DELETE SET NULL;

CREATE TABLE registry.ownership_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE CASCADE,
  submitter_name text,
  contact_reference text,
  statement text,
  ownership_status text NOT NULL DEFAULT 'unverified'
    CHECK (ownership_status IN ('unverified', 'verified', 'rejected', 'disputed')),
  verification_level text NOT NULL DEFAULT 'none'
    CHECK (verification_level IN ('none', 'identity', 'documents', 'professional', 'authority')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'limited', 'private')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'expired', 'disputed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_by text,
  expires_at timestamptz,
  supersedes_notice_id uuid REFERENCES registry.ownership_notices(id) ON DELETE SET NULL
);
CREATE INDEX ownership_notices_plot_idx ON registry.ownership_notices (plot_id, status);
CREATE INDEX ownership_notices_submitted_idx ON registry.ownership_notices (submitted_at DESC);

CREATE TABLE registry.ownership_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES registry.ownership_notices(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('identity', 'documents', 'professional', 'authority')),
  outcome text NOT NULL CHECK (outcome IN ('pending', 'passed', 'failed')),
  performed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ownership_verifications_notice_idx ON registry.ownership_verifications (notice_id, created_at DESC);

-- Backfill the current development data with explicit, geographically scoped sources.
WITH source AS (
  INSERT INTO provenance.data_sources
    (type, name, provider, country_code, admin_level_1, admin_level_2, format, authority_level, status, description)
  VALUES
    ('road', 'Calabar development road corridors', 'Dende development fixtures', 'NG', 'Cross River', 'Calabar', 'geojson', 'internal_test', 'test', 'Development-only road coverage.'),
    ('reserve', 'Calabar development reserves', 'Dende development fixtures', 'NG', 'Cross River', 'Calabar', 'geojson', 'internal_test', 'test', 'Development-only reserve coverage.'),
    ('survey', 'Dende survey submissions', 'Dende users', 'NG', NULL, NULL, 'survey_scan', 'user_submitted', 'partial', 'Survey plans submitted to Dende.'),
    ('user_plot', 'Dende manual development plots', 'Dende development', 'NG', 'Cross River', 'Calabar', 'manual', 'internal_test', 'test', 'Manual and synthetic plots created during development.'),
    ('user_plot', 'Dende manual submissions', 'Dende users', NULL, NULL, NULL, 'manual', 'user_submitted', 'partial', 'Plots registered through manual coordinate entry.'),
    ('user_plot', 'Dende ownership notices', 'Dende users', NULL, NULL, NULL, 'manual', 'user_submitted', 'partial', 'Voluntary timestamped ownership notices; unverified unless explicitly marked otherwise.')
  RETURNING id, type, name
), imports AS (
  INSERT INTO provenance.data_imports (source_id, filename, file_type, record_count, imported_by)
  SELECT id, name,
         CASE type WHEN 'road' THEN 'geojson' WHEN 'reserve' THEN 'geojson'
                   WHEN 'survey' THEN 'survey_scan' ELSE 'manual' END,
         CASE type WHEN 'road' THEN (SELECT count(*) FROM zones.roads)
                   WHEN 'reserve' THEN (SELECT count(*) FROM zones.reserves)
                   WHEN 'user_plot' THEN 0 ELSE (SELECT count(*) FROM registry.plots) END,
         'system:migration'
    FROM source
  RETURNING id, source_id
)
SELECT count(*) FROM imports;

UPDATE zones.roads z SET source_id = s.id, import_id = i.id
  FROM provenance.data_sources s JOIN provenance.data_imports i ON i.source_id = s.id
 WHERE s.name = 'Calabar development road corridors' AND z.source_id IS NULL;
UPDATE zones.reserves z SET source_id = s.id, import_id = i.id
  FROM provenance.data_sources s JOIN provenance.data_imports i ON i.source_id = s.id
 WHERE s.name = 'Calabar development reserves' AND z.source_id IS NULL;
UPDATE registry.plots p SET record_type = 'reference_test', source_id = s.id, import_id = i.id
  FROM provenance.data_sources s JOIN provenance.data_imports i ON i.source_id = s.id
 WHERE p.method = 'manual' AND s.name = 'Dende manual development plots';
UPDATE registry.plots p SET record_type = 'survey_submission', source_id = s.id, import_id = i.id
  FROM provenance.data_sources s JOIN provenance.data_imports i ON i.source_id = s.id
 WHERE p.method <> 'manual' AND s.name = 'Dende survey submissions';

-- Down Migration
DROP TABLE registry.ownership_verifications;
DROP TABLE registry.ownership_notices;
ALTER TABLE zones.reserves DROP COLUMN import_id, DROP COLUMN source_id;
ALTER TABLE zones.roads DROP COLUMN import_id, DROP COLUMN source_id;
ALTER TABLE registry.plots DROP COLUMN import_id, DROP COLUMN source_id, DROP COLUMN record_type;
DROP TABLE provenance.data_imports;
DROP TABLE provenance.data_sources;
DROP SCHEMA provenance;
