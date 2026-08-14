-- Up Migration
--
-- Applies the 2026-08-14 spatial acquisition research runs for the three
-- pilot states (Lagos, Federal Capital Territory, Ogun) to the authoritative
-- source catalogue, following the pattern of 0014 (Cross River audit).
--
-- Research-only runs: every source remains planned/unavailable and excluded
-- from checks. No geometry has been validated, imported or activated.
-- Ogun's public GeoNode/GeoServer SDI is recorded as dataset_found, which
-- requires the acquisition gate (download, checksum, validation, licence
-- review, explicit activation) before it may influence any check.

-- 1. Enrich the existing cadastral catalogue entries.

UPDATE provenance.data_sources
   SET access_stage = 'access_required',
       access_method = 'Authenticated Land Administration Portal (e-GIS) parcel search; formal institutional/MOA request required for dataset access',
       access_contact = 'Lands Bureau, The Secretariat, Alausa, Ikeja — landsbureau@lagosstate.gov.ng · 08177775128; Ministry of Justice Gazette desk info@lagosstatemoj.org · +234 9167802222',
       access_notes = 'Research run 2026-08-14: portal confirmed live at landonline.lagosstate.gov.ng (e-GIS since Jan 2024) with authenticated parcel search, GIS maps, scanned documents, transaction history, CTC and Land Use Charge views; survey validation portal live at ossgdeposit.lagosstate.gov.ng; LASBCA model-city/master-plan PDFs (one declared EPSG:26331); LSSDI ArcGIS Hub; GRID3 Nigeria WFS; Lagos State Official Gazette flipbook (info@lagosstatemoj.org). No public or downloadable cadastral layer, API, WFS or WMS found. Both EPSG:26331 and EPSG:26391 are used in Lagos practice; CRS must be confirmed per source. Access stage remains access_required; coverage remains unavailable pending authenticated/MOA access or an official data release.',
       access_reviewed_at = DATE '2026-08-14',
       description = 'Official Lagos State land-information custodian. Authenticated e-GIS portal and survey-validation portal exist, but no usable public dataset has been acquired; formal institutional access is required.'
 WHERE name = 'Lagos State land and cadastral records'
   AND country_code = 'NG' AND admin_level_1 = 'Lagos';

UPDATE provenance.data_sources
   SET access_stage = 'access_required',
       access_method = 'Formal data request to AGIS; only application forms and subscription/paid products are exposed',
       access_contact = 'AGIS (https://agis.fcta.gov.ng/); FCTA Department of Survey and Mapping (https://www.fcta.gov.ng/ova_dep/survey-and-mapping/); OSGOF, 8 Yawoori Yawuri Street, Wuse, Garki II',
       access_notes = 'Research run 2026-08-14: AGIS confirmed as the sole official FCT geospatial custodian; it exposes only application forms and subscription/paid products with no anonymous download, documented API, WFS or WMS. FCTA Department of Survey and Mapping and FCDA Urban and Regional Planning hold cadastral, layout, resettlement and compensation records. One reputable secondary boundary source (open.africa, CC-BY) identified but not yet downloaded, checksummed or validated. No authoritative geometry validated; access stage remains access_required.',
       access_reviewed_at = DATE '2026-08-14',
       description = 'Official Federal Capital Territory cadastral and land-registry custodian. AGIS is portal-only with paid products; no usable public dataset has been acquired; formal agency access is required.'
 WHERE name = 'Federal Capital Territory land and cadastral records'
   AND country_code = 'NG' AND admin_level_1 = 'Federal Capital Territory';

