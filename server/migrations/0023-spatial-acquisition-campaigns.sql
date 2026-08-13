-- Up Migration

CREATE TABLE provenance.spatial_acquisition_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  country_code char(2) NOT NULL,
  admin_level_1 text,
  scope text NOT NULL CHECK (scope IN ('state','national')),
  procedure_version text NOT NULL,
  sequence_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','inventory','acquiring','validating','complete','paused')),
  current_stage text NOT NULL CHECK (current_stage IN ('government_inventory','authoritative_sources','geometry_acquisition','validation','activation','media_discovery','reconciliation')),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provenance.spatial_asset_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES provenance.spatial_acquisition_campaigns(id) ON DELETE RESTRICT,
  external_key text NOT NULL UNIQUE,
  asset_name text NOT NULL,
  alternate_names text[] NOT NULL DEFAULT '{}',
  asset_class text NOT NULL CHECK (asset_class IN (
    'forest_reserve','national_park','conservation_area','wetland','waterway_buffer',
    'government_layout','government_estate','industrial_area','agricultural_scheme',
    'public_institution','transport_right_of_way','utility_right_of_way','planning_zone',
    'strategic_land','acquired_land','revoked_land','cadastral_block','other'
  )),
  authority_name text,
  country_code char(2) NOT NULL,
  admin_level_1 text,
  admin_level_2 text,
  locality text,
  legal_status text NOT NULL DEFAULT 'reported' CHECK (legal_status IN ('reported','declared','gazetted','acquired','revoked','superseded','unknown')),
  instrument_reference text,
  survey_reference text,
  stated_area_sqm numeric,
  source_url text,
  file_url text,
  geometry_status text NOT NULL DEFAULT 'unavailable' CHECK (geometry_status IN ('unavailable','located','extracting','candidate','valid','rejected')),
  check_status text NOT NULL DEFAULT 'excluded' CHECK (check_status IN ('excluded','eligible')),
  acquisition_status text NOT NULL DEFAULT 'not_started' CHECK (acquisition_status IN ('not_started','source_found','file_found','downloaded','access_required','under_review','complete','blocked')),
  missing_material text,
  next_action text,
  evidence_notes text,
  geometry geometry(MultiPolygon,4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_status='excluded' OR (geometry_status='valid' AND geometry IS NOT NULL))
);
CREATE INDEX spatial_asset_campaign_idx ON provenance.spatial_asset_inventory(campaign_id,asset_class,geometry_status);
CREATE INDEX spatial_asset_location_idx ON provenance.spatial_asset_inventory(country_code,admin_level_1,admin_level_2);
CREATE INDEX spatial_asset_geometry_gix ON provenance.spatial_asset_inventory USING GIST(geometry);

INSERT INTO provenance.spatial_acquisition_campaigns(external_key,country_code,admin_level_1,scope,procedure_version,sequence_number,status,current_stage,started_at,notes) VALUES
 ('ng-cross-river-spatial-rerun-v1','NG','Cross River','state','1.0',1,'inventory','government_inventory',now(),'Full restart. Government spatial assets and boundary evidence precede media discovery.'),
 ('ng-akwa-ibom-spatial-rerun-v1','NG','Akwa Ibom','state','1.0',2,'queued','government_inventory',NULL,'Starts after the Cross River rerun inventory and acquisition pass.'),
 ('ng-national-spatial-assets-v1','NG',NULL,'national','1.0',3,'queued','government_inventory',NULL,'Federal/national asset campaign starts after both pilot-state reruns.')
ON CONFLICT(external_key) DO NOTHING;

