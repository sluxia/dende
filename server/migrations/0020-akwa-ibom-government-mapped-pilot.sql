-- Up Migration

-- Government-first Akwa Ibom pilot. S.I. No. 70 of 2019 contains 71 right-of-way
-- survey sheets and a 570-beacon coordinate register for the Ikot Ekpene–Uyo–
-- Oron–James Town Road. Only rows 1–38, visually verified on PDF page 71, are
-- activated here. The other 532 rows remain outside checks pending page-level
-- correction and review; this import must therefore remain explicitly partial.

INSERT INTO intelligence.documents(
  external_key,title,publisher,publisher_type,document_type,source_url,canonical_url,
  published_on,content_checksum,mime_type,extraction_status,metadata
) VALUES (
  'akwa-federal-highways-row-si70-2019',
  'Federal Highways (Right of Way — Ikot Ekpene to James Town Road) Notice, 2019',
  'Federal Republic of Nigeria','legal_authority','legal_instrument',
  'https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-12-31-no-197.pdf',
  'https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-12-31-no-197.pdf',
  '2019-12-31','e71aedb3bc18deee8498329882e0c249337981ff7b331edef3ec8d229f4de9bb',
  'application/pdf','extracted',
  '{"instrument":"S.I. No. 70 of 2019","survey":"Ikot Ekpene-Uyo-Oron-James Town Road Right of Way Survey","sourceCrs":"EPSG:32632","totalRegisterBeacons":570,"validatedBeacons":38,"coverage":"partial","governmentMappedFirst":true}'::jsonb
) ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.document_assets(
  document_id,external_key,discovered_from_url,file_url,filename,format_family,
  file_extension,media_type,byte_size,checksum_sha256,storage_uri,page_count,
  text_layer_status,acquisition_status,extraction_status,acquired_at,metadata
)
SELECT d.id,'akwa-federal-highways-row-si70-2019-pdf',d.source_url,d.source_url,
  'ng-government-gazette-supplement-dated-2019-12-31-no-197.pdf','pdf','pdf',
  'application/pdf',10713055,d.content_checksum,
  'tmp/pdfs/ng-gazette-2019-197.pdf',87,'partial','downloaded','review_required',now(),
  '{"reviewedPages":[71],"registerPages":[71,75,76,77,78,79,80,81,82,83,84,85,86,87],"remainingCoordinateRows":532,"remainingStatus":"pending_page_review"}'::jsonb
FROM intelligence.documents d WHERE d.external_key='akwa-federal-highways-row-si70-2019'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.extraction_runs(
  asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,
  diagnostics,completed_at
)
SELECT a.id,'akwa-si70-row-register-page71-extraction','pdf:text+rendered-page-review',
  'pilot-2026-08-13','complete',71,71,
  '{"coordinateRowsAccepted":38,"coordinateRowsPending":532,"visualVerification":true,"sourceCrs":"EPSG:32632","assembly":"paired road-edge points"}'::jsonb,now()
FROM intelligence.document_assets a WHERE a.external_key='akwa-federal-highways-row-si70-2019-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.analysis_runs(
  asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,
  schema_version,input_checksum,status,raw_response,structured_output,confidence,
  diagnostics,completed_at
)
SELECT a.id,'akwa-si70-row-register-page71-analysis-v1','tabular_coordinates',
  'internal','human-assisted-pdf-inspection','pilot-2026-08-13',
  'akwa-government-mapped-v1','land-analysis/v1',a.checksum_sha256,'complete',
  '{"method":"PDF text extraction plus rendered-page visual verification","page":71,"rows":38}'::jsonb,
  '{"documentFacts":{"jurisdiction":"Akwa Ibom","instrument":"S.I. No. 70 of 2019","survey":"Ikot Ekpene-Uyo-Oron-James Town Road Right of Way Survey","sourceCrs":"EPSG:32632","registerRows":570},"acceptedCoordinateRows":38,"geometryCandidates":["akwa-si70-zrw1-beacons-001-034-partial"],"warnings":["Partial geometry only: 532 register rows are not activated","Road-edge polygon assembly follows the alternating paired rows visible on the register and plan"]}'::jsonb,
  0.99,'{"visualVerification":true,"partialCoverage":true,"remainingRows":532}'::jsonb,now()
FROM intelligence.document_assets a WHERE a.external_key='akwa-federal-highways-row-si70-2019-pdf'
ON CONFLICT(external_key) DO NOTHING;

