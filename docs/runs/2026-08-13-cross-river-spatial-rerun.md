# Cross River spatial acquisition rerun

Started: 13 August 2026  
Procedure: `SPATIAL_ASSET_ACQUISITION_PROCEDURE.md` v1.0  
Campaign: `ng-cross-river-spatial-rerun-v1`  
Current stage: paused after Kwa Falls approval

## Current result

Sixty-three government/public spatial-asset targets are stored individually in
`provenance.spatial_asset_inventory`. Fifty-five are queued, four are being
researched and four have representative or source-located geometry. Every one of
the 63 inventory assets remains excluded from checks. The campaign was paused by
the user after the approved Kwa Falls bundle; no next subject has been selected.

The initial inventory names:

1. Afi River Forest Reserve
2. Agoi Forest Reserve
3. Boshi Forest Reserve
4. Boshi Extension Forest Reserve
5. Cross River North Forest Reserve
6. Cross River South Forest Reserve
7. Ekinta Forest Reserve
8. Lower Enyon/Enyong Forest Reserve
9. Cross River National Park - Oban Division
10. Cross River National Park - Okwangwo Division
11. Ukpon River Forest Reserve
12. Umon Ndealichi Forest Reserve
13. Uwet Odot Forest Reserve

## Boundary evidence

- A rendered study map visually confirms thirteen distinct mapped units and the
  two non-contiguous national-park divisions. It is a discovery/validation aid,
  not yet an authoritative legal boundary layer.
- Cross River Forest Law sections 6, 13 and 15 require gazette notices/orders to
  specify reserve lands and their limits. Section 23 provides for beacons and
  demarcated boundary lines. Constituting and modifying gazettes are therefore
  priority acquisition targets.
- The state 2025 budget identifies boundary clearing, realignment, re-beaconing,
  reserve inventory and forest-cover assessment activity, indicating that more
  current operational boundary material should exist.
- A division-specific BIOPAMA/WDPA record has been located for the Oban Division;
  its polygon, authority lineage, licence and currency require validation before
  activation.

## Metrics

- Inventory assets: 63
- Processing status: 55 queued; 4 researching; 4 geometry found; 0 check-enabled
- Source PDFs downloaded and checksummed in workspace: 8
- Geometry candidates: 0
- Check-enabled assets: 0
- Current class counts: 13 agricultural schemes, 6 conservation areas, 11 forest
  reserves, 9 government layouts, 6 government estates, 3 industrial areas, 2
  national parks, 1 planning zone, 9 public institutions, 2 transport
  rights-of-way and 1 waterway buffer.
- No category is marked complete yet. Wetlands and waterways, government layouts,
  utility rights-of-way, strategic/federal land, acquisitions/revocations and
cadastral blocks still require explicit enumeration; all existing classes also
require an exhaustion pass for omissions and aliases.

## Government housing and layout inventory pass

Nine targets are stored from official state statistical, budget and asset-
recovery records: State Housing Estate Calabar; GRA housing projects at Okuku,
Obanliku, Ikom and Odukpani; separately budgeted 1,000-unit vulnerable and
500-unit rent-to-own schemes in Yala; the 31-hectare Adiabo women's housing site;
and Crown Land in Ogoja GRA. Budget entries are treated only as evidence that a
project/site must be inventoried—not proof of construction, title or boundary.
The exact site remains unresolved where the publication names only an LGA.

## High-risk urban government assets correction

The initial inventory wrongly over-weighted environmental reserves. The following
assets are now explicit acquisition targets: Tinapa, Marina Resort, Summit Hills,
CICC, the Summit Hills-Tinapa monorail ROW, Calabar Free Trade Zone, Obudu
Mountain Resort, Kwa Falls, U. J. Esuene Stadium and the Calabar Cultural Centre.

Tinapa, Marina, Summit Hills, the monorail corridor, CFTZ, Obudu Resort and Kwa
Falls carry priority 1 because adjoining private transactions or occupation can
readily overlap government interests. Summit Hills is especially urgent: official
records identify plan CR/C 1187 and two recently ceded areas, so validation must
separate the original acquisition, returned parcels and residual government land.

## Calabar Free Trade Zone — accepted production evidence

UNIDO's November 1991 Volume IV feasibility report (project DP/NIR/90/015) has
been acquired, checksummed, text-extracted and visually reviewed. It is stored as
production evidence for the CFTZ's identity, historic assigned area and physical
context. The report states that the assigned L-shaped site covered about 106
hectares, including roughly 1.5 kilometres along the Calabar River. It separately
discusses a possible 200-hectare eastward extension; that proposal is not treated
as assigned zone land.

Drawings 1–6 are present across PDF pages 92–103, including location, general
site, constraints, land-use and development plans. The drawings are split across
scanned sheets and do not expose a readable coordinate grid. The source is
therefore searchable and visible in production provenance, while the CFTZ remains
excluded from overlap checks until the perimeter is georeferenced with validated
control points and reconciled against a current NEPZA or as-built boundary.

## Marina Resort Calabar - accepted production evidence

