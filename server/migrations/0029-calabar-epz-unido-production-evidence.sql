-- Up Migration

-- The 1991 UNIDO feasibility report is accepted as production evidence for
-- the identity, approximate stated area and physical context of the original
-- Calabar EPZ site. Its scanned drawings are not independently georeferenced,
-- so this migration deliberately does not create a zones.reserves feature or
-- enable overlap checks.

WITH source AS (
  INSERT INTO provenance.data_sources(
    type,name,provider,country_code,admin_level_1,admin_level_2,format,
    source_url,license,authority_level,status,coverage_status,access_stage,
    access_method,access_notes,access_reviewed_at,description
  ) VALUES (
    'other',
    'UNIDO Calabar Export Processing Zone feasibility study and plans (1991)',
    'United Nations Industrial Development Organization (UNIDO)',
    'NG','Cross River','Calabar Municipal','pdf',
    'https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
    'UNIDO fair-use policy stated in the document',
    'open_data','partial','unavailable','usable',
    'Public UNIDO document download',
    'Production evidence acquired and reviewed. It contains a location plan and split scanned site-plan sheets, but no readable coordinate grid or independently verifiable perimeter. It supports identity, stated area and boundary context only; it is excluded from spatial checks until a georeferenced perimeter is validated.',
    DATE '2026-08-13',
    '1991 feasibility study commissioned for the proposed Export Processing Zone at the Port of Calabar. The report states that the assigned L-shaped site covered about 106 hectares and describes its physical neighbours. A separate 200-hectare eastward extension was proposed and is not treated as assigned zone land.'
  )
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO provenance.data_imports(
  source_id,filename,file_type,checksum,record_count,imported_by,status
)
SELECT id,'unido-calabar-epz-volume-iv.pdf','pdf',
       '706c6ba12395697918db73d97c4538dd73c7973a3f8c7f74e5172cded77acdf8',
       1,'system:spatial-research','complete'
FROM source;

INSERT INTO intelligence.documents(
  external_key,title,publisher,publisher_type,document_type,source_url,
  canonical_url,published_on,content_checksum,mime_type,extraction_status,metadata
) VALUES (
  'crs-calabar-epz-unido-feasibility-1991',
  'Feasibility Study on the Establishment of an Export Processing Zone in the Port of Calabar — Final Report, Volume IV',
  'United Nations Industrial Development Organization (UNIDO)',
  'independent','independent_report',
  'https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
  'https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
  DATE '1991-11-01',
  '706c6ba12395697918db73d97c4538dd73c7973a3f8c7f74e5172cded77acdf8',
  'application/pdf','extracted',
  '{"contract":"91/045","project":"DP/NIR/90/015","revision":"November 1991","productionUse":"identity, stated area and boundary context","checkGeometry":false}'::jsonb
)
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.document_assets(
  document_id,external_key,discovered_from_url,file_url,filename,format_family,
  file_extension,media_type,byte_size,checksum_sha256,page_count,text_layer_status,
  acquisition_status,extraction_status,acquired_at,metadata
)
SELECT d.id,'crs-calabar-epz-unido-feasibility-1991-pdf',d.source_url,d.source_url,
       'unido-calabar-epz-volume-iv.pdf','pdf','pdf','application/pdf',5714951,
       '706c6ba12395697918db73d97c4538dd73c7973a3f8c7f74e5172cded77acdf8',
       193,'partial','downloaded','complete',now(),
       '{"relevantPages":[24,33,92,93,94,95,96,97,98,99,100,101,102,103],"drawingNumbers":[1,2,3,4,5,6],"visualReview":"complete","coordinateGrid":"not readable","boundaryActivation":"withheld"}'::jsonb
FROM intelligence.documents d
WHERE d.external_key='crs-calabar-epz-unido-feasibility-1991'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.extraction_runs(
  asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,
  diagnostics,completed_at
)
SELECT a.id,'crs-calabar-epz-unido-feasibility-1991-extraction',
       'pdf:text+rendered-page-review','1.0','complete',1,193,
       '{"pagesRendered":[92,93,94,95,96,97,98,99,100,101,102,103],"coordinatePairsFound":0,"sitePlanSplitAcrossSheets":true,"readableCoordinateGrid":false,"reportedAssignedAreaHectares":106,"proposedAdditionalAreaHectares":200}'::jsonb,
       now()
FROM intelligence.document_assets a
WHERE a.external_key='crs-calabar-epz-unido-feasibility-1991-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.analysis_runs(
  asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,
  schema_version,input_checksum,status,structured_output,confidence,diagnostics,completed_at
)
SELECT a.id,'crs-calabar-epz-unido-feasibility-1991-analysis-v1','map',
       'internal-review','document-and-plan-review','1.0','cftz-source-validation-v1',
       '1.0',a.checksum_sha256,'complete',
       '{"subject":"Calabar Export Processing Zone","assignedSite":{"areaHectares":106,"shape":"L-shaped","riverFrontageMetres":1500,"westernBoundary":"Calabar River","easternBoundaryPart":"access road to Nassarawa village","southernBoundary":"Plywood Factory"},"proposal":{"additionalEastwardAreaHectares":200,"status":"proposed, not assigned"},"drawings":{"locationPlan":[92,93],"generalSitePlan":[94,95],"constraints":[96,97],"preliminaryLandUse":[98,99],"landUsePlan":[100,101],"siteDevelopmentPlan":[102,103]},"geometryDecision":"withheld pending georeferencing and perimeter validation"}'::jsonb,
       0.96,
       '{"boundaryNotDigitized":true,"reason":"scanned split sheets have no readable coordinate grid or sufficient validated ground-control points"}'::jsonb,
       now()
