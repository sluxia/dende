-- Up Migration

INSERT INTO provenance.data_sources
  (type, name, provider, format, authority_level, status, description)
SELECT 'user_plot', 'Dende manual submissions', 'Dende users', 'manual', 'user_submitted', 'partial',
       'Plots registered through manual coordinate entry.'
WHERE NOT EXISTS (SELECT 1 FROM provenance.data_sources WHERE name = 'Dende manual submissions');

INSERT INTO provenance.data_sources
  (type, name, provider, format, authority_level, status, description)
SELECT 'user_plot', 'Dende ownership notices', 'Dende users', 'manual', 'user_submitted', 'partial',
       'Voluntary timestamped ownership notices; unverified unless explicitly marked otherwise.'
WHERE NOT EXISTS (SELECT 1 FROM provenance.data_sources WHERE name = 'Dende ownership notices');

-- Reclassify ownership-notice plots created while the source infrastructure was being introduced.
UPDATE registry.plots p SET source_id = s.id, import_id = NULL
  FROM provenance.data_sources s
 WHERE p.record_type = 'ownership_notice' AND s.name = 'Dende ownership notices';

-- Down Migration
UPDATE registry.plots SET source_id = NULL WHERE source_id IN
  (SELECT id FROM provenance.data_sources WHERE name IN ('Dende manual submissions', 'Dende ownership notices'));
DELETE FROM provenance.data_sources WHERE name IN ('Dende manual submissions', 'Dende ownership notices');
