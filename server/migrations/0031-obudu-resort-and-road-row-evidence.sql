-- Up Migration

WITH source AS (
  INSERT INTO provenance.data_sources(
    type,name,provider,country_code,admin_level_1,admin_level_2,format,source_url,
    authority_level,status,coverage_status,access_stage,access_method,access_notes,
    access_reviewed_at,description
  ) VALUES (
    'other','Obudu Mountain Resort and federal approach-road evidence bundle',
    'Cross River State Government / Federal Ministry of Works and Housing',
    'NG','Cross River','Obanliku','mixed',
    'https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf',
    'official','partial','unavailable','under_review','Public official reports and federal gazette',
    'The resort evidence establishes state control, conflicting reported extents and the existence of a completed 3D survey. The federal gazette separately provides 35 ROW survey sheets and a 262-beacon UTM register. Text-layer corruption prevents automatic activation until every coordinate is verified against the rendered register and map sheets.',
    DATE '2026-08-13',
    'Production evidence for Obudu Mountain Resort plus a distinct acquisition and validation target for the Obudu Town-Obudu Cattle Ranch Road federal right-of-way.'
  )
  ON CONFLICT DO NOTHING RETURNING id
)
INSERT INTO provenance.data_imports(source_id,filename,file_type,checksum,record_count,imported_by,status)
SELECT s.id,x.filename,'pdf',x.checksum,x.records,'system:spatial-research','complete'
FROM source s CROSS JOIN (VALUES
  ('ng-government-gazette-2019-no-171-obudu-row.pdf','17999b9a9a0fb4086bd895c51ae7c0669645d92bc577673cf902bc6b1a373082',262),
  ('obudu-mountain-resort-directory.pdf','e3dbf251536e98b10002d72daf64fd14a0a1d83968284605a0d3e935e08baa1a',1)
) x(filename,checksum,records);

WITH docs(external_key,title,publisher,publisher_type,document_type,source_url,published_on,checksum,mime,status,metadata) AS (VALUES
  ('ng-2019-obudu-cattle-ranch-road-row','Federal Highways (Right of Way - Obudu to Obudu Cattle Ranch Road) Notice, 2019','Federal Republic of Nigeria','legal_authority','gazette','https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf',DATE '2019-10-04','17999b9a9a0fb4086bd895c51ae7c0669645d92bc577673cf902bc6b1a373082','application/pdf','extracted','{"instrument":"S.I. No. 58 of 2019","gazette":"No. 171, Vol. 106","surveySheets":35,"beacons":262,"declaredCrs":"UTM Zone 32N (WGS84)","purpose":"avoid future encroachment"}'::jsonb),
  ('crs-obudu-mountain-resort-directory','Obudu Mountain Resort Directory','Obudu Mountain Resort','unknown','other','https://www.obudumountainresort.com/Obudu%20Mountain%20Resort%20Directory.pdf',NULL,'e3dbf251536e98b10002d72daf64fd14a0a1d83968284605a0d3e935e08baa1a','application/pdf','extracted','{"reportedExtentSquareKilometres":134,"extentStatus":"conflicts with state statistical publication"}'::jsonb),
  ('crs-obudu-sustainable-development-report','Cross River State Sustainable Development Report','Cross River State Bureau of Statistics','government','statistical_report','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/SUSTAINABLE%20FINAL%20PRINT-1.pdf',NULL,NULL,'application/pdf','discovered','{"reportedExtentSquareKilometres":104,"acquisitionStatus":"current URL returned application HTML on 2026-08-13","claimsQuarantined":true}'::jsonb),
  ('crs-obudu-ranch-3d-survey-completed','Cross River State one-year address - Obudu Ranch Resort 3D survey','Cross River State Government News','government','government_news','https://news.crossriverstate.gov.ng/state-wide-address-and-media-parley-by-his-excellency-the-governor-senator-prince-bassey-edet-otu-to-commemorate-one-year-in-office-as-the-executive-governor-of-cross-river-state-29th-m/',DATE '2024-05-29',NULL,'text/html','extracted','{"finding":"3D digital survey of the Ranch Resort completed","underlyingFilePublic":false}'::jsonb),
  ('crs-obudu-ranch-redesigned-master-plan','Cross River announces redesigned Obudu Ranch Resort master plan','Cross River State Government News','government','government_news','https://news.crossriverstate.gov.ng/cross-river-to-revolutionise-tourism-with-five-star-obudu-ranch-resort/',DATE '2025-11-13',NULL,'text/html','extracted','{"finding":"redesigned master plan completed; reconstruction planned in phases","underlyingFilePublic":false}'::jsonb)
)
INSERT INTO intelligence.documents(external_key,title,publisher,publisher_type,document_type,source_url,published_on,content_checksum,mime_type,extraction_status,metadata)
SELECT external_key,title,publisher,publisher_type,document_type,source_url,published_on,checksum,mime,status,metadata FROM docs
ON CONFLICT(external_key) DO NOTHING;

