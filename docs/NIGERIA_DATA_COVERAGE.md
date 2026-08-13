# Nigeria authoritative data coverage catalogue

Last reviewed: 13 August 2026

## Purpose and safety rule

Dende now catalogues the likely authoritative custodian for national datasets,
all 36 Nigerian states, and the Federal Capital Territory. Catalogue presence
does **not** mean Dende possesses or checks the authority's records.

Every newly catalogued target starts with:

- lifecycle `planned`;
- coverage `unavailable`;
- authority `official`;
- zero imports and zero usable records.

An additional `access_stage` prevents an authority website from being confused
with data. The progression is `authority_identified`, `portal_found`,
`access_required`, `dataset_found`, `under_review`, and finally `usable`.
`unavailable` records a confirmed dead end. Only `usable` belongs in the
Available datasets section.

The checker explicitly rejects sources in either `planned` or `unavailable`
state. A source can influence results only after acquisition, licensing,
validation, import provenance, and an intentional lifecycle update.

## National custodians

| Coverage theme | Authoritative custodian | Why it belongs in the catalogue | Initial state |
| --- | --- | --- | --- |
| National survey, cadastral, geodetic and topographic records | Office of the Surveyor-General of the Federation (OSGOF) | OSGOF describes itself as the national apex survey and geospatial authority and repository. | Planned / unavailable |
| International, state, LGA and community boundaries | National Boundary Commission (NBC) | NBC's statutory mandate includes defining and delimiting internal and international administrative boundaries. | Planned / unavailable |
| Satellite imagery and remote sensing | National Space Research and Development Agency (NASRDA) | NASRDA's mandate makes it the repository of satellite data over Nigeria. | Planned / unavailable |

## State and FCT coverage

One planned cadastral/land-record source is registered for each jurisdiction:

Abia, Adamawa, Akwa Ibom, Anambra, Bauchi, Bayelsa, Benue, Borno, Cross River,
Delta, Ebonyi, Edo, Ekiti, Enugu, Gombe, Imo, Jigawa, Kaduna, Kano, Katsina,
Kebbi, Kogi, Kwara, Lagos, Nasarawa, Niger, Ogun, Ondo, Osun, Oyo, Plateau,
Rivers, Sokoto, Taraba, Yobe, Zamfara, and the Federal Capital Territory.

Where an official digital GIS exists, the catalogue names it (for example
AKWAGIS, ANAMGIS, BOGIS, CRGIA, ENGIS, KADGIS, KANGIS, NAGIS, PLAGIS and
AGIS). Where public discovery is weak, the catalogue conservatively names the
state ministry or Office of the Surveyor-General responsible for lands and
survey and records that a downloadable spatial endpoint is not yet confirmed.
These entries appear as **Target authorities**, separately from datasets used
in checks.

## Acquisition gate

Before changing any source to usable coverage, record and review:

1. the authority and exact dataset owner;
2. geographic extent, currency date, CRS and data dictionary;
3. access terms, licence and redistribution limits;
4. checksum, original filename and immutable import record;
5. geometry validity, completeness and sample comparison with the source;
6. whether coverage is complete, partial or stale;
7. an explicit activation decision.

This makes coverage growth gradual and auditable without overstating what a
clean Dende result means.

## Cross River acquisition audit — 13 August 2026

The audit found operational government systems, but no anonymous download,
documented API, WFS/WMS, or public map service suitable for ingestion.

| Target | Finding | Stage | Next action |
| --- | --- | --- | --- |
| CRGIA land and cadastral repository | Official applications and paid land services are online; the agency says it maintains and disseminates land information. No public parcel feed was found. | Access required | Request institutional/bulk access, coverage, format, CRS, dates, licence, redistribution terms and fees from `landsenquiries@crossriverstate.gov.ng`. |
| Office of the Surveyor-General approved plans | Authenticated platform exists. Licensed surveyors are onboarded and upload coordinates as CSV/Excel with survey documents. It is a lodgement workflow, not an open registry. | Access required | Request institutional matching/API or approved-plan extracts and permitted automated use. |
| State forest reserves | Forestry Commission is the state authority. No authoritative reserve-boundary file or service was found. | Authority identified | Request gazetted reserve polygons, instruments, effective dates, CRS and licence. |
| Cross River National Park | Nigeria Park Service confirms the Oban and Okwangwo divisions, but publishes no authoritative boundary geometry on the park page. | Access required | Request gazetted park geometry and reuse terms from the Park Service. |
| State roads and rights-of-way | State budgets confirm the Ministry of Works and current road programmes; no centerline/ROW geometry was found. | Authority identified | Request current road inventory, classes, legal ROW widths, geometry, dates and licence. |
| Planning and development-control zones | State notices identify the Ministry of Lands/Urban Development Authority as responsible for approvals; no operative zoning layer was found. | Authority identified | Request planning schemes, zoning polygons, setbacks, effective dates, CRS and licence. |

The official 2025 revised budget is useful corroboration: it includes CRGIA
web-server hosting, portal optimisation, land-registry software support,
systematic land titling and proposed LiDAR imagery. These show that internal
systems/data programmes exist, but they do not establish public access or a
licence for Dende.

## Primary references

- OSGOF services: https://osgof.gov.ng/services/
- National Boundary Commission mandate: https://boundarycommission.gov.ng/about-us/our-mandate/
- NASRDA mandate: https://nasrda.gov.ng/mandate/
- Abia Ministry of Lands and Housing: https://landsandhousing.abiastate.gov.ng/
- Adamawa Ministry of Lands and Survey: https://lands.adamawastate.gov.ng/
- Akwa Ibom AKWAGIS: https://akwagis.ak.gov.ng/
- Anambra ANAMGIS: https://www.mol.anambrastate.gov.ng/anamgis/
- Borno BOGIS: https://bogis.bornostate.gov.ng/
- Cross River CRGIA: https://www.crgia.portal.crossriverstate.gov.ng/
- Enugu ENGIS: https://engis.enugustate.gov.ng/
- Kaduna KADGIS: https://kadgis.kdsg.gov.ng/
- Kano KANGIS: https://www.kangis.gov.ng/
- Lagos Lands Bureau: https://landsbureau.lagosstate.gov.ng/
- Nasarawa NAGIS: https://nagis.na.gov.ng/
- Ogun Bureau of Lands and Survey: https://lands.ogunstate.gov.ng/
- Osun Office of the Surveyor-General: https://www.osunstate.gov.ng/ministries/office-of-surveyor-general/
- Oyo Office of the Surveyor-General: https://surveyorgeneral.oyostate.gov.ng/
- Plateau PLAGIS: https://plagis.plateaustate.gov.ng/
- FCT AGIS: https://www.fcta.gov.ng/ova_dep/abuja-geographic-information-systems/
