-- Up Migration

CREATE TABLE registry.verification_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  report_id uuid NOT NULL REFERENCES registry.evidence_reports(id) ON DELETE RESTRICT,
  plot_id uuid NOT NULL REFERENCES registry.plots(id) ON DELETE RESTRICT,
  service_type text NOT NULL CHECK(service_type IN ('identity_documents','professional_review','authority_search','full_due_diligence')),
  requester_name text,
  contact_reference text NOT NULL,
  request_note text,
  management_key_hash text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','triage','awaiting_documents','in_review','awaiting_authority','completed','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz
);
CREATE INDEX verification_cases_queue_idx ON registry.verification_cases(status,created_at);
CREATE TABLE registry.verification_case_events (
  id bigserial PRIMARY KEY,case_id uuid NOT NULL REFERENCES registry.verification_cases(id) ON DELETE RESTRICT,
  event_type text NOT NULL,actor text NOT NULL,reason text,snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE registry.verification_case_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid NOT NULL REFERENCES registry.verification_cases(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL,title text NOT NULL,source_url text,storage_uri text,checksum_sha256 text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  added_by text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION registry.reject_verification_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Verification ledgers are append-only'; END $$;
CREATE TRIGGER verification_events_no_mutation BEFORE UPDATE OR DELETE ON registry.verification_case_events FOR EACH ROW EXECUTE FUNCTION registry.reject_verification_ledger_mutation();
CREATE TRIGGER verification_evidence_no_mutation BEFORE UPDATE OR DELETE ON registry.verification_case_evidence FOR EACH ROW EXECUTE FUNCTION registry.reject_verification_ledger_mutation();

-- Down Migration
DROP TRIGGER verification_evidence_no_mutation ON registry.verification_case_evidence;DROP TRIGGER verification_events_no_mutation ON registry.verification_case_events;
DROP FUNCTION registry.reject_verification_ledger_mutation();DROP TABLE registry.verification_case_evidence;DROP TABLE registry.verification_case_events;DROP TABLE registry.verification_cases;
