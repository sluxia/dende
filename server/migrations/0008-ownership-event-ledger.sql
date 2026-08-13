-- Up Migration

CREATE TABLE registry.ownership_events (
  id bigserial PRIMARY KEY,
  notice_id uuid NOT NULL REFERENCES registry.ownership_notices(id) ON DELETE CASCADE,
  verification_id uuid REFERENCES registry.ownership_verifications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor text NOT NULL DEFAULT 'system:database',
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ownership_events_notice_idx ON registry.ownership_events (notice_id, created_at, id);

CREATE FUNCTION registry.reject_ownership_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ownership_events is append-only';
END;
$$;
CREATE TRIGGER ownership_events_no_update
  BEFORE UPDATE OR DELETE ON registry.ownership_events
  FOR EACH ROW EXECUTE FUNCTION registry.reject_ownership_event_mutation();

CREATE FUNCTION registry.capture_ownership_notice_event() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE event_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_name := 'submitted';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    event_name := 'status_changed';
  ELSIF NEW.ownership_status IS DISTINCT FROM OLD.ownership_status OR NEW.verification_level IS DISTINCT FROM OLD.verification_level THEN
    event_name := 'ownership_status_changed';
  ELSIF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    event_name := 'visibility_changed';
  ELSIF NEW.supersedes_notice_id IS DISTINCT FROM OLD.supersedes_notice_id THEN
    event_name := 'supersession_changed';
  ELSE
    event_name := 'notice_updated';
  END IF;
  INSERT INTO registry.ownership_events (notice_id, event_type, snapshot, created_at)
  VALUES (NEW.id, event_name,
    jsonb_build_object('status',NEW.status,'ownershipStatus',NEW.ownership_status,
      'verificationLevel',NEW.verification_level,'visibility',NEW.visibility,
      'submittedAt',NEW.submitted_at,'verifiedAt',NEW.verified_at,
      'expiresAt',NEW.expires_at,'supersedesNoticeId',NEW.supersedes_notice_id),
    CASE WHEN TG_OP='INSERT' THEN NEW.submitted_at ELSE now() END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER ownership_notice_event_insert
  AFTER INSERT ON registry.ownership_notices
  FOR EACH ROW EXECUTE FUNCTION registry.capture_ownership_notice_event();
CREATE TRIGGER ownership_notice_event_update
  AFTER UPDATE ON registry.ownership_notices
  FOR EACH ROW EXECUTE FUNCTION registry.capture_ownership_notice_event();

CREATE FUNCTION registry.capture_ownership_verification_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO registry.ownership_events
    (notice_id, verification_id, event_type, snapshot, created_at)
  VALUES (NEW.notice_id, NEW.id,
    CASE WHEN TG_OP='INSERT' THEN 'verification_recorded' ELSE 'verification_updated' END,
    jsonb_build_object('level',NEW.level,'outcome',NEW.outcome,
      'performedBy',NEW.performed_by,'notes',NEW.notes,
      'createdAt',NEW.created_at,'completedAt',NEW.completed_at),
    CASE WHEN TG_OP='INSERT' THEN NEW.created_at ELSE now() END);
  RETURN NEW;
END;
$$;
CREATE TRIGGER ownership_verification_event_insert
  AFTER INSERT ON registry.ownership_verifications
  FOR EACH ROW EXECUTE FUNCTION registry.capture_ownership_verification_event();
CREATE TRIGGER ownership_verification_event_update
  AFTER UPDATE ON registry.ownership_verifications
  FOR EACH ROW EXECUTE FUNCTION registry.capture_ownership_verification_event();

INSERT INTO registry.ownership_events (notice_id, event_type, actor, reason, snapshot, created_at)
SELECT n.id, 'submitted', 'system:backfill', 'Backfilled from existing ownership notice',
       jsonb_build_object('status',n.status,'ownershipStatus',n.ownership_status,
         'verificationLevel',n.verification_level,'visibility',n.visibility,
         'submittedAt',n.submitted_at,'verifiedAt',n.verified_at,
         'expiresAt',n.expires_at,'supersedesNoticeId',n.supersedes_notice_id),
       n.submitted_at
  FROM registry.ownership_notices n
 WHERE NOT EXISTS (SELECT 1 FROM registry.ownership_events e WHERE e.notice_id=n.id);

INSERT INTO registry.ownership_events (notice_id, verification_id, event_type, actor, reason, snapshot, created_at)
SELECT v.notice_id, v.id, 'verification_recorded', 'system:backfill', 'Backfilled from existing verification record',
       jsonb_build_object('level',v.level,'outcome',v.outcome,'performedBy',v.performed_by,
         'notes',v.notes,'createdAt',v.created_at,'completedAt',v.completed_at), v.created_at
  FROM registry.ownership_verifications v
 WHERE NOT EXISTS (SELECT 1 FROM registry.ownership_events e WHERE e.verification_id=v.id);

-- Down Migration
DROP TRIGGER ownership_verification_event_update ON registry.ownership_verifications;
DROP TRIGGER ownership_verification_event_insert ON registry.ownership_verifications;
DROP FUNCTION registry.capture_ownership_verification_event();
DROP TRIGGER ownership_notice_event_update ON registry.ownership_notices;
DROP TRIGGER ownership_notice_event_insert ON registry.ownership_notices;
DROP FUNCTION registry.capture_ownership_notice_event();
DROP TRIGGER ownership_events_no_update ON registry.ownership_events;
DROP FUNCTION registry.reject_ownership_event_mutation();
DROP TABLE registry.ownership_events;
