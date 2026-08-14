-- Up Migration

-- Kwa Falls is a shared place-name for distinct interests. Never merge the
-- tourism compound, natural watercourse, historic plantation or irrigation
-- scheme into one spatial feature.

WITH docs(external_key,title,publisher,publisher_type,document_type,source_url,published_on,mime,status,metadata) AS (VALUES
  ('crs-kwa-falls-facts-and-figures','Cross River State Facts and Figures - Kwa Falls coordinate entry','Cross River State Bureau of Statistics','government','statistical_report','https://crossriverstate.gov.ng/download/Bureau%20of%20Statistics/formatted%20Personal%20F%26F%20FINAL%20PRINT-1.pdf',NULL,'application/pdf','extracted','{"publishedLabels":{"longitude":"05 08 26.06","latitude":"008 30 34.8"},"interpretedPoint":{"latitude":5.140572,"longitude":8.509667},"qualityWarning":"The published latitude and longitude labels appear transposed; this is a representative point, not boundary geometry."}'::jsonb),
  ('crs-kwa-falls-tourism-inspection-2026','Tourism Ministry Inspects Kwa Falls, Engages Traditional Rulers In Aningeje','Cross River State Government News','government','government_news','https://news.crossriverstate.gov.ng/tourism-ministry-inspects-kwa-falls-engages-traditional-rulers-in-aningeje/',DATE '2026-06-18','text/html','extracted','{"hostCommunity":"Aningeje","traditionalArea":"Ojuk North","finding":"State ministry inspected the eco-tourism site; no site plan or perimeter was attached."}'::jsonb),
  ('crs-kwa-falls-oil-palm-background-review','Oil palm plantations in forest - Cross River State background review','Tropenbos International','independent','independent_report','https://www.tropenbos.org/app/data/uploads/sites/2/Nigeria_Oil_Palm_Background_Review-final-1.pdf',NULL,'application/pdf','extracted','{"estate":"Kwa Falls","established":1947,"grossAreaHa":2826,"plantedAreaAtAcquisitionHa":1877,"crop":"oil palm","investor":"Obasanjo Farms","privatizationYear":2003,"geometryAvailable":false}'::jsonb),
  ('wilmar-kwa-falls-estate-2018','Partnering with Nigeria to develop a best-in-class palm oil industry - field update','Wilmar International','independent','independent_report','https://blog.palmoil.io/content/files/docs/default-source/default-document-library/sustainability/resource/sustainability-brief-partnering-with-nigeria-to-develop-a-best-in-class-palm-oil-industry.pdf',DATE '2018-05-01','application/pdf','extracted','{"finding":"Eyop Industries acquired former Obasanjo Farms assets including Kwa Falls Estate and commenced replanting Kwa Falls.","geometryAvailable":false}'::jsonb),
  ('ng-2016-kwa-falls-irrigation-budget','2016 Federal Capital Budget - Kwa Falls Irrigation Project','Federal Republic of Nigeria','government','budget','https://csj-ng.org/wp-content/uploads/2018/06/2016-SOUTH-SOUTH-CAPITAL-BUDGET-PULLOUT.pdf',DATE '2016-01-01','application/pdf','extracted','{"projectCode":"CRBDA05017971","project":"Kwa Falls Irrigation Project, CRS","allocationNgn":44432917,"implementingAuthority":"Cross River Basin Development Authority","geometryAvailable":false}'::jsonb)
)
INSERT INTO intelligence.documents(external_key,title,publisher,publisher_type,document_type,source_url,published_on,mime_type,extraction_status,metadata)
SELECT external_key,title,publisher,publisher_type,document_type,source_url,published_on,mime,status,metadata FROM docs
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.land_events(
  external_key,event_type,headline,summary,effective_on,country_code,admin_level_1,admin_level_2,locality,layout_name,
  area_sqm,original_area_text,geometry_status,extraction_confidence,evidence_tier,review_status,search_status,check_status
) VALUES
 ('crs-kwa-falls-tourism-site','government_property','Cross River records Kwa Falls as an eco-tourism site at Aningeje','Official state records identify the Kwa Falls tourism site at Aningeje. A state coordinate register supports a representative point near 5.140572 N, 8.509667 E after correcting apparently transposed coordinate labels. It is not a surveyed perimeter and is excluded from spatial checks.',DATE '2026-06-18','NG','Cross River','Akamkpa','Aningeje','Kwa Falls Tourism Site',NULL,NULL,'unavailable',0.97,1,'accepted','searchable','excluded'),
 ('crs-kwa-falls-river-corridor','other','Kwa Falls waterfall, gorge and Great Kwa River corridor require independent mapping','The waterfall, river channel, gorge and any legally applicable riparian or conservation limits are distinct from the tourism compound. No authoritative watercourse, setback or conservation polygon has been acquired.',NULL,'NG','Cross River','Akamkpa','Aningeje','Kwa Falls / Great Kwa River corridor',NULL,NULL,'unavailable',0.85,2,'accepted','searchable','excluded'),
 ('crs-kwa-falls-oil-palm-estate','government_property','Historic Kwa Falls Oil Palm Estate recorded in Akamkpa','A historical review records a 2,826-hectare gross estate, established in 1947, with 1,877 hectares planted at acquisition. Later publications conflict on its area. No reported figure is treated as geometry.',DATE '1947-01-01','NG','Cross River','Akamkpa','Kwa Falls Estate','Kwa Falls Oil Palm Estate',28260000,'2,826 hectares gross; 1,877 hectares planted at acquisition; other publications conflict','unavailable',0.93,3,'accepted','searchable','excluded'),
 ('ng-kwa-falls-irrigation-project','government_property','Federal budget records the Kwa Falls Irrigation Project','The federal capital budget identifies a Cross River Basin Development Authority irrigation project at Kwa Falls. Its intake, command area, canals, access land and acquired-land perimeter have not been published in the material reviewed.',DATE '2016-01-01','NG','Cross River','Akamkpa','Kwa Falls / Aningeje','Kwa Falls Irrigation Project',NULL,NULL,'unavailable',0.99,1,'accepted','searchable','excluded')
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,x.role,x.locator,x.excerpt
FROM (VALUES
 ('crs-kwa-falls-tourism-site','crs-kwa-falls-facts-and-figures','supports','Kwa Falls tourism-site register entry','The coordinate labels appear transposed and are retained with a quality warning.'),
 ('crs-kwa-falls-tourism-site','crs-kwa-falls-tourism-inspection-2026','supports','Inspection report','The state ministry identifies Kwa Falls as an eco-tourism site in Aningeje.'),
 ('crs-kwa-falls-river-corridor','crs-kwa-falls-tourism-inspection-2026','context','Inspection report','The named natural feature is associated with the tourism site, but no legal buffer or watercourse polygon is supplied.'),
 ('crs-kwa-falls-oil-palm-estate','crs-kwa-falls-oil-palm-background-review','supports','Privatization table - Kwa Falls row','The review records establishment, gross area, planted area, crop, investor and privatization year.'),
 ('crs-kwa-falls-oil-palm-estate','wilmar-kwa-falls-estate-2018','supports','Eyop Industries section','The report identifies Kwa Falls Estate among assets acquired by Eyop Industries and says replanting commenced.'),
 ('ng-kwa-falls-irrigation-project','ng-2016-kwa-falls-irrigation-budget','supports','Project CRBDA05017971','The budget records the Kwa Falls Irrigation Project and allocation.')
) x(event_key,document_key,role,locator,excerpt)
JOIN intelligence.land_events e ON e.external_key=x.event_key
JOIN intelligence.documents d ON d.external_key=x.document_key
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:spatial-research','User-approved Kwa Falls evidence bundle; searchable context only, with all spatial checks withheld.',
       jsonb_build_object('reviewStatus',e.review_status,'searchStatus',e.search_status,'checkStatus',e.check_status,'geometryStatus',e.geometry_status)
