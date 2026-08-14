---
name: evidence-acquirer
description: Acquire, preserve, inspect, and extract one approved Dende land-record asset from a public source. Use after sourcer has identified a direct file, page, service, or archive and the user has approved acquisition; supports PDF, images, Word, spreadsheets, delimited text, native geospatial data, HTML, and archives. Produces checksummed evidence and land-analysis/v1 JSON without changing application code, the database, or spatial-check eligibility.
---

# Acquire land evidence

Process exactly one approved asset at a time. Preserve the source before
extracting it. Treat acquisition, extraction, interpretation, geometry review,
and database ingestion as separate stages.

## Read before acting

Read these project sources completely:

1. `README.md` and `ROADMAP.md` for the mission and current pauses.
2. `docs/INTELLIGENCE_WORKER_API.md` for the acquisition and analysis boundary.
3. `docs/schemas/land-analysis-v1.schema.json` for normalized output.
4. `references/handoff-contract.md` for accepted inputs and workspace layout.
5. `references/file-routes.md` for the selected format family.
6. `references/output-example.json` before writing final artifacts.
7. `references/acquisition-manifest.schema.json` and the approved sourcer
   handoff before retrieving anything.

Also read the selected sourcer subject JSON and its query-log entries. Read
`docs/SPATIAL_ASSET_ACQUISITION_PROCEDURE.md` when the asset may contain or link
to boundary geometry. Explicit user and project instructions override this
skill.

## Confirm the handoff

Require one schema-valid `approved-research-asset/v1` handoff containing the
stable asset key, canonical identity, jurisdiction and approved retrieval
targets. Do not infer approval from discovery alone and do not add another file
unless a revised approval handoff includes it.

If a sourcer run is supplied, locate the asset in:

```text
tmp/research/<run>/subjects/<asset-external-key>.json
```

Resolve redirects and embedded download links, but preserve both the discovery
URL and final retrieval URL. Do not broaden the task into another discovery
campaign. If the approved URL is dead, blocked, private, or materially different
from the approved asset, record the outcome and stop.

## Create an isolated asset workspace

Use only this ignored staging directory:

```text
tmp/research/<run>/acquisition/<asset-external-key>/
├── manifest.json
├── original/
├── rendered/
├── extracted/
├── analysis.json
└── report.json
```

Never write downloads, rendered pages, OCR text, or working JSON into source,
migration, documentation, or production storage directories. Existing files in
an asset workspace are immutable inputs: create a versioned sibling when bytes
or extraction settings differ.

## Acquire and preserve

1. Check that retrieval is public and permitted. Never bypass authentication,
   robots/access controls, CAPTCHAs, paywalls, or licence restrictions.
2. Retrieve the approved material without transforming its bytes. Preserve the
   server filename when safe and record the requested URL, redirect chain,
   retrieval timestamp, response media type, status, and headers relevant to
   provenance.
3. Calculate SHA-256 from the exact stored bytes and record byte size. Never use
   a page URL, ETag, filename, or transformed rendering as the original checksum.
4. Detect the real format from content as well as extension/media type. Record
   mismatches and quarantine malformed or executable content.
5. Classify every acquired file's relationship to the approved asset as
   `primary`, `corroborating`, or `unrelated_example`; record whether it can
   support the target boundary and why. A document mentioning the system or
   register is not the register itself.
6. Write `manifest.json` against
   `references/acquisition-manifest.schema.json` before
   extraction. A failed or blocked acquisition still receives a manifest and
   report, but no fabricated analysis.

Do not call the internal worker endpoints or upload to object storage unless the
user separately approves that mutation. Never print or copy
`DENDE_INTELLIGENCE_INGESTION_KEY`.

## Inspect by file family

Follow the applicable route in `references/file-routes.md`. For archives,
inventory every member safely, reject path traversal and recursive archive
bombs, then route each relevant member by its own detected family.

Inspect the complete relevant material, not only the first text match:

