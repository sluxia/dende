# Intelligence Worker API

This document defines how a separate discovery, download and AI-extraction
worker connects to Dende. The worker is an internal machine client, not a
browser user or user account.

## Authentication

Configure the same long, random secret in the Dende API and the worker:

```env
DENDE_INTELLIGENCE_INGESTION_KEY=replace-with-a-long-random-secret
```

The worker sends the secret with every request:

```http
x-dende-ingestion-key: replace-with-a-long-random-secret
```

The API responds with:

- `401` when the header is absent or incorrect;
- `503` when the server has no ingestion key configured; and
- the endpoint's normal response when the credential is correct.

Never expose this value in frontend JavaScript, browser requests, logs, source
control or public API documentation. In production, keep it in the hosting and
workflow platforms' encrypted secret stores. This shared key is the initial
machine-to-machine boundary. Later versions should support separately
revocable worker identities, scoped permissions, rotation and rate limiting.

## Workflow

1. Discover a potentially relevant file and register its URL.
2. Read the acquisition queue.
3. Download the file, calculate its checksum and archive the original bytes.
4. Report the acquisition outcome and archived object URI.
5. Run the appropriate extraction route for its format family.
6. Submit the untouched model response and normalized analysis.
7. Send extracted coordinates into the human-review queue as quarantined
   geometry candidates.

Discovery or AI extraction never makes a candidate eligible for spatial
checks. Candidates remain `unreviewed` and `checkEligible=false` until a
separate validation and review action accepts them.

## Endpoints

### Register a discovered file

`POST /api/internal/intelligence/assets/discover`

```json
{
  "externalKey": "cross-river-layout-2026-001",
  "fileUrl": "https://example.gov.ng/files/layout.xlsx",
  "discoveredFromUrl": "https://example.gov.ng/publications",
  "filename": "layout.xlsx",
  "formatFamily": "spreadsheet",
  "fileExtension": "xlsx",
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "metadata": {
    "jurisdiction": "Cross River",
    "discoveredBy": "scheduled-research-worker"
  }
}
```

`externalKey` is the worker's stable idempotency key. Repeating the request
does not create another asset with the same key.

### Read the acquisition queue

`GET /api/internal/intelligence/assets/queue`

Returns up to 50 discovered or queued assets ordered by format-processing
priority and discovery date.

### Report acquisition state

`PATCH /api/internal/intelligence/assets/:externalKey/acquisition`

```json
{
  "status": "downloaded",
  "checksumSha256": "sha256-value",
  "storageUri": "s3://dende-evidence/cross-river/layout.xlsx",
  "byteSize": 182400,
  "mediaType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}
```

Supported states are `queued`, `downloaded`, `failed` and `blocked`. Durable
object storage belongs to the worker; Dende records the immutable-file
checksum and storage reference.

### Submit AI analysis

`POST /api/internal/intelligence/analyses`

The complete request contract is
[`land-analysis/v1`](./schemas/land-analysis-v1.schema.json). A submission
contains:

- the asset and stable analysis/extraction keys;
- provider, model, prompt and schema versions;
- the untouched provider response in `rawResponse`;
- normalized facts and observations in `structuredOutput`;
- page, table, cell, image-region or feature locators;
- raw source text and normalized numeric values;
- possible CRS values and confidence;
- optional WGS84 geometry candidates; and
- usage metadata and diagnostics.

`geometryWgs84` must already use EPSG:4326. `sourceCrs` records the original
coordinate reference system found or inferred in the material. Projected
coordinates must never be inserted directly as WGS84 GeoJSON.

The endpoint is idempotent on `analysisExternalKey`. It returns `201` when it
creates an analysis and `200` when that analysis has already been received.

### Read the review queue

`GET /api/internal/intelligence/review-queue`

Returns unreviewed geometry candidates with their source asset, analysis run,
coordinate count, confidence, original CRS and candidate GeoJSON.

## Supported file families

The discovery registry currently routes eight families:

1. PDF
2. Images and scans
3. Word-processing documents
4. Spreadsheets
5. Delimited and plain-text files
6. Native geospatial files
7. HTML pages
8. Archives, whose contents are inventoried and routed recursively

The configured extensions and extraction routes live in
`intelligence.discovery_profiles`.

## Local request example

```bash
curl http://localhost:3000/api/internal/intelligence/assets/queue \
  -H "x-dende-ingestion-key: $DENDE_INTELLIGENCE_INGESTION_KEY"
```

## Current boundary

The receiving database schema, secured endpoints, versioned JSON contract and
review quarantine are implemented. The separate scheduled worker that searches
the web, downloads files, invokes parsers/models and archives original bytes is
not yet implemented. That worker can be created as its own repository without
giving it unrestricted database access.
