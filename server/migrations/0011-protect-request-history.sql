-- Up Migration

CREATE FUNCTION registry.protect_ownership_request_payload() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notice_id IS DISTINCT FROM OLD.notice_id
     OR NEW.request_type IS DISTINCT FROM OLD.request_type
     OR NEW.requester_name IS DISTINCT FROM OLD.requester_name
     OR NEW.contact_reference IS DISTINCT FROM OLD.contact_reference
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.proposed_correction IS DISTINCT FROM OLD.proposed_correction
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
    RAISE EXCEPTION 'ownership request payload is immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER ownership_requests_protect_payload BEFORE UPDATE ON registry.ownership_requests
  FOR EACH ROW EXECUTE FUNCTION registry.protect_ownership_request_payload();

CREATE FUNCTION registry.reject_ownership_request_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM registry.ownership_requests WHERE id=OLD.request_id) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ownership_request_events is append-only';
END; $$;
CREATE TRIGGER ownership_request_events_no_mutation BEFORE UPDATE OR DELETE ON registry.ownership_request_events
  FOR EACH ROW EXECUTE FUNCTION registry.reject_ownership_request_event_mutation();

-- Down Migration
DROP TRIGGER ownership_request_events_no_mutation ON registry.ownership_request_events;
DROP FUNCTION registry.reject_ownership_request_event_mutation();
DROP TRIGGER ownership_requests_protect_payload ON registry.ownership_requests;
DROP FUNCTION registry.protect_ownership_request_payload();