WITH assets(external_key,asset_name,alternate_names,asset_class,authority_name,admin_level_2,legal_status,source_url,acquisition_status,missing_material,next_action,evidence_notes) AS (VALUES
 ('crs-asset-afi-river-fr','Afi River Forest Reserve',ARRAY['Afi River FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument, beacon schedule and authoritative boundary file','Locate constituting gazette/working plan; inspect map supplements and protected-area GIS polygons','Named as FR1 in a mapped thirteen-unit Cross River protected-area study.'),
 ('crs-asset-agoi-fr','Agoi Forest Reserve',ARRAY['Agoi FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument, beacon schedule and authoritative boundary file','Locate constituting gazette/working plan and compare available mapped datasets','Named as FR2.'),
 ('crs-asset-boshi-fr','Boshi Forest Reserve',ARRAY['Boshi FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument, beacon schedule and authoritative boundary file','Locate constituting gazette/working plan and compare available mapped datasets','Named as FR3.'),
 ('crs-asset-boshi-extension-fr','Boshi Extension Forest Reserve',ARRAY['Boshi extension','Boshi Extension FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument defining extension and authoritative boundary','Search gazette separately from the original Boshi reserve and test topology relationship','Named as FR4; must not be merged with Boshi without legal boundary evidence.'),
 ('crs-asset-cross-river-north-fr','Cross River North Forest Reserve',ARRAY['Cross River North FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette limits, beacon schedule and authoritative boundary file','Locate constituting instrument and forest inventory/working plan','Named as FR5.'),
 ('crs-asset-cross-river-south-fr','Cross River South Forest Reserve',ARRAY['Cross River South FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette limits, beacon schedule and authoritative boundary file','Locate constituting instrument and forest inventory/working plan','Named as FR6.'),
 ('crs-asset-ekinta-fr','Ekinta Forest Reserve',ARRAY['Ekinta FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument and authoritative boundary file','Locate constituting gazette and inspect state/REDD+ map sources','Named as FR7.'),
 ('crs-asset-lower-enyong-fr','Lower Enyong Forest Reserve',ARRAY['Lower Enyon Forest Reserve','Lower Enyon FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Canonical spelling, gazette instrument and authoritative boundary','Reconcile Enyon/Enyong naming against gazette and GIS attributes','Named as FR8 in source text as Lower Enyon.'),
 ('crs-asset-crnp-oban','Cross River National Park — Oban Division',ARRAY['CRNP Oban Block','Oban Division','Oban Hills'],'national_park','Nigeria National Park Service',NULL,'declared','https://rris.biopama.org/pa/40925?language=en','source_found','Current authoritative/licensed polygon and establishment instrument','Acquire WDPA/BIOPAMA polygon and validate it against federal instrument and park maps','Named as FR9; a specific protected-area record and likely polygon source have been located.'),
 ('crs-asset-crnp-okwangwo','Cross River National Park — Okwangwo Division',ARRAY['CRNP Okwangwo','Okwangwo Division'],'national_park','Nigeria National Park Service',NULL,'declared','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Current authoritative/licensed polygon and establishment instrument','Identify division-specific WDPA feature and validate against federal instrument and park maps','Named as FR10; must remain separate from non-contiguous Oban Division.'),
 ('crs-asset-ukpon-river-fr','Ukpon River Forest Reserve',ARRAY['Ukpon River FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument, beacon schedule and authoritative boundary','Locate constituting gazette and mapped forest datasets','Named as FR11.'),
 ('crs-asset-umon-ndealichi-fr','Umon Ndealichi Forest Reserve',ARRAY['Umon Ndealichi FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Canonical spelling, gazette instrument and boundary','Reconcile name against gazette and locate mapped source','Named as FR12.'),
 ('crs-asset-uwet-odot-fr','Uwet Odot Forest Reserve',ARRAY['Uwet Odot FR'],'forest_reserve','Cross River State Forestry Commission',NULL,'reported','https://www.scirp.org/pdf/GEP_2015090114435744.pdf','source_found','Gazette instrument, beacon schedule and authoritative boundary','Locate constituting gazette and mapped forest datasets','Named as FR13.')
)
INSERT INTO provenance.spatial_asset_inventory(
 campaign_id,external_key,asset_name,alternate_names,asset_class,authority_name,country_code,admin_level_1,admin_level_2,
 legal_status,source_url,acquisition_status,missing_material,next_action,evidence_notes
)
SELECT c.id,a.external_key,a.asset_name,a.alternate_names,a.asset_class,a.authority_name,'NG','Cross River',a.admin_level_2,
 a.legal_status,a.source_url,a.acquisition_status,a.missing_material,a.next_action,a.evidence_notes
FROM assets a JOIN provenance.spatial_acquisition_campaigns c ON c.external_key='ng-cross-river-spatial-rerun-v1'
ON CONFLICT(external_key) DO NOTHING;

-- Down Migration
DROP TABLE provenance.spatial_asset_inventory;
DROP TABLE provenance.spatial_acquisition_campaigns;