UPDATE provenance.data_sources
   SET access_stage = 'dataset_found',
       access_method = 'Public GeoNode/GeoServer SDI (WFS + API) at gis.ogunstate.gov.ng; licence review and import gate required before any check use',
       access_contact = 'Ogun GIS GeoNode (https://gis.ogunstate.gov.ng/); Bureau of Lands, Oke-Mosan, Abeokuta; info@ogunstate.gov.ng; DG Esv. Fatai Adeboyejo; Acting Surveyor-General Surv. Oladele Ewulo',
       access_notes = 'Research run 2026-08-14: lands.ogunstate.gov.ng was unreachable and remains portal-level only, but the state publishes a live public GeoNode/GeoServer SDI exposing parcels (10,986), blocks (1,462), beacons (10,638), gazetted-acquisition polygons (95), existing-cadastre estate layers (4,228) and a smart-city layout (475), native CRS EPSG:26331 (Minna UTM 31N) with some layers EPSG:32631. All key layers are publisher-declared public_domain (not legally vetted). OLARMS parcel-status records remain login-gated. No download, checksum, validation or import has occurred, so coverage remains unavailable and no feature may influence checks.',
       access_reviewed_at = DATE '2026-08-14',
       description = 'Official Ogun State land-information custodian. A live public GeoNode/GeoServer SDI exposes cadastral and gazetted-acquisition vector layers, but licence, currency and geometry validity remain unvetted and nothing has been imported for checks.'
 WHERE name = 'Ogun State land and cadastral records'
   AND country_code = 'NG' AND admin_level_1 = 'Ogun';

-- 2. Register the discovered target authorities/datasets as catalogue entries.