- every relevant PDF/rendered page and image region;
- every relevant document section, footnote, header, table, and embedded image;
- every spreadsheet sheet, hidden-sheet indicator, range, formula/value issue;
- every delimited row group and encoding/delimiter decision;
- every geospatial layer, CRS definition, extent, attribute schema, and sidecar;
- every relevant HTML table, attachment, structured-data block, map/service link;
- every relevant archive member with its full member locator.

Use embedded text first and OCR only where necessary. Preserve raw extraction
and OCR outputs under `extracted/`; rendered derivatives belong in `rendered/`.
Never replace the original.

If a page contains a scan, map, coordinate table, plan, diagram, handwritten
annotation, legend or graphical boundary evidence, set
`requiresVisualInspection=true` for that file. Rendering alone is not visual
inspection. Record `visualInspection.status=completed` only after a vision-
capable model or identified human has inspected every relevant rendered page or
image; otherwise leave it `required` and do not create a geometry candidate.

## Normalize the findings

Write `analysis.json` as exactly one `land-analysis/v1` object. Preserve the
untouched extractor/model response in `rawResponse`, then normalize:

- coordinate pairs and latitude/longitude;
- bearings, distances, areas, beacons, and traverse clues;
- plot, layout, survey, title, instrument, sheet, and plan references;
- dates and other material numeric observations;
- explicit CRS statements and plausible CRS candidates;
- precise page, table, cell/range, image-region, feature/layer, or archive-member
  locators for every observation.

In `diagnostics.observationSources`, map every observation external key to its
manifest `fileKey`, relationship, jurisdiction and
`supportsTargetBoundary` value. Observations from unrelated examples may be
preserved as context but must never be linked to a target geometry candidate.

Use the original text in `rawText`; do not silently correct digits, labels,
units, signs, axes, or spelling. Put interpretations in normalized `values` and
record ambiguity in warnings and diagnostics. Confidence measures extraction
certainty, not legal authority or title validity.

Create a geometry candidate only when the target material itself was acquired,
the manifest relevance decision is `relevant`, every linked observation is
mapped to a source file with `supportsTargetBoundary=true`, source and target
jurisdictions agree, required visual inspection is complete, and the material
supplies enough ordered boundary evidence or links an actual spatial dataset.
Leave `geometryWgs84`
null unless a defensible conversion to EPSG:4326 has been performed. A point,
place name, stated area, media illustration, geocoded extent, or bounding box is
not a parcel boundary. Every candidate remains unreviewed and ineligible for
checks.

If no relevant numerics are found, still produce a valid analysis with an empty
`observations` array, document facts, warnings, and diagnostics explaining what
was inspected.

## Report and stop

Write `report.json` using `references/handoff-contract.md`. It must state:

- acquisition outcome, exact original path, checksum, size, and detected type;
- extraction methods and complete inspection scope;
- observation counts by type and all coordinate/geometry findings;
- ambiguities, conflicts, missing components, access/licence limits, and errors;
- analysis path and schema-validation result;
- recommended next action: reacquire, corroborate, human review, geometry review,
  or eligible for a separately approved ingestion attempt.

Validate JSON against `docs/schemas/land-analysis-v1.schema.json` with an
available standards-compliant JSON Schema 2020-12 validator. If no validator is
installed, check structural conformance manually and say validation is
`not_run`; never claim it passed.

Then run:

```bash
python3 .agents/skills/evidence-acquirer/scripts/validate_acquisition.py \
  --approved <approved-asset.json> \
  --workspace tmp/research/<run>/acquisition/<asset-key>
```

Do not present the acquisition as complete unless this validator passes.

Present the paths and concise results, then stop. Do not process the next asset
without a new instruction or approved queue assignment.

## Mutation and concurrency boundary

This skill may autonomously read public sources and write only within the one
asset's ignored staging workspace. It must not:

- edit application code, migrations, schemas, roadmap, or other skills;
- insert, update, or delete database records;
- call Dende write endpoints or durable-storage APIs;
- activate or accept geometry, change review status, or mark check eligibility;
- research a second asset, jurisdiction, or unrelated lead;
- make ownership, title, verification, completeness, or coverage claims.

These restrictions allow the skill to run beside active product development
without shared-code, database, or migration conflicts.