WITH coords(seq,easting,northing) AS (VALUES
 (1,360330.6714,570382.9305),(2,360375.3799,570475.7629),
 (3,360754.5268,570128.2275),(4,360823.3540,570211.9736),
 (5,361162.1931,569876.2138),(6,361272.2827,569934.8816),
 (7,361563.2198,569592.7222),(8,361625.8337,569682.5378),
 (9,361993.4240,569286.8007),(10,362053.3844,569381.4592),
 (11,362318.3712,568980.5975),(12,362405.8138,569049.9381),
 (13,362677.0635,568585.1933),(14,362784.0449,568632.8607),
 (15,363002.0574,568234.7810),(16,363089.8027,568298.2606),
 (17,363312.9100,567891.7624),(18,363442.3323,567905.2947),
 (19,363658.9210,567466.1654),(20,363764.4439,567504.8288),
 (21,363979.7290,567074.2045),(22,364093.2596,567099.8621),
 (23,364359.5389,566607.0826),(24,364416.2918,566703.0192),
 (25,364595.1502,566317.2562),(26,364670.0120,566390.9417),
 (27,364933.7086,565899.6687),(28,365108.7978,565724.1493),
 (29,365019.1229,565963.2969),(30,365180.1462,565806.8540),
 (31,365331.3808,565567.5825),(32,365539.4259,565462.2911),
 (33,365386.9478,565657.5755),(34,365577.4270,565563.0375),
 (35,365723.4419,565403.4239),(36,365771.2630,565498.2813),
 (37,366225.8564,565263.6767),(38,366255.1533,565363.9330)
)
INSERT INTO intelligence.numeric_observations(
  extraction_run_id,analysis_run_id,external_key,observation_type,page_number,
  locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,
  interpretation_status
)
SELECT er.id,ar.id,'akwa-si70-p71-coordinate-'||lpad(c.seq::text,3,'0'),
  'coordinate_pair',71,'Coordinate register row '||c.seq,
  'E '||c.easting||' N '||c.northing,
  jsonb_build_object('sequence',c.seq,'easting',c.easting,'northing',c.northing),
  'metres',ARRAY['EPSG:32632'],0.99,'accepted'
FROM coords c
JOIN intelligence.extraction_runs er ON er.external_key='akwa-si70-row-register-page71-extraction'
JOIN intelligence.analysis_runs ar ON ar.external_key='akwa-si70-row-register-page71-analysis-v1'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.land_events(
  external_key,event_type,headline,summary,effective_on,country_code,admin_level_1,
  locality,survey_reference,area_sqm,original_area_text,geometry,geometry_status,
  extraction_confidence,evidence_tier,review_status,search_status,check_status
) VALUES (
  'akwa-si70-ikot-ekpene-james-town-row-partial','road_corridor',
  'Statutory Ikot Ekpene–Uyo–Oron–James Town Road right-of-way — validated initial segment',
  'Federal S.I. No. 70 of 2019 defines the road right-of-way and supplies survey plans and a 570-beacon register. This geometry uses only the 38 coordinates visually verified on register page 71; it is a partial initial segment, not the complete corridor.',
  '2019-12-31','NG','Akwa Ibom','Ikot Ekpene toward Uyo',
  'ZRW_1 coordinate register, rows 1–38',738409.35,'38 of 570 coordinate-register rows',
  ST_Multi(ST_Transform(ST_MakePolygon(ST_GeomFromText(
    'LINESTRING(360330.6714 570382.9305,360754.5268 570128.2275,361162.1931 569876.2138,361563.2198 569592.7222,361993.424 569286.8007,362318.3712 568980.5975,362677.0635 568585.1933,363002.0574 568234.781,363312.91 567891.7624,363658.921 567466.1654,363979.729 567074.2045,364359.5389 566607.0826,364595.1502 566317.2562,364933.7086 565899.6687,365019.1229 565963.2969,365331.3808 565567.5825,365386.9478 565657.5755,365723.4419 565403.4239,366225.8564 565263.6767,366255.1533 565363.933,365771.263 565498.2813,365577.427 565563.0375,365539.4259 565462.2911,365180.1462 565806.854,365108.7978 565724.1493,364670.012 566390.9417,364416.2918 566703.0192,364093.2596 567099.8621,363764.4439 567504.8288,363442.3323 567905.2947,363089.8027 568298.2606,362784.0449 568632.8607,362405.8138 569049.9381,362053.3844 569381.4592,361625.8337 569682.5378,361272.2827 569934.8816,360823.354 570211.9736,360375.3799 570475.7629,360330.6714 570382.9305)',32632)),4326)),
  'derived',0.99,1,'accepted','searchable','eligible'
) ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports','S.I. No. 70 of 2019; Second Schedule; PDF page 71',
  'Coordinate register rows 1–38, origin UTM Zone 32 (WGS 84), visually verified; remaining rows withheld.'
FROM intelligence.land_events e,intelligence.documents d
WHERE e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
  AND d.external_key='akwa-federal-highways-row-si70-2019'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.geometry_candidates(
  land_event_id,external_key,method,source_crs,geometry,confidence,validation_status,check_eligible
)
SELECT e.id,'akwa-si70-zrw1-beacons-001-034-partial','coordinate_table','EPSG:32632',
  e.geometry,0.99,'valid',true
FROM intelligence.land_events e
WHERE e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.geometry_candidate_observations(geometry_candidate_id,numeric_observation_id,sequence_number)
SELECT gc.id,no.id,(no.normalized_values->>'sequence')::int
FROM intelligence.geometry_candidates gc
JOIN intelligence.numeric_observations no ON no.external_key LIKE 'akwa-si70-p71-coordinate-%'
WHERE gc.external_key='akwa-si70-zrw1-beacons-001-034-partial'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,x.event_type,'system:migration',x.reason,
  jsonb_build_object('geometryStatus',e.geometry_status,'checkStatus',e.check_status,'validatedRows',38,'totalRows',570,'partial',true)
