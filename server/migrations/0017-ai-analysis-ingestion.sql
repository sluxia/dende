-- Up Migration

CREATE TABLE intelligence.analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES intelligence.document_assets(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  analysis_type text NOT NULL CHECK (analysis_type IN ('land_document','survey_plan','layout_plan','map','tabular_coordinates','general_discovery')),
  provider text NOT NULL,
  model text NOT NULL,
  model_version text,
  prompt_version text NOT NULL,
  schema_version text NOT NULL,
  input_checksum text,
  status text NOT NULL CHECK (status IN ('started','complete','failed','rejected')),
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  structured_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  usage_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  supersedes_analysis_run_id uuid REFERENCES intelligence.analysis_runs(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX analysis_runs_asset_idx ON intelligence.analysis_runs(asset_id,started_at DESC);

ALTER TABLE intelligence.numeric_observations
  ADD COLUMN analysis_run_id uuid REFERENCES intelligence.analysis_runs(id) ON DELETE RESTRICT;
CREATE INDEX numeric_observations_analysis_idx ON intelligence.numeric_observations(analysis_run_id);

CREATE TRIGGER analysis_runs_no_update BEFORE UPDATE OR DELETE ON intelligence.analysis_runs
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();
CREATE TRIGGER extraction_runs_no_update BEFORE UPDATE OR DELETE ON intelligence.extraction_runs
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();
CREATE TRIGGER numeric_observations_no_update BEFORE UPDATE OR DELETE ON intelligence.numeric_observations
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();

-- Down Migration
DROP TRIGGER numeric_observations_no_update ON intelligence.numeric_observations;
DROP TRIGGER extraction_runs_no_update ON intelligence.extraction_runs;
DROP TRIGGER analysis_runs_no_update ON intelligence.analysis_runs;
ALTER TABLE intelligence.numeric_observations DROP COLUMN analysis_run_id;
DROP TABLE intelligence.analysis_runs;
