-- Up Migration

CREATE OR REPLACE FUNCTION registry.reject_ownership_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Permit FK cascade cleanup only after the parent notice has ceased to exist.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM registry.ownership_notices WHERE id = OLD.notice_id
  ) THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'ownership_events is append-only';
END;
$$;

-- Down Migration
CREATE OR REPLACE FUNCTION registry.reject_ownership_event_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ownership_events is append-only';
END;
$$;
