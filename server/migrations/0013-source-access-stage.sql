-- Up Migration

ALTER TABLE provenance.data_sources
  ADD COLUMN access_stage text NOT NULL DEFAULT 'authority_identified'
  CHECK (access_stage IN (
    'authority_identified', 'portal_found', 'access_required', 'dataset_found',
    'under_review', 'usable', 'unavailable'
  ));

-- Existing sources with records are already participating in checks.
UPDATE provenance.data_sources s
   SET access_stage = 'usable'
 WHERE s.status <> 'planned'
   AND s.coverage_status <> 'unavailable';

-- These authorities expose a land/GIS service portal, but a portal is not a
-- downloadable dataset and must not be treated as check coverage.
UPDATE provenance.data_sources
   SET access_stage = 'portal_found'
 WHERE status = 'planned'
   AND admin_level_1 IN (
     'Adamawa', 'Akwa Ibom', 'Anambra', 'Bayelsa', 'Borno', 'Cross River',
     'Edo', 'Enugu', 'Kaduna', 'Kano', 'Lagos', 'Nasarawa', 'Ogun',
     'Plateau', 'Federal Capital Territory'
   );

-- Down Migration
ALTER TABLE provenance.data_sources DROP COLUMN access_stage;
