-- Up Migration

CREATE TABLE intelligence.document_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES intelligence.documents(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  discovered_from_url text,
  file_url text NOT NULL,
  filename text,
  format_family text NOT NULL CHECK (format_family IN ('pdf','image','word','spreadsheet','delimited','geospatial','html','archive','other')),
  file_extension text,
  media_type text,
  byte_size bigint,
  checksum_sha256 text,
  storage_uri text,
  page_count integer,
  text_layer_status text NOT NULL DEFAULT 'unknown' CHECK (text_layer_status IN ('unknown','present','absent','partial')),
  acquisition_status text NOT NULL DEFAULT 'discovered' CHECK (acquisition_status IN ('discovered','queued','downloaded','failed','blocked')),
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending','text_extracted','ocr_required','ocr_complete','review_required','complete','failed')),
  discovered_at timestamptz NOT NULL DEFAULT now(),
  acquired_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX document_assets_queue_idx ON intelligence.document_assets(acquisition_status, extraction_status, discovered_at);

CREATE TABLE intelligence.discovery_profiles (
  id text PRIMARY KEY,
  format_family text NOT NULL CHECK (format_family IN ('pdf','image','word','spreadsheet','delimited','geospatial','html','archive','other')),
  extensions text[] NOT NULL,
  extraction_route text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5)
);

INSERT INTO intelligence.discovery_profiles(id,format_family,extensions,extraction_route,priority) VALUES
 ('pdf','pdf',ARRAY['pdf'],'text layer, rendered page verification, then page OCR fallback',1),
 ('image','image',ARRAY['jpg','jpeg','png','tif','tiff','webp'],'image metadata, enhancement, OCR and visual table/plan parsing',1),
 ('word','word',ARRAY['doc','docx','odt','rtf'],'document text, tables, embedded images and relationship targets',2),
 ('spreadsheet','spreadsheet',ARRAY['xls','xlsx','ods'],'sheet/cell extraction preserving formulas, headers, merged cells and hidden sheets',1),
 ('delimited','delimited',ARRAY['csv','tsv','txt'],'encoding/delimiter detection followed by typed tabular extraction',1),
 ('geospatial','geospatial',ARRAY['geojson','json','kml','kmz','gpx','shp','gpkg','dxf'],'native geometry/CRS inspection and conversion without OCR',1),
 ('html','html',ARRAY['html','htm'],'DOM text, tables, metadata, downloads and embedded structured data',2),
 ('archive','archive',ARRAY['zip','7z','rar','tar','gz'],'safe inventory and recursive routing of contained supported files',2);

CREATE TABLE intelligence.extraction_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES intelligence.document_assets(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  extractor text NOT NULL,
  extractor_version text NOT NULL,
  run_status text NOT NULL CHECK (run_status IN ('started','complete','failed')),
  page_start integer,
  page_end integer,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE intelligence.numeric_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_run_id uuid NOT NULL REFERENCES intelligence.extraction_runs(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  observation_type text NOT NULL CHECK (observation_type IN ('coordinate_pair','latitude_longitude','bearing_distance','area','beacon','plot_number','survey_number','title_number','date','other')),
  page_number integer,
  locator text,
  raw_text text NOT NULL,
  normalized_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text,
  crs_candidates text[] NOT NULL DEFAULT '{}',
  extraction_confidence numeric NOT NULL CHECK (extraction_confidence BETWEEN 0 AND 1),
  interpretation_status text NOT NULL DEFAULT 'unreviewed' CHECK (interpretation_status IN ('unreviewed','accepted','rejected','ambiguous')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX numeric_observations_type_idx ON intelligence.numeric_observations(observation_type, interpretation_status);

CREATE TABLE intelligence.geometry_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  land_event_id uuid REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  method text NOT NULL CHECK (method IN ('coordinate_table','bearing_traverse','geocoded_extent','digitized_plan','linked_dataset')),
  source_crs text,
  geometry geometry(MultiPolygon,4326),
  closure_error_m numeric,
  area_difference_percent numeric,
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  validation_status text NOT NULL DEFAULT 'unreviewed' CHECK (validation_status IN ('unreviewed','valid','invalid','ambiguous')),
  check_eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT check_eligible OR (validation_status='valid' AND geometry IS NOT NULL AND source_crs IS NOT NULL))
);

CREATE TABLE intelligence.geometry_candidate_observations (
  geometry_candidate_id uuid NOT NULL REFERENCES intelligence.geometry_candidates(id) ON DELETE RESTRICT,
  numeric_observation_id uuid NOT NULL REFERENCES intelligence.numeric_observations(id) ON DELETE RESTRICT,
  sequence_number integer,
  PRIMARY KEY(geometry_candidate_id,numeric_observation_id)
);

-- Known official files discovered in the Cross River pilot. Discovery does not
-- imply that they contain parcel coordinates or that they are check evidence.
INSERT INTO intelligence.document_assets(document_id,external_key,discovered_from_url,file_url,filename,format_family,file_extension,media_type,acquisition_status,extraction_status,metadata)
SELECT d.id,x.external_key,x.discovered_from_url,x.file_url,x.filename,'pdf','pdf','application/pdf','discovered','pending',x.metadata
FROM (VALUES
 ('crs-stat-yearbook-2024-pdf','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/STATISTICAL%20YEAR%20BOOK%202024%20EDITION.pdf','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/STATISTICAL%20YEAR%20BOOK%202024%20EDITION.pdf','STATISTICAL YEAR BOOK 2024 EDITION.pdf','crs-stat-yearbook-2024','{"priority":"high","numericTargets":["areas","survey approvals","government properties"]}'::jsonb),
 ('crs-revised-budget-2025-pdf','https://www.crossriverstate.gov.ng/download/Budget/CROSS%20RIVER%20STATE%202025%20REVISED%20BUDGET.pdf','https://www.crossriverstate.gov.ng/download/Budget/CROSS%20RIVER%20STATE%202025%20REVISED%20BUDGET.pdf','CROSS RIVER STATE 2025 REVISED BUDGET.pdf','crs-revised-budget-2025','{"priority":"medium","numericTargets":["land programmes","mapping projects"]}'::jsonb),
 ('crs-facts-figures-2024-pdf','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/formatted%20Personal%20F%26F%20FINAL%20PRINT-1.pdf','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/formatted%20Personal%20F%26F%20FINAL%20PRINT-1.pdf','Cross River Facts and Figures 2022-2024.pdf',NULL,'{"priority":"medium","numericTargets":["survey plan counts","land statistics"]}'::jsonb),
 ('crs-hope-gov-bed-guidelines-2025-pdf','https://www.crossriverstate.gov.ng/download/HOPE-GOV/BED%20GUIDELINES%202025.pdf','https://www.crossriverstate.gov.ng/download/HOPE-GOV/BED%20GUIDELINES%202025.pdf','BED GUIDELINES 2025.pdf',NULL,'{"priority":"low","numericTargets":["site GPS requirements"],"note":"process guidance, not parcel evidence"}'::jsonb)
) x(external_key,discovered_from_url,file_url,filename,document_key,metadata)
LEFT JOIN intelligence.documents d ON d.external_key=x.document_key
ON CONFLICT(external_key) DO NOTHING;

-- Down Migration
DROP TABLE intelligence.geometry_candidate_observations;
DROP TABLE intelligence.geometry_candidates;
DROP TABLE intelligence.numeric_observations;
DROP TABLE intelligence.extraction_runs;
DROP TABLE intelligence.discovery_profiles;
DROP TABLE intelligence.document_assets;
