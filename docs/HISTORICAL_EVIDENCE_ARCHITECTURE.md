# Historical land evidence architecture

## Purpose

The Cross River pilot is Dende's receiving, review and serving system for
historical land intelligence. A future separate repository may run scheduled
discovery, download, OCR, extraction and normalization workflows, but it must
write through the contract defined here.

## Core distinction

`searchable` and `check-enabled` are separate decisions. An official article,
budget or statistical table can establish a useful historical fact without
identifying a dependable parcel boundary. Such a record may be searchable but
must remain excluded from spatial checks.

Check eligibility requires all of the following database-enforced conditions:

- human review status is `accepted`;
- geometry is `derived` or `authoritative`;
- evidence tier is 1 or 2;
- check status is deliberately changed to `eligible`.

## Evidence tiers

1. Legal instrument: gazette, registered title, signed allocation/acquisition,
   approved plan or court order.
2. Official administrative record: ministry notice, approved list, inventory
   or formal government record.
3. Official government report or news publication.
4. Credible independent reporting.
5. Unverified discovery lead.

Source authority and extraction confidence are separate. Accurate extraction
of a weak source does not make the source authoritative.

## Tables

- `intelligence.documents`: immutable source/document versions, retrieval and
  archive metadata, language, checksum and extraction state.
- `intelligence.land_events`: normalized historical facts, references,
  geography, geometry quality, review/search/check status and sensitivity.
- `intelligence.event_evidence`: immutable document-to-event assertions with
  supporting, contradicting, superseding or contextual roles and locators.
- `intelligence.event_parties`: structured parties with display controls.
- `intelligence.event_relations`: correction, contradiction, implementation
  and supersession links without rewriting the earlier event.
- `intelligence.review_events`: append-only review and publication decisions.
- `intelligence.document_assets`: discovered file URLs, immutable checksums and
  archive locations, page counts, text-layer state and acquisition/extraction
  queues.
- `intelligence.extraction_runs`: extractor/version provenance and page-scoped
  diagnostics for every text or OCR run.
- `intelligence.numeric_observations`: quarantined coordinate pairs, bearings,
  distances, areas, beacons and legal references with page locators, raw text,
  normalized values, possible CRS values and confidence.
- `intelligence.geometry_candidates`: candidate polygons with construction
  method, CRS, closure/area validation and a separate human validation gate.

## Scheduled-ingestion contract

The future workflow repository should:

1. discover a URL and assign a stable namespaced `external_key`;
2. download bytes, compute a checksum and preserve an immutable archive copy;
3. create a new document version when content changes rather than overwriting;
4. extract text with page/section locators;
5. propose normalized land events and evidence links idempotently;
6. default every proposal to `unreviewed`, `withheld` and `excluded`;
7. never promote its own output to accepted or check-enabled;
8. retain run metadata, parser/model version and diagnostics;
9. detect possible duplicates, corrections and superseding events for review;
10. submit through a constrained ingestion API or staging schema, not direct
    unrestricted production database access.

## File and numeric extraction workflow

Search results and media pages are discovery surfaces. The workflow must also
enumerate linked PDFs, office documents, images and storage URLs. For PDFs it
first extracts the text layer, renders pages for visual verification, and uses
OCR on pages whose text is absent or loses tables/plan labels.

Numeric extraction is intentionally broad: projected coordinate pairs,
latitude/longitude, bearings and distances, hectares/square metres, beacon
identifiers, plot/block/layout numbers, survey numbers, title/file numbers and
dates. Every observation retains the exact raw text and page/region locator.

Numbers do not become coordinates merely because they resemble coordinates.
They remain `unreviewed` or `ambiguous` until table headers, axis order, units,
datum/CRS, locality and document context are resolved. Candidate geometry must
then pass closure, validity and area checks plus human review.

Discovery covers eight format families, not only PDF:

1. PDF (`pdf`)
2. Images/scans (`jpg`, `jpeg`, `png`, `tif`, `tiff`, `webp`)
3. Word-processing files (`doc`, `docx`, `odt`, `rtf`)
4. Spreadsheets (`xls`, `xlsx`, `ods`)
5. Delimited/text files (`csv`, `tsv`, `txt`)
6. Native geospatial files (`geojson`, `kml`, `kmz`, `gpx`, `shp`, `gpkg`,
   `dxf`)
7. HTML pages (`html`, `htm`)
8. Archives (`zip`, `7z`, `rar`, `tar`, `gz`) whose contents are safely
   inventoried and routed recursively.

The Cross River lands update service itself accepts PDF, JPG/JPEG, PNG and
DOC/DOCX for allocation letters and survey plans, confirming that relevant
government-held evidence is not confined to PDF.

### Connecting an extraction worker

The complete connection and security contract is documented in
[`INTELLIGENCE_WORKER_API.md`](./INTELLIGENCE_WORKER_API.md).

Set `DENDE_INTELLIGENCE_INGESTION_KEY` on the API and send the same value in
the worker's `x-dende-ingestion-key` header. The worker can:

1. register newly found files through `POST /api/internal/intelligence/assets/discover`;
2. claim discovery candidates from `GET /api/internal/intelligence/assets/queue`;
3. report queued/downloaded/failed acquisition outcomes through
   `PATCH /api/internal/intelligence/assets/:externalKey/acquisition`;
4. download and analyse each material using its format-specific extraction route;
5. submit the original model response, versioned structured JSON, coordinate
   observations and optional WGS84 geometry candidates to
   `POST /api/internal/intelligence/analyses`, following
   [`land-analysis/v1`](./schemas/land-analysis-v1.schema.json); and
6. expose quarantined candidates through
   `GET /api/internal/intelligence/review-queue` for operator review.

Analysis and extraction runs are append-only. Every coordinate keeps its exact
page/region/cell locator, verbatim source text, normalized values, possible
CRS and confidence. Geometry candidates are always created as `unreviewed` and
excluded from spatial checks. `geometryWgs84` must already be transformed to
EPSG:4326; `sourceCrs` records the coordinate system found or inferred in the
original material.

## Cross River pilot scope

Initial records demonstrate government acquisition/publication processes, the
28-day C-of-O objection-list process, a state-wide budget programme, and the
reported return of 23 hectares at Summit Hills under court case HC/314/2021.
All are searchable context. None has parcel geometry and none influences a
spatial result.
