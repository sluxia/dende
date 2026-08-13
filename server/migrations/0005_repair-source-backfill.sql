-- Up Migration

INSERT INTO provenance.data_imports (source_id, filename, file_type, record_count, imported_by)
SELECT s.id, s.name, s.format,
       CASE s.type WHEN 'road' THEN (SELECT count(*) FROM zones.roads)
                   WHEN 'reserve' THEN (SELECT count(*) FROM zones.reserves)
                   WHEN 'survey' THEN (SELECT count(*) FROM registry.plots WHERE method <> 'manual')
                   ELSE (SELECT count(*) FROM registry.plots WHERE method = 'manual') END,
       'system:backfill-repair'
  FROM provenance.data_sources s
 WHERE s.name IN ('Calabar development road corridors', 'Calabar development reserves',
                  'Dende survey submissions', 'Dende manual development plots')
   AND NOT EXISTS (SELECT 1 FROM provenance.data_imports i WHERE i.source_id = s.id);

UPDATE zones.roads z SET source_id = s.id, import_id = i.id
  FROM provenance.data_sources s
  JOIN LATERAL (SELECT id FROM provenance.data_imports WHERE source_id = s.id ORDER BY imported_at DESC LIMIT 1) i ON true
 WHERE s.name = 'Calabar development road corridors' AND z.source_id IS NULL;

UPDATE zones.reserves z SET source_id = s.id, import_id = i.id
  FROM provenance.data_sources s
  JOIN LATERAL (SELECT id FROM provenance.data_imports WHERE source_id = s.id ORDER BY imported_at DESC LIMIT 1) i ON true
 WHERE s.name = 'Calabar development reserves' AND z.source_id IS NULL;

UPDATE registry.plots p SET record_type = 'reference_test', source_id = s.id, import_id = i.id
  FROM provenance.data_sources s
  JOIN LATERAL (SELECT id FROM provenance.data_imports WHERE source_id = s.id ORDER BY imported_at DESC LIMIT 1) i ON true
 WHERE p.method = 'manual' AND s.name = 'Dende manual development plots' AND p.source_id IS NULL;

UPDATE registry.plots p SET record_type = 'survey_submission', source_id = s.id, import_id = i.id
  FROM provenance.data_sources s
  JOIN LATERAL (SELECT id FROM provenance.data_imports WHERE source_id = s.id ORDER BY imported_at DESC LIMIT 1) i ON true
 WHERE p.method <> 'manual' AND s.name = 'Dende survey submissions' AND p.source_id IS NULL;

-- Down Migration
UPDATE registry.plots SET source_id = NULL, import_id = NULL;
UPDATE zones.roads SET source_id = NULL, import_id = NULL;
UPDATE zones.reserves SET source_id = NULL, import_id = NULL;
DELETE FROM provenance.data_imports WHERE imported_by = 'system:backfill-repair';
