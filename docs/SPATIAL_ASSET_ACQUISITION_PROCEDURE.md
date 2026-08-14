# Spatial Asset Acquisition Procedure

Status: **binding operating procedure**  
Owner: Dende data and intelligence pipeline  
Version: 1.0 — 13 August 2026

## Product objective

Dende receives a proposed parcel boundary and determines whether it overlaps
land that is already allocated, reserved, protected, acquired, planned or
otherwise restricted.

Research succeeds only when it either produces a validated boundary that can
safely participate in checks, or records a specific unresolved spatial asset,
its responsible authority, the missing material and the next acquisition action.
A news article, portal, URL, area figure or place name is not spatial coverage.

## Mandatory order of work

Every jurisdiction must be processed in this order:

1. Government spatial-asset inventory.
2. Authoritative instruments and datasets.
3. Geometry extraction or acquisition.
4. Spatial and legal validation.
5. Controlled activation in checks.
6. General media and historical discovery.
7. Reconciliation and recurring refresh.

Media begins only after the government inventory and authoritative-source search
have been recorded. It discovers missing names, instruments, survey references
and changes; it never substitutes for boundary data.

## 1. Government spatial-asset inventory

Create a record for every known or suspected asset, even when its files have not
been found. Search every category independently:

- forest, wildlife, nature, marine and community conservation areas;
- national/state parks, recreation parks, green belts and open spaces;
- wetlands, mangroves, waterways, shorelines, floodplains and buffers;
- government residential, commercial and industrial layouts;
- government estates, plantations, farms and agricultural schemes;
- government tourism, leisure, cultural and civic assets, including resorts,
  convention centres, stadia, museums, waterfronts and their wider compounds;
- acquired land for housing, airports, ports, rail, roads, schools, hospitals,
  utilities and institutions;
- road, pipeline, transmission, drainage and other rights-of-way;
- master-plan zones, planning schemes and development-control corridors;
- military, security and strategic federal property;
- revoked, reclaimed, disputed and compensation/acquisition areas;
- cadastral blocks, allocation schedules and GIS government reservations.

Store canonical and alternative names, class, authority, location, legal status,
instrument/plan references, stated area, source/file URLs, acquisition status,
missing material, encroachment/fraud exposure, acquisition priority and check
eligibility. Urban government assets exposed to informal occupation or nearby
private sales must be treated as high priority even when they are not legally
called “reserves”. Report inventory counts by category. A
category with no confirmed result must be recorded as searched, not omitted.

## 2. Authoritative instruments and datasets

Search in this priority:

1. federal/state gazettes, laws, legal notices and acquisition schedules;
2. surveyor-general, lands/GIS, planning, forestry, environment, works and
   boundary-authority records;
3. official APIs, WMS/WFS/ArcGIS services and downloadable GIS;
4. approved survey/layout plans, allocation schedules and cadastral extracts;
5. EIAs, ESMPs, feasibility reports, budgets and procurement attachments;
6. institutional repositories, research data and supplementary files preserving
   government-derived maps or field coordinates;
7. reputable licensed/open spatial datasets, retaining authority and licence.

Search PDF, images, Word, spreadsheets, delimited text, GeoJSON, KML/KMZ, SHP,
GPKG, DXF, HTML and archives. Inspect attachments, embedded files, supplements,
map services and storage paths. Store discovery-page and actual-file URLs
separately.

## 3. Geometry acquisition and extraction

Preferred routes, strongest first:

1. authoritative native polygon with declared CRS;
2. authoritative coordinate/beacon register;
3. bearings-and-distances traverse tied to known control and CRS;
4. authoritative georeferenced map or survey plan;
5. government-derived geometry from a reputable secondary repository;
6. approximate geocoded extent for research/display only.

Preserve each source asset and checksum, page/sheet/table/row/beacon locator,
unmodified source value, normalized value, CRS candidates, extraction method and
confidence, and review status. Never guess corrupted digits, CRS, vertex order or
topology. Readable but unresolved observations remain quarantined.

## 4. Spatial and legal validation

Candidates must pass applicable checks:

- CRS, datum and axis order;
- closure, vertex order, duplicates and self-intersection;
- PostGIS validity and geometry type;
- stated versus computed area;
- beacon/traverse/plan topology;
- expected jurisdiction and locality;
- comparison with plan imagery or an independent reference;
- instrument identity, effective date and supersession status;
- explicit review decision and audit event.

Repair is allowed only when supported by the source. `ST_MakeValid`, convex hulls,
buffering or arbitrary point reordering do not prove a legal boundary. Partial
geometry must identify the exact included and excluded rows or sheets.

## 5. Activation policy

Geometry enters live checks only when it has tier 1–2 evidence, an official/legal
or approved authoritative derivative source, accepted review, `derived` or
`authoritative` geometry status, valid topology, explicit full/partial coverage
and complete source/import provenance.

Approximate, disputed, superseded, unreviewed and media-derived geometry stays
excluded. Searchable evidence and check-enabled geometry are separate decisions.

## 6. General media and historical discovery

After the spatial pass, search media, court reporting, government news and
archives for unknown assets, instrument/plan references, changes, encroachment,
double allocations and clues to files. Every result must link to the inventory.
Without geometry it is context and remains excluded from checks.

## 7. Completion gates

Every state run reports:

- searched categories and inventory count by category;
- instruments/files found, downloaded and checksummed;
- observations extracted and accepted;
- geometry candidates valid, ambiguous and rejected;
- full/partial live features;
- assets still missing geometry;
- next exact acquisition actions and responsible authorities.

A state is not “covered” because a run completed. Coverage is measured by
validated assets and geographic extent.

## Execution sequence

1. Cross River — rerun from the beginning under this procedure.
2. Akwa Ibom — rerun from the beginning under this procedure.
3. National/federal assets — parks, forests, federal roads and ROWs, airports,
   ports, rail, transmission, strategic land, boundaries and acquisitions.
4. Remaining states, one complete campaign at a time.
5. Periodic refresh and change detection.

## Required deliverables

Each run leaves a database inventory (including unavailable geometry), acquired
files/checksums where permitted, extraction and analysis records, coordinate-level
provenance, geometry candidates and validation outcomes, live accepted features,
automated exclusion/alert tests, and a concise gap/next-action report.