FROM intelligence.land_events e
WHERE e.external_key IN ('crs-kwa-falls-tourism-site','crs-kwa-falls-river-corridor','crs-kwa-falls-oil-palm-estate','ng-kwa-falls-irrigation-project')
  AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id AND r.event_type='accepted');

-- Correct the original combined inventory entry so it represents only the
-- tourism property. The other interests are separate inventory records.
UPDATE provenance.spatial_asset_inventory
SET asset_name='Kwa Falls Tourism Site',alternate_names=ARRAY['Kwa Waterfalls Tourism Site','Kwa Falls Eco-tourism Site'],asset_class='government_estate',
    authority_name='Cross River State Ministry of Tourism, Arts and Culture',admin_level_2='Akamkpa',locality='Aningeje',legal_status='reported',
    source_url='https://news.crossriverstate.gov.ng/tourism-ministry-inspects-kwa-falls-engages-traditional-rulers-in-aningeje/',geometry_status='located',check_status='excluded',acquisition_status='source_found',
    missing_material='Tourism-site title or acquisition schedule, surveyed perimeter, access plan and relationship to the waterfall and river corridor.',
    next_action='Request the site plan from Tourism and Lands; use the corrected state-register point only to locate candidate plans, never as a boundary.',
    evidence_notes='Official records locate the site at Aningeje. Published coordinate labels appear transposed; interpreted representative point is approximately 5.140572 N, 8.509667 E. No polygon has been accepted.',
    processing_status='geometry_found',updated_at=now()
WHERE external_key='crs-asset-kwa-falls';

