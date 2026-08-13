-- Up Migration

-- "planned" means an authority has been identified, but its data has not yet
-- been acquired and approved for checks. coverage_status remains the explicit
-- user-facing statement about whether usable spatial coverage exists.
ALTER TABLE provenance.data_sources
  DROP CONSTRAINT data_sources_status_check;
ALTER TABLE provenance.data_sources
  ADD CONSTRAINT data_sources_status_check
  CHECK (status IN ('planned', 'active', 'partial', 'stale', 'test', 'archived'));

WITH catalog(type, name, provider, country_code, admin_level_1, format, source_url, description) AS (
  VALUES
    ('cadastral', 'Nigeria national survey and geospatial records', 'Office of the Surveyor-General of the Federation', 'NG', NULL, 'mixed', 'https://osgof.gov.ng/services/', 'Federal custodian for geodetic, cadastral, topographic, mapping and national geospatial records. Acquisition and licensing review pending.'),
    ('other', 'Nigeria internal and international administrative boundaries', 'National Boundary Commission', 'NG', NULL, 'mixed', 'https://boundarycommission.gov.ng/about-us/our-mandate/', 'Federal authority for defining and delimiting international, state, local-government and community boundaries. Data access review pending.'),
    ('other', 'Nigeria satellite imagery and remote-sensing records', 'National Space Research and Development Agency', 'NG', NULL, 'imagery', 'https://nasrda.gov.ng/mandate/', 'Federal repository for satellite data over Nigeria. Product access, dates, resolution and licensing review pending.'),

    ('cadastral', 'Abia State land and cadastral records', 'Abia State Ministry of Lands and Housing / Office of the Surveyor-General', 'NG', 'Abia', 'mixed', 'https://landsandhousing.abiastate.gov.ng/', 'Authoritative state custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Adamawa State land and cadastral records', 'Adamawa State Ministry of Lands and Survey / ADGIS', 'NG', 'Adamawa', 'mixed', 'https://lands.adamawastate.gov.ng/', 'Authoritative state custodian and digital land-administration programme identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Akwa Ibom State land and cadastral records', 'Akwa Ibom Ministry of Lands and Water Resources / AKWAGIS', 'NG', 'Akwa Ibom', 'mixed', 'https://akwagis.ak.gov.ng/', 'Authoritative state GIS identified; usable parcel and reservation layers not yet acquired.'),
    ('cadastral', 'Anambra State land and cadastral records', 'Anambra State Ministry of Lands / ANAMGIS', 'NG', 'Anambra', 'mixed', 'https://www.mol.anambrastate.gov.ng/anamgis/', 'Authoritative state GIS and land-record custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Bauchi State land and cadastral records', 'Bauchi State Ministry responsible for Lands and Survey', 'NG', 'Bauchi', 'mixed', 'https://bauchistate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Bayelsa State land and cadastral records', 'Bayelsa Geographic Information System (BGIS)', 'NG', 'Bayelsa', 'mixed', 'https://bgis.bayelsastate.gov.ng/', 'Authoritative state GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Benue State land and cadastral records', 'Benue State Ministry responsible for Lands, Survey and GIS', 'NG', 'Benue', 'mixed', 'https://benuestate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Borno State land and cadastral records', 'Borno Geographic Information Service (BOGIS)', 'NG', 'Borno', 'mixed', 'https://bogis.bornostate.gov.ng/', 'Authoritative state land registry and GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Cross River State land and cadastral records', 'Cross River Geographic Information Agency (CRGIA)', 'NG', 'Cross River', 'mixed', 'https://www.crgia.portal.crossriverstate.gov.ng/', 'Authoritative state GIS identified; current Dende Calabar fixtures remain test-only and are not this source.'),
    ('cadastral', 'Delta State land and cadastral records', 'Delta State Ministry responsible for Lands, Survey and Urban Development', 'NG', 'Delta', 'mixed', 'https://deltastate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Ebonyi State land and cadastral records', 'Ebonyi State Ministry responsible for Lands and Survey', 'NG', 'Ebonyi', 'mixed', 'https://www.ebonyistate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Edo State land and cadastral records', 'Edo State Geographic Information Service (EdoGIS)', 'NG', 'Edo', 'mixed', 'https://edogis.org/', 'State GIS authority targeted; official data access and licensing confirmation pending.'),
    ('cadastral', 'Ekiti State land and cadastral records', 'Ekiti State Office of the Surveyor-General / Ministry responsible for Lands', 'NG', 'Ekiti', 'mixed', 'https://www.ekitistate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Enugu State land and cadastral records', 'Enugu State Geographic Information System (ENGIS)', 'NG', 'Enugu', 'mixed', 'https://engis.enugustate.gov.ng/', 'Authoritative state GIS and land registry identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Gombe State land and cadastral records', 'Gombe Geographic Information Systems (GOGIS)', 'NG', 'Gombe', 'mixed', 'https://gombestate.gov.ng/', 'State GIS custodian targeted; official data endpoint and licensing confirmation pending.'),
    ('cadastral', 'Imo State land and cadastral records', 'Imo State Ministry responsible for Lands, Survey and Physical Planning', 'NG', 'Imo', 'mixed', 'https://imostate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Jigawa State land and cadastral records', 'Jigawa State Ministry responsible for Lands, Housing and Urban Development', 'NG', 'Jigawa', 'mixed', 'https://www.jigawastate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Kaduna State land and cadastral records', 'Kaduna Geographic Information Service (KADGIS)', 'NG', 'Kaduna', 'mixed', 'https://kadgis.kdsg.gov.ng/', 'Authoritative state GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Kano State land and cadastral records', 'Kano Geographic Information System (KANGIS)', 'NG', 'Kano', 'mixed', 'https://www.kangis.gov.ng/', 'Authoritative state GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Katsina State land and cadastral records', 'Katsina State Ministry responsible for Lands and Survey', 'NG', 'Katsina', 'mixed', 'https://katsinastate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Kebbi State land and cadastral records', 'Kebbi State Ministry responsible for Lands and Housing', 'NG', 'Kebbi', 'mixed', 'https://kebbistate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Kogi State land and cadastral records', 'Kogi State Ministry responsible for Lands and Housing', 'NG', 'Kogi', 'mixed', 'https://kogistate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Kwara State land and cadastral records', 'Kwara Geographic Information Service (KW-GIS)', 'NG', 'Kwara', 'mixed', 'https://kwarastate.gov.ng/', 'State GIS custodian targeted; official data endpoint and licensing confirmation pending.'),
    ('cadastral', 'Lagos State land and cadastral records', 'Lagos State Lands Bureau', 'NG', 'Lagos', 'mixed', 'https://landsbureau.lagosstate.gov.ng/', 'Authoritative state lands custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Nasarawa State land and cadastral records', 'Nasarawa Geographic Information Service (NAGIS)', 'NG', 'Nasarawa', 'mixed', 'https://nagis.na.gov.ng/', 'Authoritative state GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Niger State land and cadastral records', 'Niger State Geographic Information System / Ministry responsible for Lands', 'NG', 'Niger', 'mixed', 'https://nigerstate.gov.ng/', 'State GIS custodian targeted; official data endpoint and licensing confirmation pending.'),
    ('cadastral', 'Ogun State land and cadastral records', 'Ogun State Bureau of Lands and Survey', 'NG', 'Ogun', 'mixed', 'https://lands.ogunstate.gov.ng/', 'Authoritative state lands and survey custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Ondo State land and cadastral records', 'Ondo State Ministry responsible for Infrastructure, Lands and Housing', 'NG', 'Ondo', 'mixed', 'https://ondostate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Osun State land and cadastral records', 'Osun State Office of the Surveyor-General', 'NG', 'Osun', 'mixed', 'https://www.osunstate.gov.ng/ministries/office-of-surveyor-general/', 'Authoritative state survey custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Oyo State land and cadastral records', 'Oyo State Office of the Surveyor-General', 'NG', 'Oyo', 'mixed', 'https://surveyorgeneral.oyostate.gov.ng/', 'Authoritative state survey custodian identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Plateau State land and cadastral records', 'Plateau Geographic Information System (PLAGIS)', 'NG', 'Plateau', 'mixed', 'https://plagis.plateaustate.gov.ng/', 'Authoritative state GIS identified; usable parcel dataset not yet acquired.'),
    ('cadastral', 'Rivers State land and cadastral records', 'Rivers State Ministry responsible for Lands and Survey / RIVGIS', 'NG', 'Rivers', 'mixed', 'https://www.riversstate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Sokoto State land and cadastral records', 'Sokoto State Ministry responsible for Lands, Housing and Survey', 'NG', 'Sokoto', 'mixed', 'https://sokotostate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Taraba State land and cadastral records', 'Taraba State Ministry responsible for Lands and Survey', 'NG', 'Taraba', 'mixed', 'https://tarabastate.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Yobe State land and cadastral records', 'Yobe Geographic Information Service / Ministry responsible for Lands', 'NG', 'Yobe', 'mixed', 'https://yobestate.gov.ng/', 'State GIS custodian targeted; official data endpoint and licensing confirmation pending.'),
    ('cadastral', 'Zamfara State land and cadastral records', 'Zamfara State Ministry responsible for Lands and Housing', 'NG', 'Zamfara', 'mixed', 'https://zamfara.gov.ng/', 'State-level authoritative custodian targeted; official downloadable spatial endpoint not yet confirmed.'),
    ('cadastral', 'Federal Capital Territory land and cadastral records', 'Abuja Geographic Information Systems (AGIS)', 'NG', 'Federal Capital Territory', 'mixed', 'https://www.fcta.gov.ng/ova_dep/abuja-geographic-information-systems/', 'Authoritative FCT cadastral and land-registry custodian identified; usable parcel dataset not yet acquired.')
)
INSERT INTO provenance.data_sources
  (type, name, provider, country_code, admin_level_1, format, source_url,
   authority_level, status, coverage_status, description)
SELECT type, name, provider, country_code, admin_level_1, format, source_url,
       'official', 'planned', 'unavailable', description
  FROM catalog c
 WHERE NOT EXISTS (
   SELECT 1 FROM provenance.data_sources s
    WHERE s.name = c.name AND s.country_code = c.country_code
      AND s.admin_level_1 IS NOT DISTINCT FROM c.admin_level_1
 );

-- Down Migration
DELETE FROM provenance.data_sources
 WHERE status = 'planned' AND coverage_status = 'unavailable'
   AND authority_level = 'official' AND country_code = 'NG';
ALTER TABLE provenance.data_sources DROP CONSTRAINT data_sources_status_check;
ALTER TABLE provenance.data_sources
  ADD CONSTRAINT data_sources_status_check
  CHECK (status IN ('active', 'partial', 'stale', 'test', 'archived'));
