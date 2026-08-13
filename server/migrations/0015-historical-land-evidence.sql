-- Up Migration

CREATE SCHEMA IF NOT EXISTS intelligence;

CREATE TABLE intelligence.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  title text NOT NULL,
  publisher text NOT NULL,
  publisher_type text NOT NULL CHECK (publisher_type IN ('legal_authority','government','court','independent','unknown')),
  document_type text NOT NULL CHECK (document_type IN ('gazette','legal_instrument','official_notice','approved_list','court_decision','budget','statistical_report','government_news','independent_report','other')),
  source_url text NOT NULL,
  canonical_url text,
  published_on date,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  content_checksum text,
  archived_uri text,
  mime_type text,
  original_language text NOT NULL DEFAULT 'en-NG',
  extraction_status text NOT NULL DEFAULT 'discovered' CHECK (extraction_status IN ('discovered','archived','extracted','failed')),
  raw_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intelligence.land_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type IN ('allocation','acquisition','compensation','revocation','release','return','layout','title_notice','survey_approval','reserve_declaration','road_corridor','planning_change','court_decision','demolition','encroachment','dispute','public_warning','government_property','other')),
  headline text NOT NULL,
  summary text NOT NULL,
  effective_on date,
  country_code char(2) NOT NULL DEFAULT 'NG',
  admin_level_1 text,
  admin_level_2 text,
  locality text,
  layout_name text,
  plot_reference text,
  survey_reference text,
  title_reference text,
  court_reference text,
  area_sqm numeric,
  original_area_text text,
  geometry geometry(MultiPolygon, 4326),
  geometry_status text NOT NULL DEFAULT 'unavailable' CHECK (geometry_status IN ('unavailable','approximate','derived','authoritative')),
  extraction_confidence numeric NOT NULL DEFAULT 0 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  evidence_tier smallint NOT NULL CHECK (evidence_tier BETWEEN 1 AND 5),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed','in_review','accepted','rejected','needs_more_evidence')),
  search_status text NOT NULL DEFAULT 'withheld' CHECK (search_status IN ('withheld','searchable')),
  check_status text NOT NULL DEFAULT 'excluded' CHECK (check_status IN ('excluded','eligible')),
  sensitivity text NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','limited','restricted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_status = 'excluded' OR (review_status = 'accepted' AND geometry_status IN ('derived','authoritative') AND evidence_tier <= 2)),
  CHECK (search_status = 'withheld' OR review_status = 'accepted')
);
CREATE INDEX land_events_geo_idx ON intelligence.land_events(country_code, admin_level_1, admin_level_2, event_type);
CREATE INDEX land_events_geometry_gix ON intelligence.land_events USING GIST(geometry);

CREATE TABLE intelligence.event_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  document_id uuid NOT NULL REFERENCES intelligence.documents(id) ON DELETE RESTRICT,
  evidence_role text NOT NULL DEFAULT 'supports' CHECK (evidence_role IN ('supports','contradicts','supersedes','context')),
  locator text,
  supporting_excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, document_id, evidence_role, locator)
);