WITH assets(document_key,external_key,file_url,filename,bytes,checksum,pages,text_status,acq_status,extract_status,metadata) AS (VALUES
  ('ng-2019-obudu-cattle-ranch-road-row','ng-2019-obudu-cattle-ranch-road-row-pdf','https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf','ng-government-gazette-2019-no-171-obudu-row.pdf',5052604::bigint,'17999b9a9a0fb4086bd895c51ae7c0669645d92bc577673cf902bc6b1a373082',44,'partial','downloaded','review_required','{"noticePage":2,"surveySheetPages":[3,37],"coordinateRegisterPages":[38,44],"declaredCrs":"EPSG:32632","beaconCount":262,"automatedRowsAccepted":0,"reason":"text-layer digit and column corruption requires rendered-page verification"}'::jsonb),
  ('crs-obudu-mountain-resort-directory','crs-obudu-mountain-resort-directory-pdf','https://www.obudumountainresort.com/Obudu%20Mountain%20Resort%20Directory.pdf','obudu-mountain-resort-directory.pdf',2963807::bigint,'e3dbf251536e98b10002d72daf64fd14a0a1d83968284605a0d3e935e08baa1a',18,'present','downloaded','complete','{"extentLocator":"PDF page 3","coordinatePairsFound":0}'::jsonb),
  ('crs-obudu-sustainable-development-report','crs-obudu-sustainable-development-report-pdf','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/SUSTAINABLE%20FINAL%20PRINT-1.pdf','crs-sustainable-development-report.pdf',NULL,NULL,NULL,'unknown','failed','failed','{"failure":"URL returned state application HTML rather than PDF on 2026-08-13","retryRequired":true}'::jsonb)
)
INSERT INTO intelligence.document_assets(document_id,external_key,discovered_from_url,file_url,filename,format_family,file_extension,media_type,byte_size,checksum_sha256,page_count,text_layer_status,acquisition_status,extraction_status,acquired_at,metadata)
SELECT d.id,a.external_key,d.source_url,a.file_url,a.filename,'pdf','pdf','application/pdf',a.bytes,a.checksum,a.pages,a.text_status,a.acq_status,a.extract_status,
       CASE WHEN a.acq_status='downloaded' THEN now() END,a.metadata
FROM assets a JOIN intelligence.documents d ON d.external_key=a.document_key
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.extraction_runs(asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,diagnostics,completed_at)
SELECT a.id,'ng-2019-obudu-row-register-extraction-v1','pdf:text+rendered-register-review','1.0','complete',2,44,
       '{"noticeVerified":true,"surveySheets":35,"registerRowsExpected":262,"registerRowsAutomaticallyAccepted":0,"crs":"EPSG:32632","ocrQuality":"mixed","activation":"withheld","nextPass":"transcribe all rows from rendered pages 38-44 and reconcile alternating ROW sides against sheets 1-35"}'::jsonb,now()
