-- Up Migration

-- Persist the actual output of the first Cross River PDF inspection through
-- the same append-only analysis/observation model intended for future workers.
-- These pages expose areas and programme rows, not parcel coordinates.

INSERT INTO intelligence.extraction_runs(asset_id,external_key,extractor,extractor_version,run_status,page_start,page_end,diagnostics,completed_at)
SELECT a.id,x.external_key,'pdf:text+rendered-page-review','pilot-2026-08-13','complete',x.page_start,x.page_end,x.diagnostics,now()
FROM (VALUES
 ('crs-2024-q4-budget-performance-analysis-extraction',71,86,'{"textLayer":true,"renderedPages":[71,86],"coordinatePairsFound":0}'::jsonb,'crs-2024-q4-budget-performance-pdf'),
 ('crs-2026-proposed-budget-analysis-extraction',329,464,'{"textLayer":true,"renderedPages":[329,464],"coordinatePairsFound":0}'::jsonb,'crs-2026-proposed-budget-pdf')
) x(external_key,page_start,page_end,diagnostics,asset_key)
JOIN intelligence.document_assets a ON a.external_key=x.asset_key
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.analysis_runs(asset_id,external_key,analysis_type,provider,model,model_version,prompt_version,schema_version,input_checksum,status,raw_response,structured_output,confidence,usage_metadata,diagnostics,completed_at)
SELECT a.id,x.analysis_key,'general_discovery','internal','human-assisted-pdf-inspection','pilot-2026-08-13','cross-river-land-numerics-v1','land-analysis/v1',a.checksum_sha256,'complete',x.raw_response,x.structured_output,0.99,'{}'::jsonb,x.diagnostics,now()
FROM (VALUES
 ('crs-2024-q4-budget-performance-analysis-v1','crs-2024-q4-budget-performance-pdf',
  '{"method":"PDF text-layer extraction followed by rendered-page verification","pagesReviewed":[71,86]}'::jsonb,
  '{"documentFacts":{"jurisdiction":"Cross River","document":"2024 Q4 Budget Performance Report"},"observations":[{"externalKey":"crs-2024-q4-50k-ha-area","type":"area","pageNumber":71,"locator":"Agriculture ministry project table / acquisition and land rent row","rawText":"Acquisition and Land rent of 50,000 Hectares of land for Public Private and Development Partnerships","values":{"areaHectares":50000,"areaSquareMetres":500000000},"unit":"hectares","crsCandidates":[],"confidence":0.99}],"geometryCandidates":[],"warnings":["No coordinate pairs or parcel boundary found on the reviewed pages"]}'::jsonb,
  '{"coordinatePairsFound":0,"geometryCandidatesCreated":0,"visualVerification":true}'::jsonb),
 ('crs-2026-proposed-budget-analysis-v1','crs-2026-proposed-budget-pdf',
  '{"method":"PDF text-layer extraction followed by rendered-page verification","pagesReviewed":[329,464]}'::jsonb,
  '{"documentFacts":{"jurisdiction":"Cross River","document":"2026 Proposed Budget"},"observations":[{"externalKey":"crs-2026-budget-50k-ha-area","type":"area","pageNumber":329,"locator":"Agriculture ministry project table / acquisition and land rent row","rawText":"Acquisition and Land rent of 50,000 Hectares of land for Public Private and Development Partnerships","values":{"areaHectares":50000,"areaSquareMetres":500000000},"unit":"hectares","crsCandidates":[],"confidence":0.99}],"geometryCandidates":[],"warnings":["No coordinate pairs or parcel boundary found on the reviewed pages"]}'::jsonb,
  '{"coordinatePairsFound":0,"geometryCandidatesCreated":0,"visualVerification":true}'::jsonb)
) x(analysis_key,asset_key,raw_response,structured_output,diagnostics)
JOIN intelligence.document_assets a ON a.external_key=x.asset_key
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.numeric_observations(extraction_run_id,analysis_run_id,external_key,observation_type,page_number,locator,raw_text,normalized_values,unit,crs_candidates,extraction_confidence,interpretation_status)
SELECT er.id,ar.id,x.observation_key,'area',x.page_number,x.locator,x.raw_text,
       '{"areaHectares":50000,"areaSquareMetres":500000000}'::jsonb,'hectares','{}',0.99,'accepted'
FROM (VALUES
 ('crs-2024-q4-50k-ha-area','crs-2024-q4-budget-performance-analysis-extraction','crs-2024-q4-budget-performance-analysis-v1',71,'Agriculture ministry project table / acquisition and land rent row','Acquisition and Land rent of 50,000 Hectares of land for Public Private and Development Partnerships'),
 ('crs-2026-budget-50k-ha-area','crs-2026-proposed-budget-analysis-extraction','crs-2026-proposed-budget-analysis-v1',329,'Agriculture ministry project table / acquisition and land rent row','Acquisition and Land rent of 50,000 Hectares of land for Public Private and Development Partnerships')
) x(observation_key,extraction_key,analysis_key,page_number,locator,raw_text)
JOIN intelligence.extraction_runs er ON er.external_key=x.extraction_key
JOIN intelligence.analysis_runs ar ON ar.external_key=x.analysis_key
ON CONFLICT(external_key) DO NOTHING;

UPDATE intelligence.document_assets SET extraction_status='complete'
WHERE external_key IN ('crs-2024-q4-budget-performance-pdf','crs-2026-proposed-budget-pdf');

-- Down Migration
-- Append-only analysis evidence intentionally has no destructive rollback.