FROM intelligence.document_assets a
WHERE a.external_key='crs-calabar-epz-unido-feasibility-1991-pdf'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.numeric_observations(
  extraction_run_id,analysis_run_id,external_key,observation_type,page_number,
  locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,
  interpretation_status
)
SELECT er.id,ar.id,x.external_key,'area',x.page_number,x.locator,x.raw_text,
       x.normalized_values,'hectare','{}',x.confidence,'accepted'
FROM intelligence.extraction_runs er
JOIN intelligence.analysis_runs ar ON ar.external_key='crs-calabar-epz-unido-feasibility-1991-analysis-v1'
CROSS JOIN (VALUES
  ('crs-calabar-epz-unido-assigned-area-106ha',24,'Part 2, section 2.1 — EPZ Location','The area covers about 106 hectares and has an L-shaped form.','{"hectares":106,"squareMetres":1060000,"scope":"assigned site","approximate":true}'::jsonb,0.99::numeric),
  ('crs-calabar-epz-unido-proposed-extension-200ha',24,'Part 2, section 2.1 — EPZ Location','An additional 200 hectares of land would allow the EPZ Authority to cater for projects requiring very large areas of land.','{"hectares":200,"squareMetres":2000000,"scope":"proposed eastward extension","assigned":false}'::jsonb,0.99::numeric)
) x(external_key,page_number,locator,raw_text,normalized_values,confidence)
WHERE er.external_key='crs-calabar-epz-unido-feasibility-1991-extraction'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.land_events(
  external_key,event_type,headline,summary,effective_on,country_code,
  admin_level_1,admin_level_2,locality,layout_name,area_sqm,original_area_text,
  geometry_status,extraction_confidence,evidence_tier,review_status,search_status,
  check_status
) VALUES (
  'crs-calabar-epz-unido-assigned-site-1991','government_property',
  '1991 UNIDO plan documents the assigned Calabar EPZ site',
  'The feasibility report describes an approximately 106-hectare, L-shaped assigned site about seven kilometres north of Calabar, with about 1.5 kilometres along the Calabar River. It separately proposes a possible 200-hectare eastward extension; that proposal is not treated as assigned zone land.',
  DATE '1991-11-01','NG','Cross River','Calabar Municipal','Port of Calabar / Nassarawa access road','Calabar Export Processing Zone',
  1060000,'about 106 hectares','unavailable',0.96,2,'accepted','searchable','excluded'
)
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports','Page 24, section 2.1; drawings 1–6 on PDF pages 92–103',
       'The report states an approximately 106-hectare assigned site and describes its neighbours; drawings show its historic planning context.'