The approved bundle combines the state's 2024 audited financial statements,
2025 first-quarter budget-performance report, official PPP pipeline and an
independent coordinate-bearing tourism study. The audited statements list Marina
Resort among entities controlled by Cross River State. The PPP pipeline records a
Tourism Bureau project in implementation with an indicated value of NGN 5
billion, and the budget report includes a NGN 10 million Marina Resort water-
jetty project.

The tourism study gives a reference point of 4.966083 N, 8.318607 E. This point is
stored as a numeric location observation and explicitly rejected as boundary
geometry. No title schedule, cadastral survey, land area, concession-plan annex,
component boundary or shoreline/water-lot limit was found. Marina Resort is
therefore visible and searchable with production provenance, while remaining
excluded from overlap checks.

## Obudu Mountain Resort and approach-road ROW - accepted production evidence

The 2024 audited statements establish Obudu Ranch Resort as a state-controlled
entity. State reporting says both a 3D digital survey and a redesigned master
plan have been completed, although neither underlying spatial file is publicly
attached. Reported resort extents conflict materially: the state statistical
publication reports 104 square kilometres while the resort directory reports
134 square kilometres. Both values are retained as conflicting evidence and
neither is converted into a perimeter.

The Federal Highways (Right of Way - Obudu to Obudu Cattle Ranch Road) Notice,
2019 is a distinct and potentially check-grade source. S.I. No. 58 publishes 35
survey sheets and a coordinate register of 262 observed beacons in UTM Zone 32N
(WGS84). The PDF text layer corrupts some digits and column boundaries, so the
register is acquired but marked review-required. No partial extraction, guessed
digit, centreline buffer or resort polygon has been activated. The next pass must
transcribe register pages 38-44 and reconcile both ROW sides against sheets 1-35.

Becheve Nature Reserve is also stored as a separate conservation asset. Its
reported 65/70-hectare extent must not be merged with either the resort estate or
the federal road corridor.

## Kwa Falls - accepted contextual evidence

Kwa Falls is stored as four separate interests rather than a combined tourism
and conservation record: the state tourism site, the waterfall/Great Kwa River
corridor, the historic Kwa Falls Oil Palm Estate and the federal Kwa Falls
Irrigation Project. All four are visible and searchable but excluded from checks.

The state coordinate register appears to transpose latitude and longitude labels.
The interpreted representative tourism point is approximately 5.140572 N,
8.509667 E; it is retained only for discovery and is not boundary geometry. The
oil-palm review reports a 2,826-hectare gross estate and 1,877 hectares planted at
acquisition, while other publications report materially different areas. Those
conflicts are preserved and no reported area is converted into a perimeter. The
irrigation budget proves the named project exists but supplies no command-area,
canal, intake, access or acquired-land geometry.

## Pause checkpoint

- Campaign paused by user on 13 August 2026 after Kwa Falls was stored and
  verified in the Research and Sources interfaces.
- Current intelligence store: 34 searchable land events and 43 documents. Of
  those events, 33 are excluded from checks and one earlier event is eligible.
- Current spatial inventory: 63 assets, all excluded from checks.
- No next subject has been selected and no further research should start until
  the user resumes the campaign.
- A process conflict must be resolved on resumption: this document originally
  required completing the statewide inventory before asset validation, while
  the later approved operating method processes one subject with 10–15 focused
  queries and waits for approval before storage or continuation.

## Resume actions

1. Confirm whether to finish the statewide category inventory first or formally
   adopt the later one-subject-at-a-time protocol as the replacement gate.
2. If the inventory gate remains, continue category-by-category omission and
   duplicate review, then explicitly close that gate.
3. If asset processing resumes, claim exactly one queued asset through
   `GET /api/internal/spatial-assets/queue?campaign=ng-cross-river-spatial-rerun-v1&limit=1`.
4. Run 10–15 focused queries for that subject, acquire its authoritative
   instrument and files where available, and report findings for explicit user
   approval before storing them or moving to the next subject.
5. Extract and validate geometry only from defensible source material; otherwise
   record the precise blocker and keep the asset excluded from checks.

## Superseded validation log

The validation attempts below happened before the inventory gate was enforced.
They are retained as an audit trail, but no further asset-level validation should
run until the statewide inventory is explicitly closed.

### Oban and Okwangwo - first pass

- **WDPA 40925 / Oban: failed as boundary geometry.** BIOPAMA reports a point
  feature, centroid 8.55E 5.3333N, reported area 1,906 km2 and GIS area 0 km2.
  The record supports identity and approximate location only. No centroid buffer
  or synthetic footprint will be used.
- **WDPA 20299 / combined Cross River National Park: inconclusive.** The register
  identifier is confirmed, but the public extent endpoint returned HTTP 500 and
  supplied no geometry. Oban and Okwangwo remain excluded from checks.
- Reported areas differ materially among sources (Oban 1,906/2,800 km2;
  Okwangwo 640/920 km2; combined park 4,000 km2). Validation must establish
  whether these differences reflect old reserves, current park limits, enclaves,
  source dates or simple reporting errors before using any polygon.
