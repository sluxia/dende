-- Up Migration

-- Phase two follows the government-mapped pass: official announcements and
-- independent reports are searchable context only. None supplies parcel
-- coordinates, so every event remains excluded from live spatial checks.

WITH docs(external_key,title,publisher,publisher_type,document_type,source_url,published_on,extraction_status,metadata) AS (VALUES
 ('akwa-tropicana-reclamation-82ha','Gov Eno Moves to Reclaim, Complete Ibom Tropicana Project','Akwa Ibom State Government','government','government_news','https://akwaibomstate.gov.ng/gov-eno-moves-to-reclaim-complete-inom-tropicana-project/',NULL,'extracted','{"areaHectares":82,"surveyPlanRequestedByGovernment":true,"geometryPublished":false}'::jsonb),
 ('akwa-anua-offot-revocation-2021','Land grabbing: Lawyer threatens suit against Akwa Ibom government','Punch Nigeria','independent','independent_report','https://punchng.com/land-grabbing-lawyer-threatens-suit-against-akwa-ibom-govt/','2022-06-06','extracted','{"reportedNotice":"Akwa Ibom State Notice No. 002/2021","surveyPlan":"AK/U 175","plots":"1-169 Block G","contested":true,"geometryPublished":false}'::jsonb),
 ('akwa-ekid-itam-industrial-revocation','Akwa Ibom Government announces revocation of undeveloped Industrial Park plots','Akwa Ibom State Ministry of Environment','government','government_news','https://me.akwaibomstate.gov.ng/2023/08/20/aibom-govt-set-to-construct-new-roads-erosion-control-projects/','2023-08-20','extracted','{"place":"Industrial Park at Ekid Itam 3","geometryPublished":false}'::jsonb),
 ('akwa-model-farm-50ha','Ibom Model Farm','Akwa Ibom State Agric Investment Directorate','government','government_news','https://agricinvestments.ak.gov.ng/project/ibom-model-farm/',NULL,'extracted','{"areaHectares":50,"donor":"Nsit Ubium Local Government Council","geometryPublished":false}'::jsonb),
 ('akwa-renewed-hope-additional-50ha','Akwa Ibom allocates additional 50 hectares for Renewed Hope Estate','Akwa Ibom State Government News','government','government_news','https://blog.akwaibomstate.gov.ng/wp-content/uploads/2025/11/ARISE-NEWS-WEEKLY-November7-2025-VOL_32-7.pdf','2025-11-07','extracted','{"areaHectares":50,"recipient":"Federal Ministry of Housing and Urban Development","geometryPublished":false,"sourceFormat":"pdf"}'::jsonb),
 ('akwa-public-acquisition-study','Analysis of Public Lands Acquisition in Akwa Ibom State, Nigeria','International Household Survey Network catalogue','independent','other','https://catalog.ihsn.org/citations/61060',NULL,'extracted','{"reportedPeriod":"1990-2005","reportedTotalHectares":10747.6,"aggregateOnly":true,"geometryPublished":false}'::jsonb)
)
INSERT INTO intelligence.documents(external_key,title,publisher,publisher_type,document_type,source_url,published_on,extraction_status,metadata)
SELECT external_key,title,publisher,publisher_type,document_type,source_url,published_on::date,extraction_status,metadata FROM docs
ON CONFLICT(external_key) DO NOTHING;