CREATE TABLE intelligence.event_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  party_name text NOT NULL,
  party_type text NOT NULL CHECK (party_type IN ('government','community','organization','person','court','unknown')),
  role text NOT NULL,
  display_status text NOT NULL DEFAULT 'public' CHECK (display_status IN ('public','redacted','restricted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE intelligence.event_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_event_id uuid NOT NULL REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  to_event_id uuid NOT NULL REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  relation_type text NOT NULL CHECK (relation_type IN ('supersedes','corrects','contradicts','implements','relates_to')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_event_id, to_event_id, relation_type),
  CHECK (from_event_id <> to_event_id)
);

CREATE TABLE intelligence.review_events (
  id bigserial PRIMARY KEY,
  land_event_id uuid NOT NULL REFERENCES intelligence.land_events(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('discovered','extracted','review_started','accepted','rejected','evidence_requested','search_enabled','check_enabled','check_disabled','note')),
  actor text NOT NULL,
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX intelligence_review_events_idx ON intelligence.review_events(land_event_id, created_at, id);

CREATE FUNCTION intelligence.reject_immutable_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END; $$;
CREATE TRIGGER documents_no_update BEFORE UPDATE OR DELETE ON intelligence.documents
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();
CREATE TRIGGER event_evidence_no_update BEFORE UPDATE OR DELETE ON intelligence.event_evidence
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();
CREATE TRIGGER review_events_no_update BEFORE UPDATE OR DELETE ON intelligence.review_events
  FOR EACH ROW EXECUTE FUNCTION intelligence.reject_immutable_evidence_mutation();

WITH docs(external_key,title,publisher,publisher_type,document_type,source_url,published_on,extraction_status,metadata) AS (
 VALUES
 ('crs-mol-land-department','Cross River Ministry of Lands — Land Department','Cross River State Ministry of Lands','government','official_notice','https://mol.crossriverstate.gov.ng/organisation-structure/land-department',NULL,'extracted','{"discovery":"official website","scope":"acquisition and land-record process"}'::jsonb),
 ('crs-mol-allocation','Cross River Ministry of Lands — Land Use Allocation','Cross River State Ministry of Lands','government','official_notice','https://mol.crossriverstate.gov.ng/organisation-structure/land-use-allocation',NULL,'extracted','{"discovery":"official website","scope":"allocation and C-of-O process"}'::jsonb),
 ('crs-stat-yearbook-2024','Cross River State Statistical Year Book 2024','Cross River State Bureau of Statistics','government','statistical_report','https://www.crossriverstate.gov.ng/download/Bureau%20of%20Statistics/STATISTICAL%20YEAR%20BOOK%202024%20EDITION.pdf','2025-01-01','extracted','{"tables":["27.5","27.6","27.7","27.8","27.9","27.10","27.11","27.12"]}'::jsonb),
 ('crs-summit-hills-return-23ha','CRSG Hands Over 23 Hectares of Land at Summit Hills to Nkonib Community','Cross River State Government News','government','government_news','https://news.crossriverstate.gov.ng/crsg-hands-over-23-hectares-of-land-at-summit-hills-to-nkonib-community/','2024-11-12','extracted','{"courtReference":"HC/314/2021"}'::jsonb),
 ('crs-revised-budget-2025','Cross River State 2025 Revised Budget','Cross River State Government','government','budget','https://www.crossriverstate.gov.ng/download/Budget/CROSS%20RIVER%20STATE%202025%20REVISED%20BUDGET.pdf','2025-01-01','extracted','{"scope":"land acquisition, compensation, survey and allocation programmes"}'::jsonb)
)
INSERT INTO intelligence.documents(external_key,title,publisher,publisher_type,document_type,source_url,published_on,extraction_status,metadata)
SELECT external_key,title,publisher,publisher_type,document_type,source_url,published_on::date,extraction_status,metadata FROM docs ON CONFLICT(external_key) DO NOTHING;

WITH events(external_key,event_type,headline,summary,effective_on,admin_level_1,admin_level_2,locality,layout_name,court_reference,area_sqm,original_area_text,evidence_tier,extraction_confidence) AS (
 VALUES
 ('crs-summit-hills-nkonib-return','return','23 hectares at Summit Hills returned to Nkonib community','Cross River State reported handing over an approved layout plan for land released following litigation involving the state and community claimants.','2024-11-12','Cross River','Calabar Municipal','Summit Hills','Summit Hills','HC/314/2021',230000::numeric,'23 hectares',3::smallint,0.90::numeric),
 ('crs-acquisition-publication-process','acquisition','Cross River acquisition notices are published as part of the state process','The Ministry of Lands describes publication of an acquisition notice after identification, negotiation and survey, followed by valuation and compensation. This is a process fact, not a specific parcel acquisition.',NULL,'Cross River',NULL,NULL,NULL,NULL,NULL,NULL,2::smallint,0.98::numeric),
 ('crs-cofo-objection-publication-process','title_notice','C-of-O applicant lists are published for a 28-day objection period','The Land Use Allocation Department describes collation and publication of applicant lists before inspection and approval. This is a process fact, not an identified title grant.',NULL,'Cross River',NULL,NULL,NULL,NULL,NULL,NULL,2::smallint,0.98::numeric),
 ('crs-2025-land-acquisition-programme','acquisition','2025 budget provides for state-wide land acquisition and compensation','The revised budget records programmes for acquisition and compensation, acquired-land clearing, survey and parcelation. It does not identify affected parcel geometry.','2025-01-01','Cross River',NULL,NULL,NULL,NULL,NULL,NULL,3::smallint,0.96::numeric)
)
INSERT INTO intelligence.land_events(external_key,event_type,headline,summary,effective_on,admin_level_1,admin_level_2,locality,layout_name,court_reference,area_sqm,original_area_text,evidence_tier,extraction_confidence,review_status,search_status)
SELECT external_key,event_type,headline,summary,effective_on::date,admin_level_1,admin_level_2,locality,layout_name,court_reference,area_sqm,original_area_text,evidence_tier,extraction_confidence,'accepted','searchable'
FROM events ON CONFLICT(external_key) DO NOTHING;

INSERT INTO intelligence.event_evidence(event_id,document_id,evidence_role,locator,supporting_excerpt)
SELECT e.id,d.id,'supports',x.locator,x.excerpt
FROM (VALUES
 ('crs-summit-hills-nkonib-return','crs-summit-hills-return-23ha','article','Government reported release of 23 hectares and delivery of an approved layout plan.'),
 ('crs-acquisition-publication-process','crs-mol-land-department','Acquisition and Compensation for Land','Acquisition notice is published after identification, negotiation and survey.'),
 ('crs-cofo-objection-publication-process','crs-mol-allocation','Certificate of Occupancy','Applicant list is published for 28 days before further processing.'),
 ('crs-2025-land-acquisition-programme','crs-revised-budget-2025','Ministry of Lands programmes','Budget includes acquisition, compensation, clearing and survey of acquired land.')
) x(event_key,document_key,locator,excerpt)
JOIN intelligence.land_events e ON e.external_key=x.event_key
JOIN intelligence.documents d ON d.external_key=x.document_key
ON CONFLICT DO NOTHING;

INSERT INTO intelligence.review_events(land_event_id,event_type,actor,reason,snapshot)
SELECT e.id,'accepted','system:migration','Cross River pilot seed reviewed from official public source',
 jsonb_build_object('reviewStatus',e.review_status,'searchStatus',e.search_status,'checkStatus',e.check_status,'evidenceTier',e.evidence_tier,'geometryStatus',e.geometry_status)
FROM intelligence.land_events e
WHERE e.external_key LIKE 'crs-%' AND NOT EXISTS(SELECT 1 FROM intelligence.review_events r WHERE r.land_event_id=e.id);

-- Down Migration
DROP TRIGGER review_events_no_update ON intelligence.review_events;
DROP TRIGGER event_evidence_no_update ON intelligence.event_evidence;
DROP TRIGGER documents_no_update ON intelligence.documents;
DROP FUNCTION intelligence.reject_immutable_evidence_mutation();
DROP TABLE intelligence.review_events;
DROP TABLE intelligence.event_relations;
DROP TABLE intelligence.event_parties;
DROP TABLE intelligence.event_evidence;
DROP TABLE intelligence.land_events;
DROP TABLE intelligence.documents;
DROP SCHEMA intelligence;