FROM intelligence.document_assets a WHERE a.external_key='ng-2019-obudu-cattle-ranch-road-row-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.extraction_runs(asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,diagnostics,completed_at)
SELECT a.id,'crs-obudu-directory-extraction','pdf:text+rendered-page-review','1.0','complete',3,3,
       '{"reportedExtentSquareKilometres":134,"boundaryCoordinatesFound":0}'::jsonb,now()
FROM intelligence.document_assets a WHERE a.external_key='crs-obudu-mountain-resort-directory-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.analysis_runs(asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,schema_version,input_checksum,status,structured_output,confidence,diagnostics,completed_at)
SELECT a.id,'crs-obudu-resort-and-row-analysis-v1','map','internal-review','document-and-register-review','1.0','obudu-source-validation-v1','1.0',a.checksum_sha256,'complete',
       '{"resort":{"stateControlled":true,"reportedExtentsSquareKilometres":[104,134],"extentConflictSquareKilometres":30,"completed3dSurveyReported":true,"redesignedMasterPlanReported":true,"boundaryDecision":"withheld"},"roadRightOfWay":{"instrument":"S.I. No. 58 of 2019","surveySheets":35,"beacons":262,"sourceCrs":"EPSG:32632","legalPurpose":"avoid future encroachment","registerStatus":"authoritative source acquired; transcription validation pending","geometryDecision":"withheld"},"separationRule":"road ROW, resort estate and Becheve Nature Reserve are independent spatial assets"}'::jsonb,
       0.99,'{"areaConflictQuarantined":true,"rowRegisterTextCorruption":true,"syntheticBufferProhibited":true}'::jsonb,now()
FROM intelligence.document_assets a WHERE a.external_key='ng-2019-obudu-cattle-ranch-road-row-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.numeric_observations(extraction_run_id,analysis_run_id,external_key,observation_type,page_number,locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,interpretation_status)
SELECT er.id,ar.id,'crs-obudu-directory-reported-extent-134km2','area',3,'Overview and Location',
       'Obudu Mountain Resort is approximately 134 square kilometers in extent.',
       '{"squareKilometres":134,"squareMetres":134000000,"scope":"reported resort extent","conflictsWithSquareKilometres":104}'::jsonb,
       'square_kilometre','{}',0.99,'ambiguous'
FROM intelligence.extraction_runs er JOIN intelligence.analysis_runs ar ON ar.external_key='crs-obudu-resort-and-row-analysis-v1'
WHERE er.external_key='crs-obudu-directory-extraction'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.land_events(external_key,event_type,headline,summary,effective_on,country_code,admin_level_1,admin_level_2,locality,layout_name,geometry_status,extraction_confidence,evidence_tier,review_status,search_status,check_status)
VALUES
 ('crs-obudu-resort-state-controlled-asset','government_property','Cross River records Obudu Ranch Resort as a controlled state entity','The state audited accounts identify Obudu Ranch Resort as controlled by Cross River State. State reports also say a 3D digital survey and redesigned master plan have been completed, but neither spatial file is publicly attached. Published extent figures of 104 and 134 square kilometres conflict and are not used as geometry.',DATE '2024-12-31','NG','Cross River','Obanliku','Obudu Plateau','Obudu Mountain Resort','unavailable',0.99,1,'accepted','searchable','excluded'),
 ('ng-obudu-cattle-ranch-road-row-notice-2019','road_corridor','Federal gazette establishes the Obudu Town-Obudu Cattle Ranch Road right-of-way','S.I. No. 58 of 2019 publishes 35 survey sheets and a 262-beacon coordinate register in UTM Zone 32N (WGS84) to prevent encroachment. The source is authoritative, but geometry remains excluded until every coordinate is transcribed and reconciled against the survey sheets.',DATE '2019-10-04','NG','Cross River','Obanliku','Obudu Town to Obudu Cattle Ranch','Obudu Town-Obudu Cattle Ranch Road ROW','unavailable',0.99,1,'accepted','searchable','excluded')
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports',x.locator,x.excerpt
FROM (VALUES
 ('crs-obudu-resort-state-controlled-asset','crs-2024-audited-financial-statements','PDF page 29 / printed page 26','Obudu Ranch Resort is listed among entities controlled by Cross River State Government.'),
 ('crs-obudu-resort-state-controlled-asset','crs-obudu-ranch-3d-survey-completed','Tourism section','State reports completion of a 3D digital survey of the Ranch Resort.'),
 ('ng-obudu-cattle-ranch-road-row-notice-2019','ng-2019-obudu-cattle-ranch-road-row','Notice page 2 and coordinate-register pages 38-44','Federal notice publishes the road ROW survey and its 262-beacon UTM coordinate register.')
) x(event_key,document_key,locator,excerpt)
JOIN intelligence.land_events e ON e.external_key=x.event_key JOIN intelligence.documents d ON d.external_key=x.document_key
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:spatial-research','Approved production evidence; search enabled while check geometry remains quarantined.',
       jsonb_build_object('reviewStatus',e.review_status,'searchStatus',e.search_status,'checkStatus',e.check_status,'geometryStatus',e.geometry_status)