FROM intelligence.land_events e
JOIN intelligence.documents d ON d.external_key='crs-calabar-epz-unido-feasibility-1991'
WHERE e.external_key='crs-calabar-epz-unido-assigned-site-1991'
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:spatial-research',
       'Accepted as production evidence for identity, area and context; geometry remains excluded until independently georeferenced and validated.',
       jsonb_build_object('reviewStatus',e.review_status,'searchStatus',e.search_status,
                          'checkStatus',e.check_status,'geometryStatus',e.geometry_status,
                          'assignedAreaHectares',106,'proposedExtensionHectares',200)
FROM intelligence.land_events e
WHERE e.external_key='crs-calabar-epz-unido-assigned-site-1991'
  AND NOT EXISTS(
    SELECT 1 FROM intelligence.review_events r
    WHERE r.land_event_id=e.id AND r.event_type='accepted'
  );

INSERT INTO provenance.spatial_validation_events(
  asset_id,candidate_reference,validation_type,outcome,observed_values,reason,
  source_url,actor
)
SELECT a.id,'UNIDO DP/NIR/90/015, Volume IV (November 1991)',
       'document_plan_geometry_availability','inconclusive',
       '{"assignedAreaHectares":106,"proposedExtensionHectares":200,"assignedShape":"L-shaped","calabarRiverFrontageMetres":1500,"drawingPages":[92,93,94,95,96,97,98,99,100,101,102,103],"coordinatePairsFound":0,"readableCoordinateGrid":false}'::jsonb,
       'The source is valid production evidence and contains historic perimeter drawings, but the split scanned sheets lack a readable coordinate grid and sufficient validated ground-control points for a defensible EPSG:4326 polygon.',
       'https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
       'system:spatial-research'
FROM provenance.spatial_asset_inventory a
WHERE a.external_key='crs-asset-calabar-free-trade-zone'
  AND NOT EXISTS(
    SELECT 1 FROM provenance.spatial_validation_events v
    WHERE v.asset_id=a.id
      AND v.candidate_reference='UNIDO DP/NIR/90/015, Volume IV (November 1991)'
  );

UPDATE provenance.spatial_asset_inventory
SET stated_area_sqm=1060000,
    source_url='https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
    file_url='https://downloads.unido.org/ot/49/90/4990556/15001-20000_19569.pdf',
    acquisition_status='downloaded',processing_status='geometry_found',
    geometry_status='located',check_status='excluded',
    missing_material='A georeferenced legal or as-built perimeter with sufficient control points; confirmation of whether later extensions changed the operative boundary.',
    next_action='Georeference the UNIDO General Site Plan sheets using at least three independently validated control points, compare against a current NEPZA/as-built perimeter, then validate topology and area before activation.',
    evidence_notes='UNIDO Volume IV (November 1991) accepted for production provenance. Page 24 states an approximately 106-hectare L-shaped assigned site with about 1.5 km on the Calabar River; a separate 200-hectare eastward extension is only proposed. Drawings 1–6 were reviewed. No coordinate grid or defensible EPSG:4326 perimeter was available, so checks remain excluded.',
    updated_at=now()
WHERE external_key='crs-asset-calabar-free-trade-zone';

-- Down Migration
UPDATE provenance.spatial_asset_inventory
SET stated_area_sqm=NULL,
    source_url='https://nepza.gov.ng/free-zones/operational-zones/',
    file_url=NULL,acquisition_status='source_found',processing_status='queued',
    geometry_status='unavailable',check_status='excluded',
    missing_material='Designation instrument, original perimeter plan and 98.024-hectare extension survey',
    next_action='Request designation and extension polygons from NEPZA; locate gazette and survey documents in federal records',
    evidence_notes='NEPZA lists CFTZ as a federal operational zone. A reported 2002 extension of 98.024 hectares requires primary confirmation.',
    updated_at=now()
WHERE external_key='crs-asset-calabar-free-trade-zone';

DELETE FROM provenance.spatial_validation_events
WHERE candidate_reference='UNIDO DP/NIR/90/015, Volume IV (November 1991)';

-- Evidence, extraction and review records are intentionally append-only. A
-- rollback removes their production-source/catalog binding but retains the
-- audit trail instead of bypassing the immutable-evidence triggers.
DELETE FROM provenance.data_imports
WHERE source_id=(SELECT id FROM provenance.data_sources WHERE name='UNIDO Calabar Export Processing Zone feasibility study and plans (1991)');
DELETE FROM provenance.data_sources
WHERE name='UNIDO Calabar Export Processing Zone feasibility study and plans (1991)';
