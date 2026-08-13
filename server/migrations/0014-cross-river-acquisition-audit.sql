-- Up Migration

ALTER TABLE provenance.data_sources
  ADD COLUMN access_method text,
  ADD COLUMN access_notes text,
  ADD COLUMN access_contact text,
  ADD COLUMN access_reviewed_at date;

UPDATE provenance.data_sources
   SET provider = 'Cross River Geographic Information Agency (CRGIA)',
       source_url = 'https://crgia.crossriverstate.gov.ng/',
       access_stage = 'access_required',
       access_method = 'Formal agency enquiry or individual paid land-service application',
       access_contact = 'landsenquiries@crossriverstate.gov.ng · 08168920736 · 07074693423 · 07074693424',
       access_notes = 'Official portal confirms a land and survey repository, online applications and paid services. Audit found no public parcel download, documented API, WFS/WMS, or open map endpoint. Request dataset scope, delivery format, CRS, currency, licence and redistribution permission directly from CRGIA.',
       access_reviewed_at = DATE '2026-08-13',
       description = 'Official Cross River land-information custodian. A service portal exists, but no usable dataset has been acquired; formal access is required.'
 WHERE name = 'Cross River State land and cadastral records'
   AND country_code = 'NG' AND admin_level_1 = 'Cross River';

WITH targets(type, name, provider, source_url, access_stage, access_method, access_contact, access_notes, description) AS (
  VALUES
    ('survey', 'Cross River approved survey plans and survey lodgements', 'Cross River State Office of the Surveyor-General', 'https://osg.crossriverstate.gov.ng/', 'access_required', 'Authenticated Surveyor’s Platform; onboarding by the Office of the Surveyor-General', 'Via Cross River Lands Cluster: landsenquiries@crossriverstate.gov.ng', 'The platform accepts coordinate CSV/Excel and survey documents from onboarded licensed surveyors and tracks approval. It is a transactional system, not a public dataset/API. Seek institutional access, historic approved-plan coverage, coordinate schema, CRS, licence and permitted automated matching.', 'Authoritative approved-survey and lodgement target. Login and professional onboarding are required; no records have been acquired.'),
    ('reserve', 'Cross River State forest reserve boundaries', 'Cross River State Forestry Commission', 'https://www.forestry.crossriverstate.gov.ng/', 'authority_identified', 'Formal data request to the Forestry Commission', NULL, 'Official forestry authority identified. Audit found no published boundary download, API or map service. Request gazetted reserve polygons, legal instruments, effective dates, CRS and licence.', 'Target source for state forest-reserve boundaries; no usable spatial dataset has been located.'),
    ('reserve', 'Cross River National Park boundary', 'Nigeria National Park Service', 'https://nigeriaparkservice.gov.ng/blog/2014/08/12/cross-river-national-park/', 'access_required', 'Formal data request to Nigeria National Park Service', 'https://nigeriaparkservice.gov.ng/contact-us/', 'The official Park Service confirms the Oban and Okwangwo divisions, but the public page does not provide authoritative boundary geometry or a documented spatial service. Request the gazetted park boundary and licence.', 'Federal protected-area target covering the two divisions of Cross River National Park; authoritative geometry not yet acquired.'),
    ('road', 'Cross River State road network and rights-of-way', 'Cross River State Ministry of Works and Infrastructure', 'https://www.crossriverstate.gov.ng/', 'authority_identified', 'Formal data request to the Ministry of Works and Infrastructure', NULL, 'Official budgets identify the ministry and road projects but do not expose centerlines, carriageway extents or legal right-of-way geometry. Request current road inventory, classification, ROW widths, CRS, dates and licence.', 'Target source for state road centerlines, classifications and rights-of-way; no usable spatial dataset has been located.'),
    ('other', 'Cross River planning schemes and development-control zones', 'Cross River State Ministry of Lands / Urban Development Authority', 'https://www.mol.crossriverstate.gov.ng/', 'authority_identified', 'Formal data request to the Ministry of Lands and Urban Development Authority', 'Via Cross River Lands Cluster: landsenquiries@crossriverstate.gov.ng', 'The state identifies the Urban Development Authority as responsible for building approvals and development permits, but no zoning/planning polygons or API were found. Request operative schemes, zoning layers, setbacks, effective dates, CRS and licence.', 'Target source for statutory planning, zoning and development-control constraints; no usable spatial dataset has been located.')
)
INSERT INTO provenance.data_sources
  (type, name, provider, country_code, admin_level_1, format, source_url,
   authority_level, status, coverage_status, access_stage, access_method,
   access_contact, access_notes, access_reviewed_at, description)
SELECT type, name, provider, 'NG', 'Cross River', 'not_acquired', source_url,
       'official', 'planned', 'unavailable', access_stage, access_method,
       access_contact, access_notes, DATE '2026-08-13', description
  FROM targets t
 WHERE NOT EXISTS (SELECT 1 FROM provenance.data_sources s WHERE s.name = t.name);

-- Down Migration
DELETE FROM provenance.data_sources
 WHERE name IN (
   'Cross River approved survey plans and survey lodgements',
   'Cross River State forest reserve boundaries',
   'Cross River National Park boundary',
   'Cross River State road network and rights-of-way',
   'Cross River planning schemes and development-control zones'
 );
UPDATE provenance.data_sources
   SET provider = 'Cross River Geographic Information Agency (CRGIA)',
       source_url = 'https://www.crgia.portal.crossriverstate.gov.ng/',
       access_stage = 'portal_found', description = 'Authoritative state GIS identified; current Dende Calabar fixtures remain test-only and are not this source.'
 WHERE name = 'Cross River State land and cadastral records';
ALTER TABLE provenance.data_sources
  DROP COLUMN access_reviewed_at,
  DROP COLUMN access_contact,
  DROP COLUMN access_notes,
  DROP COLUMN access_method;