FROM intelligence.land_events e
WHERE e.external_key IN ('crs-obudu-resort-state-controlled-asset','ng-obudu-cattle-ranch-road-row-notice-2019')
  AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id AND r.event_type='accepted');

-- A distinct inventory asset prevents the federal ROW from being conflated with
-- the resort estate or a synthetic road buffer.
INSERT INTO provenance.spatial_asset_inventory(
  campaign_id,external_key,asset_name,alternate_names,asset_class,authority_name,country_code,admin_level_1,admin_level_2,locality,legal_status,instrument_reference,source_url,file_url,geometry_status,check_status,acquisition_status,missing_material,next_action,evidence_notes,risk_priority,risk_reason,processing_status,visibility
)
SELECT c.id,'crs-asset-obudu-cattle-ranch-road-row','Obudu Town-Obudu Cattle Ranch Road federal right-of-way',ARRAY['Obudu Cattle Ranch Road ROW','ZRW2'],'transport_right_of_way','Federal Ministry of Works and Housing','NG','Cross River','Obanliku','Obudu Town to Obudu Cattle Ranch','gazetted','S.I. No. 58 of 2019',
       'https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf','https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf','extracting','excluded','downloaded',
       'Verified transcription of all 262 UTM beacons and a polygon reconstructed according to the legal left/right ROW sequence.',
       'Transcribe rendered register pages 38-44, verify every value against survey sheets 1-35, reconstruct the alternating ROW sides in EPSG:32632, transform to EPSG:4326, then validate topology and width before activation.',
       'Federal gazette acquired. It declares UTM Zone 32N (WGS84), provides 35 survey sheets and lists ZRW2-001 through ZRW2-262. Automated text extraction corrupts some digits, so no coordinates or geometry have been accepted yet.',1,
       'The instrument expressly exists to avoid future encroachment; corridor crossings are directly relevant to land-buyer alerts.','researching','public'
FROM provenance.spatial_acquisition_campaigns c WHERE c.external_key='ng-cross-river-spatial-rerun-v1'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO provenance.spatial_asset_inventory(
  campaign_id,external_key,asset_name,alternate_names,asset_class,authority_name,country_code,admin_level_1,admin_level_2,locality,legal_status,stated_area_sqm,source_url,geometry_status,check_status,acquisition_status,missing_material,next_action,evidence_notes,risk_priority,risk_reason,processing_status,visibility
)
SELECT c.id,'crs-asset-becheve-nature-reserve','Becheve Nature Reserve',ARRAY['Becheve Forest Reserve'],'conservation_area','Obudu Conservation Centre / Cross River conservation authorities','NG','Cross River','Obanliku','Obudu Plateau / Becheve','reported',650000,
       'https://obuduranchresort.com/article/15/becheve-nature-reserve','unavailable','excluded','source_found','Establishment instrument, authoritative perimeter and reconciliation of reported 65/70-hectare areas','Acquire the reserve management plan or GIS boundary from the Obudu Conservation Centre/NCF and keep it separate from the resort estate.','Resort operator reports 65 hectares; published bird research reports approximately 70 hectares. Neither is accepted as geometry.',1,'Protected montane forest embedded in the wider resort landscape and vulnerable to edge encroachment.','queued','public'
