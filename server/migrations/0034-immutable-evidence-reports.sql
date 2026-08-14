-- Up Migration

CREATE TABLE registry.evidence_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text NOT NULL UNIQUE,
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE RESTRICT,
  check_run_id uuid NOT NULL REFERENCES registry.check_runs(id) ON DELETE RESTRICT,
  report_version text NOT NULL DEFAULT '1.0',
  locale text NOT NULL DEFAULT 'en-NG',
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(check_run_id, report_version)
);
CREATE INDEX evidence_reports_plot_idx ON registry.evidence_reports(plot_id,generated_at DESC);

CREATE FUNCTION registry.reject_evidence_report_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence reports are immutable';
END $$;
CREATE TRIGGER evidence_reports_no_update BEFORE UPDATE OR DELETE ON registry.evidence_reports
FOR EACH ROW EXECUTE FUNCTION registry.reject_evidence_report_mutation();

-- Down Migration
DROP TRIGGER evidence_reports_no_update ON registry.evidence_reports;
DROP FUNCTION registry.reject_evidence_report_mutation();
DROP TABLE registry.evidence_reports;