FROM intelligence.land_events e
CROSS JOIN (VALUES
 ('accepted','Government gazette coordinate page visually reviewed and geometry validated'),
 ('search_enabled','Official partial right-of-way evidence may be discovered'),
 ('check_enabled','Only the 38-row validated initial segment participates in spatial checks')
) x(event_type,reason)
WHERE e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
  AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id AND r.event_type=x.event_type);

WITH source AS (
  INSERT INTO provenance.data_sources(
    type,name,provider,country_code,admin_level_1,format,source_url,authority_level,
    status,coverage_status,access_stage,coverage_geometry,description
  )
  SELECT 'reserve','Akwa Ibom federal highway statutory rights-of-way',
    'Federal Republic of Nigeria / Federal Ministry of Works','NG','Akwa Ibom',
    'gazette survey plan and coordinate register',d.source_url,'official','partial',
    'partial','usable',e.geometry,
    'S.I. No. 70 of 2019. Current coverage is limited to 38 visually verified rows of a 570-beacon register; unreviewed rows are excluded from checks.'
  FROM intelligence.documents d,intelligence.land_events e
  WHERE d.external_key='akwa-federal-highways-row-si70-2019'
    AND e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
    AND NOT EXISTS(SELECT 1 FROM provenance.data_sources s WHERE s.name='Akwa Ibom federal highway statutory rights-of-way')
  RETURNING id
), selected_source AS (
  SELECT id FROM source UNION ALL
  SELECT id FROM provenance.data_sources WHERE name='Akwa Ibom federal highway statutory rights-of-way' LIMIT 1
), imported AS (
  INSERT INTO provenance.data_imports(source_id,filename,file_type,checksum,record_count,imported_by,status)
  SELECT id,'ng-government-gazette-supplement-dated-2019-12-31-no-197.pdf','pdf',
    'e71aedb3bc18deee8498329882e0c249337981ff7b331edef3ec8d229f4de9bb',1,
    'system:government-mapped-pilot','complete' FROM selected_source
  ON CONFLICT DO NOTHING RETURNING id,source_id
), selected_import AS (
  SELECT id,source_id FROM imported UNION ALL
  SELECT i.id,i.source_id FROM provenance.data_imports i JOIN selected_source s ON s.id=i.source_id
  WHERE i.checksum='e71aedb3bc18deee8498329882e0c249337981ff7b331edef3ec8d229f4de9bb' LIMIT 1
)
INSERT INTO zones.reserves(osm_id,name,protection_class,landuse,geometry,source_url,source_id,import_id)
SELECT 'FHA-SI70-2019-ZRW1-PARTIAL-001-038',
  'Ikot Ekpene–Uyo–Oron–James Town Road statutory ROW (partial)',
  'statutory_road_right_of_way','transport_right_of_way',e.geometry,d.source_url,si.source_id,si.id
FROM intelligence.land_events e,intelligence.documents d,selected_import si
WHERE e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
  AND d.external_key='akwa-federal-highways-row-si70-2019'
  AND NOT EXISTS(SELECT 1 FROM zones.reserves z WHERE z.osm_id='FHA-SI70-2019-ZRW1-PARTIAL-001-038');

INSERT INTO zones.meta(layer,source_url,row_count)
SELECT 'reserves',source_url,1 FROM intelligence.documents
WHERE external_key='akwa-federal-highways-row-si70-2019'
  AND NOT EXISTS(SELECT 1 FROM zones.meta WHERE source_url=intelligence.documents.source_url);

-- The named AKWAGIS layouts are catalogued before media discovery, but have no
-- acquired geometry and therefore cannot participate in checks.
INSERT INTO provenance.data_sources(
  type,name,provider,country_code,admin_level_1,format,source_url,authority_level,
  status,coverage_status,access_stage,description
)
SELECT x.type,x.name,'Akwa Ibom Geographic Information System (AKWAGIS)','NG','Akwa Ibom',
  'government allocation portal','https://akwagis.ak.gov.ng/application/allocation/new',
  'official','planned','unavailable','portal_found',x.description
FROM (VALUES
 ('cadastral','Anua Offot Ifa Ikot Okpon Government Residential Estate layout','Government layout named by the official allocation portal; boundary geometry and operative plan have not been acquired, so it is excluded from checks.'),
 ('cadastral','Nung Ette / Ikot Ambon / Owot Uta government layout','Government layout named by the official allocation portal; boundary geometry and operative plan have not been acquired, so it is excluded from checks.')
) x(type,name,description)
WHERE NOT EXISTS(SELECT 1 FROM provenance.data_sources s WHERE s.name=x.name);

-- Down Migration
-- Append-only intelligence evidence is intentionally retained. Operational
-- coverage can be disabled without deleting its provenance.
UPDATE provenance.data_sources SET status='archived',coverage_status='unavailable'
WHERE name='Akwa Ibom federal highway statutory rights-of-way';
DELETE FROM zones.reserves WHERE osm_id='FHA-SI70-2019-ZRW1-PARTIAL-001-038';
