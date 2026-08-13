-- Up Migration

ALTER TABLE provenance.data_sources
  ADD COLUMN coverage_status text NOT NULL DEFAULT 'partial'
    CHECK (coverage_status IN ('complete', 'partial', 'stale', 'unavailable', 'test_only'));

UPDATE provenance.data_sources
   SET coverage_status = CASE status
     WHEN 'test' THEN 'test_only'
     WHEN 'stale' THEN 'stale'
     WHEN 'archived' THEN 'unavailable'
     ELSE 'partial'
   END;

ALTER TABLE registry.check_runs
  ADD COLUMN consulted_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Down Migration
ALTER TABLE registry.check_runs DROP COLUMN consulted_sources;
ALTER TABLE provenance.data_sources DROP COLUMN coverage_status;