WITH targets(type, name, provider, admin_level_1, source_url, access_stage, access_method, access_contact, access_notes, description) AS (
  VALUES
    ('cadastral', 'Lagos State Land Administration Portal (e-GIS)', 'Lagos State Lands Bureau', 'Lagos', 'https://landonline.lagosstate.gov.ng/', 'access_required', 'Authenticated parcel search; institutional/MOA access required', 'landsbureau@lagosstate.gov.ng · 08177775128', 'Live e-GIS portal for cadastral parcels, C-of-O and Governor''s Consent. Authenticated access only; no public download or API.', 'Target source for Lagos cadastral parcels and certificates; no dataset acquired.'),
    ('survey', 'Lagos State survey certificate validation portal', 'Office of the State Surveyor-General of Lagos', 'Lagos', 'https://ossgdeposit.lagosstate.gov.ng/survey/check.php', 'access_required', 'Formal request; possible coordinate extraction with cooperation', 'Office of the State Surveyor-General, 133 Obafemi Awolowo Way, Alausa', 'Validates survey plan numbers; potential coordinate source only with institutional cooperation.', 'Target source for approved Lagos survey plans; no records acquired.'),
    ('other', 'Lagos State Spatial Data Infrastructure (LSSDI)', 'Lagos State / africageoportal', 'Lagos', 'https://lagossdi-africageoportal.hub.arcgis.com', 'access_required', 'ArcGIS Hub item enumeration pending', NULL, 'Hub item id 2f012205b9054d979e8f9af725cba3f4; children/services enumeration outstanding; no confirmed public datasets yet.', 'Target platform for Lagos SDI; no usable dataset confirmed.'),
    ('other', 'Lagos State model city and master plans', 'LASBCA / Ministry of Physical Planning and Urban Development', 'Lagos', 'https://lasbca.lagosstate.gov.ng/resources/', 'access_required', 'Downloadable plan PDFs; georeferencing required', 'lasbca@lagosstate.gov.ng · 07005050404', 'Twelve model city/master plan schemes; LCMP declared EPSG:26331. Route-4 georeferencing targets, not validated polygons.', 'Target source for Lagos planning schemes; no validated geometry.'),
    ('other', 'Lagos State Official Gazette', 'Lagos State Ministry of Justice', 'Lagos', 'https://lagosstatemoj.org/test/', 'access_required', 'Flipbook extraction; acquisition and excision notices', 'info@lagosstatemoj.org · +234 9167802222', 'Official gazette available as flipbook only; extraction of acquisition/excision schedules requires cooperation.', 'Target source for Lagos acquisition and excision schedules; no dataset acquired.'),
    ('cadastral', 'Ogun State Spatial Data Infrastructure (GeoNode/GeoServer)', 'Ogun GIS / Bureau of Lands', 'Ogun', 'https://gis.ogunstate.gov.ng/catalogue/', 'dataset_found', 'Public WFS + API (geoserver/ows); import gate required', 'https://gis.ogunstate.gov.ng/; info@ogunstate.gov.ng', 'Live public SDI exposing parcels (10,986), beacons (10,638), blocks (1,462), gazette_areas (95) and estate cadastre (4,228), EPSG:26331, declared public_domain. Requires download, checksum, validation and licence review before activation.', 'Candidate usable dataset for Ogun cadastral records; not yet imported or validated.'),
    ('reserve', 'Ogun State forest reserve boundaries and registry', 'Ogun State Ministry of Forestry', 'Ogun', 'https://ogunforestryoperations.com.ng/total_reserves.php', 'portal_found', 'Official registry page; formal data request for boundaries', NULL, 'Official forestry registry lists reserve names and stated areas (e.g. Omo 1358.06 km2, Olokemeji 58.88 km2). No authoritative boundary polygons or beacon schedules published.', 'Target source for Ogun forest-reserve boundaries; no usable spatial dataset located.'),
    ('cadastral', 'Ogun State land records system (OLARMS)', 'Ogun State Bureau of Lands', 'Ogun', 'https://olarms.ogunstate.gov.ng/', 'access_required', 'Login-gated parcel status records; institutional access required', 'DG Esv. Fatai Adeboyejo; Surv. Oladele Ewulo', 'Land records system launched 2021; Old/New OLARMS CofO statuses visible only behind authentication. No public geometry.', 'Target system for Ogun parcel status records; no dataset acquired.'),
    ('other', 'Ogun State industrial estates (OPIC)', 'Ogun State Property and Investment Corporation', 'Ogun', 'https://opicgroup.com/agbara-estate', 'authority_identified', 'Formal data request to OPIC', NULL, 'OPIC (Edict 10 of 1984) manages Agbara and Igbesa industrial estates; no published boundary geometry found.', 'Target source for Ogun industrial-estate boundaries; no usable spatial dataset located.'),
    ('other', 'Ogun state boundary determinations', 'National Boundary Commission', 'Ogun', NULL, 'authority_identified', 'Formal data request to NBC', 'NBC secretariat', 'Lagos-Ogun and Ogun-Ondo boundary cases in progress; no boundary coordinates published.', 'Target source for Ogun inter-state boundaries; no usable spatial dataset located.'),
    ('cadastral', 'Abuja Geographic Information Systems (AGIS) records', 'FCTA / AGIS', 'Federal Capital Territory', 'https://agis.fcta.gov.ng/', 'access_required', 'Formal data request to AGIS; paid/subscription products only', 'https://agis.fcta.gov.ng/', 'Sole official FCT geospatial custodian; exposes application forms and subscription/paid products with no anonymous download, API, WFS or WMS.', 'Target source for FCT cadastral and land records; no usable dataset acquired.'),
    ('survey', 'FCT Department of Survey and Mapping records', 'FCTA', 'Federal Capital Territory', 'https://www.fcta.gov.ng/ova_dep/survey-and-mapping/', 'access_required', 'Formal data request to FCTA', NULL, 'Urban survey, cadastral-zone, layout, perimeter and TDP survey records; contributed base data to AGIS. No public download.', 'Target source for FCT survey and cadastral-zone records; no usable dataset located.'),
    ('other', 'FCDA Urban and Regional Planning records', 'Federal Capital Development Authority', 'Federal Capital Territory', 'https://fcda.gov.ng/urban-and-regional-planning/', 'access_required', 'Formal data request to FCDA', NULL, 'Master plans, Phase IV/V districts, resettlement schemes (Guzape II, Gude, UniAbuja Giri) and industrial layouts. No public geometry.', 'Target source for FCT planning and master-plan zones; no usable dataset located.'),
    ('other', 'FCDA Resettlement and Compensation records', 'Federal Capital Development Authority', 'Federal Capital Territory', 'https://fcda.gov.ng/resettlement-and-compensation/', 'access_required', 'Formal data request to FCDA', NULL, 'Acquisition and compensation records for road expansions, housing schemes and industrial layouts. No public geometry.', 'Target source for FCT acquired-land and compensation extents; no usable dataset located.'),
    ('other', 'OSGOF Geodesy and NIGNET records', 'Office of the Surveyor-General of the Federation', 'Federal Capital Territory', 'https://osgof.gov.ng/geodesy/', 'access_required', 'Formal data request to OSGOF', 'OSGOF, 8 Yawoori Yawuri Street, Wuse, Garki II', 'Pillar coordinates, cadastral surveys, RTK CORS corrections and NIGNET network records; regulated access.', 'Target source for FCT geodetic control; no dataset acquired.')
)
INSERT INTO provenance.data_sources
  (type, name, provider, country_code, admin_level_1, format, source_url,
   authority_level, status, coverage_status, access_stage, access_method,
   access_contact, access_notes, access_reviewed_at, description)
