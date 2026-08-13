-- Up Migration

CREATE TABLE provenance.spatial_validation_events (
  id bigserial PRIMARY KEY,
  asset_id uuid NOT NULL REFERENCES provenance.spatial_asset_inventory(id) ON DELETE RESTRICT,
  candidate_reference text NOT NULL,
  validation_type text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('passed','failed','inconclusive')),
  observed_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  source_url text,
  actor text NOT NULL DEFAULT 'system:spatial-validation',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spatial_validation_asset_idx ON provenance.spatial_validation_events(asset_id,created_at);

-- WDPA 40925 is a legitimate protected-area register record, but the current
-- BIOPAMA profile explicitly identifies it as a point feature: GIS area 0 km2,
-- centroid POINT (8.55 5.3333), reported area 1,906 km2. A centroid cannot be
-- buffered or otherwise converted into the park's legal boundary.
INSERT INTO provenance.spatial_validation_events(asset_id,candidate_reference,validation_type,outcome,observed_values,reason,source_url)
SELECT id,'WDPA 40925','geometry_availability','failed',
  '{"featureType":"point","centroid":{"longitude":8.55,"latitude":5.3333},"gisAreaKm2":0,"reportedAreaKm2":1906,"statusYear":1988}'::jsonb,
  'Current feature is point-only. It provides identity and location evidence but no polygon boundary; it is not check geometry.',
  'https://rris.biopama.org/pa/40925?language=en'
FROM provenance.spatial_asset_inventory
WHERE external_key='crs-asset-crnp-oban'
  AND NOT EXISTS(SELECT 1 FROM provenance.spatial_validation_events v WHERE v.asset_id=spatial_asset_inventory.id AND v.candidate_reference='WDPA 40925');

UPDATE provenance.spatial_asset_inventory
SET acquisition_status='under_review',geometry_status='unavailable',check_status='excluded',
    missing_material='A polygon boundary with traceable federal or approved authoritative provenance. WDPA 40925 is point-only.',
    next_action='Acquire and inspect WDPA 20299 or park-authority boundary data; validate division topology against Decree 36 of 1991 and the rendered reserve map.',
    evidence_notes=evidence_notes||' Validation rejected WDPA 40925 as geometry: the profile reports a point, GIS area 0 km2 and centroid 8.55E 5.3333N.',updated_at=now()
WHERE external_key='crs-asset-crnp-oban';

-- WDPA 20299 is the official-name Cross River National Park register target.
-- Its public API currently fails to return an extent, so lineage is confirmed
-- but geometry availability is inconclusive and remains quarantined.
INSERT INTO provenance.spatial_validation_events(asset_id,candidate_reference,validation_type,outcome,observed_values,reason,source_url)
SELECT id,'WDPA 20299','geometry_availability','inconclusive',
  '{"registeredName":"Cross River","designation":"National Park","reportedCombinedAreaKm2":4000,"apiExtentStatus":"HTTP 500"}'::jsonb,
  'The register ID is confirmed, but the public extent endpoint did not return geometry. No polygon was available to validate.',
  'https://api.biopama.org/api/pame/function/api_wdpa_extent/20299'
FROM provenance.spatial_asset_inventory
WHERE external_key IN ('crs-asset-crnp-oban','crs-asset-crnp-okwangwo')
  AND NOT EXISTS(SELECT 1 FROM provenance.spatial_validation_events v WHERE v.asset_id=spatial_asset_inventory.id AND v.candidate_reference='WDPA 20299');

UPDATE provenance.spatial_asset_inventory
SET acquisition_status='under_review',geometry_status='unavailable',check_status='excluded',
    missing_material='Division-specific polygon boundary and federal instrument topology; WDPA 20299 extent is not currently retrievable from the public API.',
    next_action='Obtain the current Protected Planet download or park-authority GIS; compare area, enclaves, Cameroon boundary and separation from Oban.',
    evidence_notes=evidence_notes||' WDPA 20299 register identity confirmed; public extent API returned HTTP 500, so no geometry has been accepted.',updated_at=now()
WHERE external_key='crs-asset-crnp-okwangwo';

UPDATE provenance.spatial_acquisition_campaigns
SET status='validating',current_stage='validation',
    notes='Initial validation started with Oban and Okwangwo. WDPA 40925 rejected as point-only; WDPA 20299 extent retrieval is inconclusive. Government inventory continues in parallel.'
WHERE external_key='ng-cross-river-spatial-rerun-v1';

-- Down Migration
DROP TABLE provenance.spatial_validation_events;