WITH assets(external_key,asset_name,alternate_names,asset_class,authority_name,legal_status,stated_area_sqm,source_url,missing_material,next_action,evidence_notes,risk_reason) AS (VALUES
 ('crs-asset-kwa-falls-river-corridor','Kwa Falls waterfall and Great Kwa River corridor',ARRAY['Kwa Falls gorge','Great Kwa River at Aningeje'],'waterway_buffer','Cross River State water, environment, forestry and tourism authorities','reported',NULL,'https://news.crossriverstate.gov.ng/tourism-ministry-inspects-kwa-falls-engages-traditional-rulers-in-aningeje/','Authoritative river centreline/banks, waterfall and gorge limits, applicable setback instrument, conservation boundary and access ROW.','Acquire hydrographic and cadastral material; model each legally supported restriction separately and prohibit an invented circular buffer.','Natural-feature extent is not equivalent to the tourism compound. No watercourse or buffer geometry has been accepted.','River-edge and gorge-adjacent plots may carry restrictions invisible in ordinary title descriptions.'),
 ('crs-asset-kwa-falls-oil-palm-estate','Kwa Falls Oil Palm Estate',ARRAY['Kwa Falls Plantation','Kwa Falls Estate'],'agricultural_scheme','Cross River State Government / historic and successor estate operators','acquired',28260000,'https://www.tropenbos.org/app/data/uploads/sites/2/Nigeria_Oil_Palm_Background_Review-final-1.pdf','Original establishment plan, privatization/acquisition schedule, title and current operative survey perimeter; reconciliation of conflicting 2,014, 2,826 and 12,805 hectare reports.','Obtain the Forestry/Lands estate survey and transaction schedules; preserve original estate, planted area and later holdings as separate extents where necessary.','Review records 2,826 hectares gross and 1,877 hectares planted at acquisition. Conflicting later area reports are quarantined and no area figure is geometry.','A large historic estate with ownership transitions and disputed published size creates high fraudulent-sale and edge-encroachment exposure.'),
 ('crs-asset-kwa-falls-irrigation-project','Kwa Falls Irrigation Project',ARRAY['CRBDA Kwa Falls Irrigation Scheme'],'agricultural_scheme','Cross River Basin Development Authority','reported',NULL,'https://csj-ng.org/wp-content/uploads/2018/06/2016-SOUTH-SOUTH-CAPITAL-BUDGET-PULLOUT.pdf','Feasibility/EIA, intake and canal designs, command-area map, acquired-land schedule, survey plans and as-built records.','Request project files from CRBDA/Federal Ministry of Water Resources and distinguish infrastructure ROW from participating farmland.','Federal budgets confirm the project but do not expose its footprint. A budget line is not proof of land ownership or geometry.','Irrigation infrastructure and command areas can create multiple overlapping land restrictions that are otherwise hard for buyers to discover.')
)
INSERT INTO provenance.spatial_asset_inventory(
 campaign_id,external_key,asset_name,alternate_names,asset_class,authority_name,country_code,admin_level_1,admin_level_2,locality,legal_status,stated_area_sqm,source_url,
 geometry_status,check_status,acquisition_status,missing_material,next_action,evidence_notes,risk_priority,risk_reason,processing_status,visibility
)
SELECT c.id,a.external_key,a.asset_name,a.alternate_names,a.asset_class,a.authority_name,'NG','Cross River','Akamkpa','Aningeje',a.legal_status,a.stated_area_sqm,a.source_url,
       'unavailable','excluded','source_found',a.missing_material,a.next_action,a.evidence_notes,1,a.risk_reason,'researching','public'
FROM assets a JOIN provenance.spatial_acquisition_campaigns c ON c.external_key='ng-cross-river-spatial-rerun-v1'
ON CONFLICT(external_key) DO NOTHING;

UPDATE provenance.spatial_acquisition_campaigns
SET notes='Single-subject validation continues. Kwa Falls approved as four independent records: tourism site, watercourse/gorge, historic oil-palm estate and federal irrigation project. All remain excluded from checks pending authoritative geometry.'
WHERE external_key='ng-cross-river-spatial-rerun-v1';

-- Down Migration
DELETE FROM provenance.spatial_asset_inventory WHERE external_key IN ('crs-asset-kwa-falls-river-corridor','crs-asset-kwa-falls-oil-palm-estate','crs-asset-kwa-falls-irrigation-project');
UPDATE provenance.spatial_asset_inventory SET asset_name='Kwa Falls tourism and conservation compound',alternate_names=ARRAY['Kwa Waterfalls','Kwa Falls'],asset_class='conservation_area',authority_name='Cross River State Government',locality='Kwa Falls',geometry_status='unavailable',acquisition_status='source_found',processing_status='queued',updated_at=now() WHERE external_key='crs-asset-kwa-falls';
-- Intelligence evidence remains append-only by design.
