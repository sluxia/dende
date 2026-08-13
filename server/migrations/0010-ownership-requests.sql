-- Up Migration

ALTER TABLE registry.ownership_notices ADD COLUMN management_key_hash text;

CREATE TABLE registry.ownership_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id uuid NOT NULL REFERENCES registry.ownership_notices(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('challenge','correction')),
  requester_name text,
  contact_reference text NOT NULL,
  reason text NOT NULL,
  proposed_correction jsonb,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','under_review','accepted','rejected','closed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ownership_requests_notice_idx ON registry.ownership_requests (notice_id, submitted_at DESC);

CREATE TABLE registry.ownership_request_events (
  id bigserial PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES registry.ownership_requests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor text NOT NULL DEFAULT 'public:requester',
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ownership_request_events_idx ON registry.ownership_request_events (request_id, created_at, id);

CREATE FUNCTION registry.capture_ownership_request_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO registry.ownership_request_events(request_id,event_type,snapshot,created_at)
  VALUES(NEW.id,CASE WHEN TG_OP='INSERT' THEN 'submitted' ELSE 'status_changed' END,
    jsonb_build_object('requestType',NEW.request_type,'status',NEW.status),
    CASE WHEN TG_OP='INSERT' THEN NEW.submitted_at ELSE now() END);
  RETURN NEW;
END; $$;
CREATE TRIGGER ownership_request_event_insert AFTER INSERT ON registry.ownership_requests
  FOR EACH ROW EXECUTE FUNCTION registry.capture_ownership_request_event();
CREATE TRIGGER ownership_request_event_update AFTER UPDATE OF status ON registry.ownership_requests
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION registry.capture_ownership_request_event();

-- Down Migration
DROP TRIGGER ownership_request_event_update ON registry.ownership_requests;
DROP TRIGGER ownership_request_event_insert ON registry.ownership_requests;
DROP FUNCTION registry.capture_ownership_request_event();
DROP TABLE registry.ownership_request_events;
DROP TABLE registry.ownership_requests;
ALTER TABLE registry.ownership_notices DROP COLUMN management_key_hash;
