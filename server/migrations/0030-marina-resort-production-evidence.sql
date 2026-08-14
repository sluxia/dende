-- Up Migration

-- Accepted Marina Resort production evidence. The bundle establishes state
-- control, active public investment/PPP activity and a reference location. It
-- does not contain a cadastral perimeter and therefore cannot enable checks.

WITH source AS (
  INSERT INTO provenance.data_sources(
    type,name,provider,country_code,admin_level_1,admin_level_2,format,
    source_url,authority_level,status,coverage_status,access_stage,access_method,
    access_notes,access_reviewed_at,description
  ) VALUES (
    'other','Cross River Marina Resort production evidence bundle',
    'Cross River State Government / Tourism Bureau','NG','Cross River',
    'Calabar Municipal','mixed',
    'https://pppportal.ipb.cr.gov.ng/','official','partial','unavailable','usable',
    'Official public websites and downloadable PDF reports',
    'The bundle establishes that Marina Resort is a state-controlled waterfront asset and documents current PPP and jetty activity. One independent publication supplies a location point. No title schedule, survey plan, area or perimeter polygon was found; all spatial checks remain disabled.',
    DATE '2026-08-13',
    'Production provenance for Marina Resort Calabar. Suitable for identity, control, project history and location discovery, but not parcel intersection.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO provenance.data_imports(source_id,filename,file_type,checksum,record_count,imported_by,status)
SELECT s.id,x.filename,'pdf',x.checksum,1,'system:spatial-research','complete'
FROM source s
CROSS JOIN (VALUES
  ('CRS-2024-Audited-Financial-Statements.pdf','207c45091459aac8d7a31d49c54ad80ed71247d09749d2d907b3f888ff289c97'),
  ('CRS-2025-Q1-Budget-Performance.pdf','e250354a4c6ddc144258dd125ff7659a82cdb14c153fa1cb88d705ef395b5fc6'),
  ('AJHTL-Calabar-Tourism-Attractions-Coordinates.pdf','86f4b597700664f3fce00f6901d87e7219874a22273ccbb0cf444f9a0a277100')
) x(filename,checksum);

WITH docs(external_key,title,publisher,publisher_type,document_type,source_url,published_on,content_checksum,mime_type,extraction_status,metadata) AS (VALUES
  ('crs-marina-resort-ppp-pipeline','Cross River PPP Pipeline Projects - Marina Resort','Cross River State Investment Promotion Bureau / PPP Portal','government','official_notice','https://pppportal.ipb.cr.gov.ng/',DATE '2026-01-07',NULL,NULL,'extracted','{"projectValue":"NGN 5 billion","stage":"implementation","contractingAuthority":"Tourism Bureau","scope":"identity and current PPP status; no boundary"}'::jsonb),
  ('crs-2025-q1-budget-performance','Cross River State Budget Implementation Report - 2025 Quarter 1','Cross River State Government','government','budget','https://www.crossriverstate.gov.ng/download/UTF-8CRS%20BIR%202025%20Q1%20FINAL.pdf',DATE '2025-03-31','e250354a4c6ddc144258dd125ff7659a82cdb14c153fa1cb88d705ef395b5fc6','application/pdf','extracted','{"marinaLocator":"PDF page 98 / printed page 97","project":"Construction of Water Jetty at Marina Resort for water sport recreation","budgetNgn":10000000}'::jsonb),
  ('crs-2024-audited-financial-statements','Cross River State Government 2024 Annual Report and Accounts','Office of the Auditor-General, Cross River State','government','statistical_report','https://auditgen.cr.gov.ng/wp-content/uploads/2025/06/CRS-2024-Audited-Financial-Statements.pdf',DATE '2024-12-31','207c45091459aac8d7a31d49c54ad80ed71247d09749d2d907b3f888ff289c97','application/pdf','extracted','{"marinaLocators":["PDF page 29 / printed page 26 controlled entities","PDF page 69 / printed page 66 investment schedule"],"productionUse":"state-control evidence; no boundary"}'::jsonb),
  ('crs-marina-resort-tourism-coordinate-study','Tourism Attractions in Calabar: Geospatial Technologies and Marketing','African Journal of Hospitality, Tourism and Leisure','independent','independent_report','https://www.ajhtl.com/uploads/7/1/6/3/7163688/article_23_12_3_1145-1162.pdf',DATE '2023-08-01','86f4b597700664f3fce00f6901d87e7219874a22273ccbb0cf444f9a0a277100','application/pdf','extracted','{"marinaLocator":"PDF page 5 / printed page 1149, Table 1, Point 8","coordinateRole":"location observation only"}'::jsonb),
  ('crs-facts-figures-2024-marina','Cross River State Facts and Figures 2022-2024','Cross River State Bureau of Statistics','government','statistical_report','https://crossriverstate.gov.ng/download/Bureau%20of%20Statistics/formatted%20Personal%20F%26F%20FINAL%20PRINT-1.pdf',DATE '2025-01-01',NULL,'application/pdf','discovered','{"discoveryEvidence":"search index identifies Table 5.8 Marina Resort initiatives","acquisitionStatus":"current URL returned application HTML rather than the PDF on 2026-08-13","claimsQuarantined":true}'::jsonb)
)
INSERT INTO intelligence.documents(external_key,title,publisher,publisher_type,document_type,source_url,published_on,content_checksum,mime_type,extraction_status,metadata)
SELECT external_key,title,publisher,publisher_type,document_type,source_url,published_on,content_checksum,mime_type,extraction_status,metadata
FROM docs ON CONFLICT(external_key) DO NOTHING;

WITH assets(document_key,external_key,file_url,filename,byte_size,checksum,page_count,text_layer_status,acquisition_status,extraction_status,metadata) AS (VALUES
  ('crs-2024-audited-financial-statements','crs-2024-audited-financial-statements-pdf','https://auditgen.cr.gov.ng/wp-content/uploads/2025/06/CRS-2024-Audited-Financial-Statements.pdf','CRS-2024-Audited-Financial-Statements.pdf',5016856::bigint,'207c45091459aac8d7a31d49c54ad80ed71247d09749d2d907b3f888ff289c97',86,'present','downloaded','complete','{"pagesReviewed":[29,69],"coordinatePairsFound":0}'::jsonb),
  ('crs-2025-q1-budget-performance','crs-2025-q1-budget-performance-pdf','https://www.crossriverstate.gov.ng/download/UTF-8CRS%20BIR%202025%20Q1%20FINAL.pdf','CRS-2025-Q1-Budget-Performance.pdf',1551847::bigint,'e250354a4c6ddc144258dd125ff7659a82cdb14c153fa1cb88d705ef395b5fc6',131,'present','downloaded','complete','{"pagesReviewed":[98],"coordinatePairsFound":0}'::jsonb),
  ('crs-marina-resort-tourism-coordinate-study','crs-marina-resort-tourism-coordinate-study-pdf','https://www.ajhtl.com/uploads/7/1/6/3/7163688/article_23_12_3_1145-1162.pdf','AJHTL-Calabar-Tourism-Attractions-Coordinates.pdf',611367::bigint,'86f4b597700664f3fce00f6901d87e7219874a22273ccbb0cf444f9a0a277100',18,'present','downloaded','complete','{"pagesReviewed":[5],"coordinatePairsFound":1,"coordinateIsBoundary":false}'::jsonb),
  ('crs-facts-figures-2024-marina','crs-facts-figures-2024-marina-pdf','https://crossriverstate.gov.ng/download/Bureau%20of%20Statistics/formatted%20Personal%20F%26F%20FINAL%20PRINT-1.pdf','Cross-River-Facts-and-Figures-2022-2024.pdf',NULL,NULL,NULL,'unknown','failed','failed','{"failure":"URL returned the state single-page application HTML instead of a PDF on 2026-08-13","retryRequired":true}'::jsonb)
)
INSERT INTO intelligence.document_assets(document_id,external_key,discovered_from_url,file_url,filename,format_family,file_extension,media_type,byte_size,checksum_sha256,page_count,text_layer_status,acquisition_status,extraction_status,acquired_at,metadata)
SELECT d.id,a.external_key,d.source_url,a.file_url,a.filename,'pdf','pdf','application/pdf',a.byte_size,a.checksum,a.page_count,a.text_layer_status,a.acquisition_status,a.extraction_status,
       CASE WHEN a.acquisition_status='downloaded' THEN now() END,a.metadata
FROM assets a JOIN intelligence.documents d ON d.external_key=a.document_key
ON CONFLICT(external_key) DO NOTHING;

WITH runs(asset_key,external_key,page_start,page_end,diagnostics) AS (VALUES
  ('crs-2024-audited-financial-statements-pdf','crs-marina-audited-statements-extraction',29,69,'{"pagesRendered":[29,69],"finding":"Marina Resort listed among controlled entities; investment table has no stated carrying value","boundaryFound":false}'::jsonb),
  ('crs-2025-q1-budget-performance-pdf','crs-marina-q1-budget-extraction',98,98,'{"pagesRendered":[98],"finding":"NGN 10 million water jetty project; zero percent Q1 performance","boundaryFound":false}'::jsonb),
  ('crs-marina-resort-tourism-coordinate-study-pdf','crs-marina-coordinate-study-extraction',5,5,'{"pagesRendered":[5],"finding":"Table 1 Point 8 gives 4.966083 N, 8.318607 E","coordinatePairsFound":1,"boundaryFound":false}'::jsonb)
)
INSERT INTO intelligence.extraction_runs(asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,diagnostics,completed_at)
SELECT a.id,r.external_key,'pdf:text+rendered-page-review','1.0','complete',r.page_start,r.page_end,r.diagnostics,now()
FROM runs r JOIN intelligence.document_assets a ON a.external_key=r.asset_key
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.analysis_runs(asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,schema_version,input_checksum,status,structured_output,confidence,diagnostics,completed_at)
SELECT a.id,'crs-marina-production-evidence-analysis-v1','general_discovery','internal-review','document-evidence-review','1.0','marina-source-validation-v1','1.0',a.checksum_sha256,'complete',
       '{"subject":"Marina Resort Calabar","establishedFacts":{"stateControlledEntity":true,"pppStage":"implementation","pppValueNgn":5000000000,"contractingAuthority":"Tourism Bureau","waterJettyBudgetNgn":10000000,"referencePoint":{"latitude":4.966083,"longitude":8.318607}},"missingForChecks":["title or acquisition instrument","parcel survey/cadastral plan","total land area","PPP concession schedules","resort/museum/jetty component boundaries","shoreline and water-lot limits"],"geometryDecision":"location point retained as observation; overlap geometry withheld"}'::jsonb,
       0.98,'{"independentSourceUsedOnlyForLocation":true,"pointNotBuffered":true,"checkActivation":false}'::jsonb,now()
FROM intelligence.document_assets a
WHERE a.external_key='crs-marina-resort-tourism-coordinate-study-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.numeric_observations(extraction_run_id,analysis_run_id,external_key,observation_type,page_number,locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,interpretation_status)
SELECT er.id,ar.id,'crs-marina-resort-reference-point-2023','latitude_longitude',5,
       'Table 1: Spatial distribution of tourism attractions in Calabar, Point 8',
       'Point 8 Marina Resort 4.966083 8.318607',
       '{"latitude":4.966083,"longitude":8.318607,"role":"location reference","boundaryVertex":false}'::jsonb,
       'decimal_degrees',ARRAY['EPSG:4326'],0.99,'accepted'
FROM intelligence.extraction_runs er
JOIN intelligence.analysis_runs ar ON ar.external_key='crs-marina-production-evidence-analysis-v1'
WHERE er.external_key='crs-marina-coordinate-study-extraction'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.land_events(external_key,event_type,headline,summary,effective_on,country_code,admin_level_1,admin_level_2,locality,layout_name,geometry_status,extraction_confidence,evidence_tier,review_status,search_status,check_status)
VALUES (
  'crs-marina-resort-state-controlled-asset','government_property',
  'Cross River financial statements identify Marina Resort as a controlled entity',
  'The 2024 audited financial statements list Marina Resort among entities controlled by Cross River State. Official PPP and budget records also document an implementation-stage tourism project and a Marina Resort water-jetty budget line. These records establish the public asset and ongoing intervention, but contain no parcel perimeter.',
  DATE '2024-12-31','NG','Cross River','Calabar Municipal','Calabar waterfront','Marina Resort Calabar','unavailable',0.99,1,'accepted','searchable','excluded'
)
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports',x.locator,x.excerpt
FROM (VALUES
  ('crs-2024-audited-financial-statements','PDF page 29 / printed page 26 - Controlled Entities','Marina Resort is listed among entities over which Cross River State Government has control.'),
  ('crs-marina-resort-ppp-pipeline','Marina Resort pipeline row','Official pipeline records a Tourism Bureau project in implementation with an indicated value of NGN 5 billion.'),
  ('crs-2025-q1-budget-performance','PDF page 98 / printed page 97','Budget report includes construction of a Marina Resort water jetty for recreation.')
) x(document_key,locator,excerpt)
JOIN intelligence.documents d ON d.external_key=x.document_key
JOIN intelligence.land_events e ON e.external_key='crs-marina-resort-state-controlled-asset'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:spatial-research',
       'Approved production evidence establishes state control and project activity; no cadastral geometry was supplied.',
       jsonb_build_object('reviewStatus',e.review_status,'searchStatus',e.search_status,'checkStatus',e.check_status,'geometryStatus',e.geometry_status,'referencePoint',jsonb_build_object('latitude',4.966083,'longitude',8.318607,'boundary',false))
FROM intelligence.land_events e
WHERE e.external_key='crs-marina-resort-state-controlled-asset'
  AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id AND r.event_type='accepted');

INSERT INTO provenance.spatial_validation_events(asset_id,candidate_reference,validation_type,outcome,observed_values,reason,source_url,actor)
SELECT a.id,'AJHTL 2023 Table 1 Point 8','geometry_availability','failed',
       '{"featureType":"point","latitude":4.966083,"longitude":8.318607,"boundaryVertex":false,"buffered":false}'::jsonb,
       'The coordinate is a tourism-attraction reference point, not a surveyed perimeter. It may locate the asset but cannot be buffered or used for parcel intersection.',
       'https://www.ajhtl.com/uploads/7/1/6/3/7163688/article_23_12_3_1145-1162.pdf','system:spatial-research'
FROM provenance.spatial_asset_inventory a
WHERE a.external_key='crs-asset-marina-resort'
  AND NOT EXISTS(SELECT 1 FROM provenance.spatial_validation_events v WHERE v.asset_id=a.id AND v.candidate_reference='AJHTL 2023 Table 1 Point 8');

UPDATE provenance.spatial_asset_inventory
SET source_url='https://pppportal.ipb.cr.gov.ng/',
    file_url='https://auditgen.cr.gov.ng/wp-content/uploads/2025/06/CRS-2024-Audited-Financial-Statements.pdf',
    acquisition_status='downloaded',processing_status='geometry_found',geometry_status='located',check_status='excluded',
    missing_material='Title/acquisition instrument, cadastral perimeter, total land area, concession schedules, component boundaries for the resort/museum/jetty, and shoreline or water-lot limits.',
    next_action='Request the Tourism Bureau asset schedule and Blakes concession site-plan annexes; obtain the deposited survey from Lands/CRGIA and reconcile the Elder Dempster Jetty, museum and shoreline components before polygon validation.',
    evidence_notes='Approved production bundle: 2024 audited statements identify Marina Resort as a state-controlled entity; official PPP records show Tourism Bureau implementation at NGN 5 billion; the 2025 Q1 report budgets a water jetty. AJHTL Table 1 Point 8 locates the attraction at 4.966083 N, 8.318607 E but is not boundary geometry. Checks remain excluded.',
    updated_at=now()
WHERE external_key='crs-asset-marina-resort';

-- Down Migration
UPDATE provenance.spatial_asset_inventory
SET source_url='https://pppportal.ipb.cr.gov.ng/',file_url=NULL,acquisition_status='source_found',processing_status='queued',geometry_status='unavailable',check_status='excluded',
    missing_material='Title/acquisition instrument, cadastral plan, waterfront limits and jetty/water boundary',
    next_action='Request asset schedule and perimeter survey from Tourism Bureau/Lands; inspect PPP, EIA and jetty files for plans',
    evidence_notes='Current state PPP pipeline and budgets identify Marina Resort as a government tourism asset under implementation.',updated_at=now()
WHERE external_key='crs-asset-marina-resort';
DELETE FROM provenance.spatial_validation_events WHERE candidate_reference='AJHTL 2023 Table 1 Point 8';
-- Intelligence evidence remains append-only by design.
DELETE FROM provenance.data_imports WHERE source_id=(SELECT id FROM provenance.data_sources WHERE name='Cross River Marina Resort production evidence bundle');
DELETE FROM provenance.data_sources WHERE name='Cross River Marina Resort production evidence bundle';