FROM provenance.spatial_acquisition_campaigns c WHERE c.external_key='ng-cross-river-spatial-rerun-v1'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO provenance.spatial_validation_events(asset_id,candidate_reference,validation_type,outcome,observed_values,reason,source_url,actor)
SELECT a.id,'S.I. No. 58 of 2019 / ZRW2-001-ZRW2-262','coordinate_register_quality','inconclusive',
       '{"surveySheets":35,"beaconsExpected":262,"sourceCrs":"EPSG:32632","automatedRowsAccepted":0,"geometryCreated":false,"textLayerCorruption":true}'::jsonb,
       'Authoritative register acquired, but some digits and column boundaries are corrupted in text extraction. Activation requires rendered-page transcription and map-sheet reconciliation.',
       'https://archive.gazettes.africa/archive/ng/2019/ng-government-gazette-supplement-dated-2019-11-12-no-171.pdf','system:spatial-research'
FROM provenance.spatial_asset_inventory a WHERE a.external_key='crs-asset-obudu-cattle-ranch-road-row'
  AND NOT EXISTS(SELECT 1 FROM provenance.spatial_validation_events v WHERE v.asset_id=a.id AND v.candidate_reference='S.I. No. 58 of 2019 / ZRW2-001-ZRW2-262');

UPDATE provenance.spatial_asset_inventory
SET source_url='https://news.crossriverstate.gov.ng/state-wide-address-and-media-parley-by-his-excellency-the-governor-senator-prince-bassey-edet-otu-to-commemorate-one-year-in-office-as-the-executive-governor-of-cross-river-state-29th-m/',
    file_url='https://auditgen.cr.gov.ng/wp-content/uploads/2025/06/CRS-2024-Audited-Financial-Statements.pdf',acquisition_status='downloaded',processing_status='geometry_found',geometry_status='located',check_status='excluded',
    missing_material='The completed 3D survey, redesigned master-plan spatial files, title/asset schedule and authoritative operative perimeter; resolution of the 104/134 km2 conflict.',
    next_action='Request the 3D survey and redesigned master-plan files from the Resort/Tourism Bureau and compare them with the title schedule and Becheve boundary before validating a resort polygon.',
    evidence_notes='Approved production evidence establishes state control and reports completed survey/master-plan work. Published extents conflict at 104 and 134 km2; neither is used as geometry. The resort, Becheve Nature Reserve and federal approach-road ROW remain separate assets.',updated_at=now()
WHERE external_key='crs-asset-obudu-mountain-resort';

-- Down Migration
UPDATE provenance.spatial_asset_inventory SET acquisition_status='source_found',processing_status='queued',geometry_status='unavailable',check_status='excluded',file_url=NULL,updated_at=now() WHERE external_key='crs-asset-obudu-mountain-resort';
DELETE FROM provenance.spatial_validation_events WHERE candidate_reference='S.I. No. 58 of 2019 / ZRW2-001-ZRW2-262';
DELETE FROM provenance.spatial_asset_inventory WHERE external_key IN ('crs-asset-obudu-cattle-ranch-road-row','crs-asset-becheve-nature-reserve');
-- Intelligence evidence remains append-only by design.
DELETE FROM provenance.data_imports WHERE source_id=(SELECT id FROM provenance.data_sources WHERE name='Obudu Mountain Resort and federal approach-road evidence bundle');
DELETE FROM provenance.data_sources WHERE name='Obudu Mountain Resort and federal approach-road evidence bundle';
