-- Up Migration

-- The 38 coordinate rows on register page 71 are individually readable, but
-- rows 27–38 contain computed/intersection beacons whose road-edge topology
-- cannot be inferred safely from table order alone. The first 26 rows preserve
-- the simple alternating left/right sequence and form a valid corridor. Keep
-- all 38 observations, but restrict the check geometry and its links to 1–26.

UPDATE intelligence.land_events
SET geometry=ST_Multi(ST_Transform(ST_MakePolygon(ST_GeomFromText(
  'LINESTRING(360330.6714 570382.9305,360754.5268 570128.2275,361162.1931 569876.2138,361563.2198 569592.7222,361993.424 569286.8007,362318.3712 568980.5975,362677.0635 568585.1933,363002.0574 568234.781,363312.91 567891.7624,363658.921 567466.1654,363979.729 567074.2045,364359.5389 566607.0826,364595.1502 566317.2562,364670.012 566390.9417,364416.2918 566703.0192,364093.2596 567099.8621,363764.4439 567504.8288,363442.3323 567905.2947,363089.8027 568298.2606,362784.0449 568632.8607,362405.8138 569049.9381,362053.3844 569381.4592,361625.8337 569682.5378,361272.2827 569934.8816,360823.354 570211.9736,360375.3799 570475.7629,360330.6714 570382.9305)',32632)),4326)),
    area_sqm=642624.5217045197,
    original_area_text='26 of 570 coordinate-register rows used for geometry; 38 rows extracted',
    survey_reference='ZRW_1 coordinate register, geometry rows 1–26',
    summary='Federal S.I. No. 70 of 2019 defines the road right-of-way and supplies survey plans and a 570-beacon register. All 38 coordinates on register page 71 are retained as observations, but the check geometry uses only rows 1–26. Rows 27–38 contain computed/intersection beacons requiring plan-level topology review; rows 39–570 require page review.'
WHERE external_key='akwa-si70-ikot-ekpene-james-town-row-partial';

UPDATE intelligence.geometry_candidates gc
SET external_key='akwa-si70-zrw1-register-rows-001-026-partial',
    geometry=e.geometry,
    validation_status='valid',check_eligible=true
FROM intelligence.land_events e
WHERE gc.external_key='akwa-si70-zrw1-beacons-001-034-partial'
  AND e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial';

DELETE FROM intelligence.geometry_candidate_observations gco
USING intelligence.geometry_candidates gc,intelligence.numeric_observations no
WHERE gco.geometry_candidate_id=gc.id AND gco.numeric_observation_id=no.id
  AND gc.external_key='akwa-si70-zrw1-register-rows-001-026-partial'
  AND (no.normalized_values->>'sequence')::int>26;

UPDATE provenance.data_sources s
SET coverage_geometry=e.geometry,
    description='S.I. No. 70 of 2019. Current check coverage uses rows 1–26 of the 570-beacon register. Rows 27–38 are stored but excluded pending topology review; rows 39–570 await page review.',
    updated_at=now()
FROM intelligence.land_events e
WHERE s.name='Akwa Ibom federal highway statutory rights-of-way'
  AND e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial';

UPDATE zones.reserves z
SET osm_id='FHA-SI70-2019-ZRW1-PARTIAL-001-026',
    name='Ikot Ekpene–Uyo–Oron–James Town Road statutory ROW (partial rows 1–26)',
    geometry=e.geometry
FROM intelligence.land_events e
WHERE z.osm_id='FHA-SI70-2019-ZRW1-PARTIAL-001-038'
  AND e.external_key='akwa-si70-ikot-ekpene-james-town-row-partial';

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT id,'note','system:geometry-validation',
  'PostGIS detected a self-intersection when rows 27–38 were assembled by table order. Check geometry was narrowed to the valid rows 1–26; all 38 source observations remain preserved.',
  '{"postgisValidation":"Valid Geometry","geometryRows":26,"extractedRows":38,"topologyReviewPendingRows":[27,28,29,30,31,32,33,34,35,36,37,38],"documentRowsPending":"39-570"}'::jsonb
FROM intelligence.land_events
WHERE external_key='akwa-si70-ikot-ekpene-james-town-row-partial'
  AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=intelligence.land_events.id AND r.actor='system:geometry-validation');

-- Down Migration
-- Evidence correction is retained; do not reinstate a known-invalid geometry.