WITH events(external_key,event_type,headline,summary,effective_on,admin_level_2,locality,layout_name,plot_reference,survey_reference,area_sqm,original_area_text,evidence_tier,confidence) AS (VALUES
 ('akwa-tropicana-government-land-82ha','government_property','Government orders recovery of trespassed portions of 82-hectare Ibom Tropicana land','The state says the 82-hectare property was acquired for the Ibom Tropicana Entertainment Centre and directed the Lands Commissioner to produce its survey plan. The announcement does not publish that plan or coordinates.',NULL,'Uyo','Udo Udoma Avenue','Ibom Tropicana Entertainment Centre',NULL,NULL,820000::numeric,'82 hectares',2::smallint,0.98::numeric),
 ('akwa-anua-offot-block-g-revocation','revocation','Reported revocation of plots 1–169, Block G, Anua Offot government residential estate','Punch reports Akwa Ibom State Notice No. 002/2021 revoking rights over plots 1–169, Block G, for public purpose/rationalisation. A lawyer acting for claimed owners contested the action. Survey plan AK/U 175 is identified but not reproduced.',NULL,'Uyo','Anua Offot / Eniong Offot / Use Offor / Ifa Ikot Okpon','Government Residential Estate','Plots 1–169, Block G','AK/U 175',NULL,'169 plots; area not published',3::smallint,0.91::numeric),
 ('akwa-ekid-itam-3-industrial-revocation','revocation','Undeveloped land rights reportedly revoked at Ekid Itam 3 Industrial Park','An official ministry report says rights of occupancy for undeveloped industrial-park lands allocated around 2015 were revoked, with proposals required before fresh assignments. No affected-plot schedule or geometry is published.','2023-08-20','Itu','Ekid Itam 3','Industrial Park',NULL,NULL,NULL,'affected area not published',2::smallint,0.96::numeric),
 ('akwa-nsit-ubium-model-farm-50ha','allocation','Nsit Ubium donates 50 hectares for Ibom Model Farm','The state agriculture investment portal reports delivery of a 50-hectare parcel donated by Nsit Ubium Local Government Council for an integrated model farm. No parcel plan is published.',NULL,'Nsit Ubium',NULL,'Ibom Model Farm',NULL,NULL,500000::numeric,'50 hectares',2::smallint,0.97::numeric),
 ('akwa-renewed-hope-estate-additional-50ha','allocation','Additional 50 hectares allocated for expansion of Renewed Hope Estate','The state government weekly publication reports an additional allocation to the Federal Ministry of Housing and Urban Development. The article names the programme but provides no boundary plan or coordinates.','2025-11-07',NULL,NULL,'Renewed Hope Estate',NULL,NULL,500000::numeric,'additional 50 hectares',2::smallint,0.96::numeric),
 ('akwa-public-acquisitions-1990-2005','acquisition','Study reports 10,747.6 hectares of public-land acquisition from 1990 to 2005','A research catalogue reports the aggregate area acquired by the state during 1990–2005. This is useful for discovery and reconciliation, but the aggregate cannot identify any parcel and is not check evidence.',NULL,NULL,NULL,NULL,NULL,NULL,107476000::numeric,'10,747.6 hectares aggregate',4::smallint,0.82::numeric)
)
INSERT INTO intelligence.land_events(external_key,event_type,headline,summary,effective_on,country_code,admin_level_1,admin_level_2,locality,layout_name,plot_reference,survey_reference,area_sqm,original_area_text,geometry_status,extraction_confidence,evidence_tier,review_status,search_status,check_status)
SELECT external_key,event_type,headline,summary,effective_on::date,'NG','Akwa Ibom',admin_level_2,locality,layout_name,plot_reference,survey_reference,area_sqm,original_area_text,'unavailable',confidence,evidence_tier,'accepted','searchable','excluded'
FROM events ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports',x.locator,x.excerpt
FROM (VALUES
 ('akwa-tropicana-government-land-82ha','akwa-tropicana-reclamation-82ha','article','Government identifies 82 hectares and requests the survey plan; no geometry is published.'),
 ('akwa-anua-offot-block-g-revocation','akwa-anua-offot-revocation-2021','reported Akwa Ibom State Notice No. 002/2021','Report identifies plots 1–169, Block G and survey plan AK/U 175; the revocation is contested.'),
 ('akwa-ekid-itam-3-industrial-revocation','akwa-ekid-itam-industrial-revocation','official project announcement','Government reports revocation of undeveloped industrial-park rights.'),
 ('akwa-nsit-ubium-model-farm-50ha','akwa-model-farm-50ha','project page','Official portal reports delivery of a 50-hectare donated parcel.'),
 ('akwa-renewed-hope-estate-additional-50ha','akwa-renewed-hope-additional-50ha','ARISE News Weekly, 7 November 2025','Government publication reports an additional 50-hectare allocation.'),
 ('akwa-public-acquisitions-1990-2005','akwa-public-acquisition-study','catalogue abstract','Study reports 10,747.6 hectares acquired during 1990–2005 in aggregate.')
) x(event_key,document_key,locator,excerpt)
JOIN intelligence.land_events e ON e.external_key=x.event_key
JOIN intelligence.documents d ON d.external_key=x.document_key
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.document_assets(document_id,external_key,discovered_from_url,file_url,filename,format_family,file_extension,media_type,acquisition_status,extraction_status,metadata)
SELECT d.id,'akwa-renewed-hope-additional-50ha-pdf',d.source_url,d.source_url,
  'ARISE-NEWS-WEEKLY-November7-2025-VOL_32-7.pdf','pdf','pdf','application/pdf','discovered','pending',
  '{"numericTargets":["additional 50 hectares"],"coordinateSearch":true,"checkEligible":false}'::jsonb
FROM intelligence.documents d WHERE d.external_key='akwa-renewed-hope-additional-50ha'
ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:akwa-general-evidence-pass',
  'Searchable contextual evidence accepted after government-mapped discovery; no parcel coordinates or boundary geometry were published.',
  jsonb_build_object('searchStatus','searchable','checkStatus','excluded','geometryStatus','unavailable')
FROM intelligence.land_events e
WHERE e.external_key IN (
 'akwa-tropicana-government-land-82ha','akwa-anua-offot-block-g-revocation',
 'akwa-ekid-itam-3-industrial-revocation','akwa-nsit-ubium-model-farm-50ha',
 'akwa-renewed-hope-estate-additional-50ha','akwa-public-acquisitions-1990-2005')
AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id);

-- Down Migration
-- Append-only evidence intentionally has no destructive rollback.