SELECT type, name, provider, 'NG', admin_level_1, 'mixed', source_url,
       'official', 'planned', 'unavailable', access_stage, access_method,
       access_contact, access_notes, DATE '2026-08-14', description
  FROM targets t
 WHERE NOT EXISTS (SELECT 1 FROM provenance.data_sources s WHERE s.name = t.name);

-- 3. Open spatial acquisition campaigns for the three pilot states.

INSERT INTO provenance.spatial_acquisition_campaigns
  (external_key, country_code, admin_level_1, scope, procedure_version,
   sequence_number, status, current_stage, started_at, notes)
VALUES
  ('ng-lagos-spatial-v1', 'NG', 'Lagos', 'state', '1.0', 4, 'inventory', 'authoritative_sources', now(),
   'Research run 2026-08-14: 14 categories searched, 47 assets recorded. Portals confirmed (landonline e-GIS, survey validation) but no public cadastral download; state not covered.'),
  ('ng-fct-spatial-v1', 'NG', 'Federal Capital Territory', 'state', '1.0', 5, 'inventory', 'authoritative_sources', now(),
   'Research run 2026-08-14: 14 categories searched, 145 assets recorded. AGIS portal-only with paid products; state not covered.'),
  ('ng-ogun-spatial-v1', 'NG', 'Ogun', 'state', '1.0', 6, 'inventory', 'authoritative_sources', now(),
   'Research run 2026-08-14: 14 categories searched, 99 assets recorded. Public GeoNode/GeoServer SDI found (dataset_found); no import or validation; state not covered.')
ON CONFLICT(external_key) DO NOTHING;

-- Down Migration
DELETE FROM provenance.spatial_acquisition_campaigns
 WHERE external_key IN ('ng-lagos-spatial-v1','ng-fct-spatial-v1','ng-ogun-spatial-v1');

DELETE FROM provenance.data_sources
 WHERE name IN (
   'Lagos State Land Administration Portal (e-GIS)',
   'Lagos State survey certificate validation portal',
   'Lagos State Spatial Data Infrastructure (LSSDI)',
   'Lagos State model city and master plans',
   'Lagos State Official Gazette',
   'Ogun State Spatial Data Infrastructure (GeoNode/GeoServer)',
   'Ogun State forest reserve boundaries and registry',
   'Ogun State land records system (OLARMS)',
   'Ogun State industrial estates (OPIC)',
   'Ogun state boundary determinations',
   'Abuja Geographic Information Systems (AGIS) records',
   'FCT Department of Survey and Mapping records',
   'FCDA Urban and Regional Planning records',
   'FCDA Resettlement and Compensation records',
   'OSGOF Geodesy and NIGNET records'
 );

UPDATE provenance.data_sources
   SET access_stage = 'portal_found',
       access_method = NULL,
       access_contact = NULL,
       access_notes = NULL,
       access_reviewed_at = NULL,
       description = CASE name
         WHEN 'Lagos State land and cadastral records' THEN 'Authoritative state lands custodian identified; usable parcel dataset not yet acquired.'
         WHEN 'Federal Capital Territory land and cadastral records' THEN 'Authoritative FCT cadastral and land-registry custodian identified; usable parcel dataset not yet acquired.'
         WHEN 'Ogun State land and cadastral records' THEN 'Authoritative state lands and survey custodian identified; usable parcel dataset not yet acquired.'
         ELSE description END
 WHERE name IN (
   'Lagos State land and cadastral records',
   'Federal Capital Territory land and cadastral records',
   'Ogun State land and cadastral records'
 );
