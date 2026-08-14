---
name: geometry-evidence-reviewer
description: Validate one quarantined Dende land-geometry candidate against its preserved source evidence. Use after evidence-acquirer has produced an analysis containing coordinates, bearings, a traverse, a digitized plan, or linked spatial data; checks transcription, CRS, axis order, topology, closure, area, jurisdiction, provenance, and legal/spatial limitations. Produces an isolated review decision and optional candidate GeoJSON without modifying the database or activating geometry.
---

# Review geometry evidence

Review exactly one geometry candidate at a time. A review decision is evidence
for a later controlled ingestion or activation step; it is never activation.

## Read before acting

Read completely:

1. `README.md` and `ROADMAP.md`.
2. `docs/SPATIAL_ASSET_ACQUISITION_PROCEDURE.md`, especially sections 3–5.
3. `docs/schemas/land-analysis-v1.schema.json`.
4. The selected acquisition `manifest.json`, `analysis.json`, `report.json`, and
   every original/rendered/extracted artifact cited by the candidate.
5. `references/review-gates.md` for the mandatory validation sequence.
6. `references/review-v1.schema.json` and `references/output-example.json`.

Read `docs/HISTORICAL_EVIDENCE_ARCHITECTURE.md` when reviewing authority,
instrument, correction, contradiction, or supersession. Project and explicit
user instructions override this skill.

## Require a complete handoff

Require the approved-asset handoff, schema-valid acquisition manifest, one
`assetExternalKey`, one candidate `externalKey`, its ordered
`observationExternalKeys`, exact acquisition workspace, and preserved source
locators. Confirm the input checksum matches the acquired original before using
it. Run the acquisition validator first; do not review invalid handoffs.

Do not review when the source bytes are missing, altered, or not traceable to the
analysis. Return `needs_corroboration` when the material is genuine but required
pages, sidecars, control points, CRS definitions, schedule rows, or instrument
identity are missing. Return `rejected` only when evidence affirmatively shows
the candidate is wrong or unsuitable, not merely incomplete.

## Create an isolated review workspace

Write only under:

```text
tmp/research/<run>/reviews/<asset-external-key>/<candidate-external-key>/
├── review.json
├── validation-metrics.json
├── candidate.geojson
├── comparison-map.html
└── report.json
```

`candidate.geojson` and `comparison-map.html` are optional. Never overwrite
acquisition artifacts. If inputs or review methods change, create a versioned
review directory or key.

## Recheck the evidence

Before computing geometry, run the `asset_identity` gate. The approved asset,
analysis, manifest, source file, candidate, instrument and jurisdiction must
refer to the same target boundary. A candidate built from another asset or state
is `rejected`, even when its coordinates are internally valid.

Then independently compare every used observation with
its cited original page, cell, row, feature, image region, or archive member.
Preserve the printed/source order. Record each observation as `confirmed`,
`mismatch`, `ambiguous`, or `not_located`.

Never silently repair digits, swap axes, reorder vertices, close a traverse,
select a CRS, fill omitted rows, or infer a perimeter from a point, area,
bounding box, place name, media map, or geocoder result. A correction is allowed
only when another cited part of the authoritative source resolves it.

## Run every review gate

Follow `references/review-gates.md` in order and record every gate as `passed`,
`failed`, `ambiguous`, or `not_applicable`, with evidence and metrics. At minimum
address:

- provenance and checksum;
- asset, instrument and jurisdiction identity;
- observation transcription and completeness;
- CRS, datum, projection zone, units, and axis order;
- geometry construction method and vertex/beacon order;
- closure, duplicate vertices, minimum vertices, self-intersection, geometry
  type, and standards/PostGIS-equivalent validity;
- stated versus computed area using an appropriate projected CRS;
- expected country, state, locality, and plausible spatial extent;
- agreement with plan imagery or an independent reference when available;
- instrument identity, effective date, amendment, revocation, correction, and
  supersession;
- full versus partial coverage and exact excluded rows/sheets/features.

Do not use `ST_MakeValid`, convex hulls, buffering, smoothing, arbitrary vertex
sorting, or clipping as proof of a legal boundary. Diagnostic repaired geometry
must never replace the source-derived candidate.

## Produce geometry conservatively

Write `candidate.geojson` only if a defensible Polygon or MultiPolygon has been
constructed in EPSG:4326. Record the original CRS and complete conversion chain
in `validation-metrics.json`. GeoJSON coordinate order is longitude, latitude.

Keep projected calculations in a suitable projected CRS. Report closure in
metres and areas in square metres, while preserving source units. Record tool,
library, EPSG definitions, precision, transformation and rounding details so the
result can be reproduced.

The comparison map is a review aid only. It must label source-derived geometry,
reference layers, approximate content and excluded/partial segments distinctly;
never imply cadastral authority from a basemap.

## Decide without activating

Write `review.json` against `references/review-v1.schema.json` using one decision:

- `accepted`: the candidate passes all applicable mandatory gates and its stated
  limitations do not misrepresent its covered boundary;
- `ambiguous`: two or more plausible interpretations remain, such as CRS, axes,
  vertex order, identity, or conflicting geometry;
- `rejected`: the candidate is demonstrably invalid, misidentified, approximate,
  superseded, corrupted, or not boundary geometry;
- `needs_corroboration`: the interpretation may be correct but required evidence
  is missing.

`accepted` does not mean legally verified, authoritative, current, complete for
the jurisdiction, or eligible for checks. Set `activationRecommended` true only
when the candidate is accepted and the reviewer has separately confirmed tier
1–2 evidence, official/legal or approved authoritative-derivative provenance,
`derived` or `authoritative` geometry quality, valid topology, explicit coverage,
and complete source/import provenance. Even then it remains a recommendation.

Set `activationRecommended` false for partial geometry unless the proposed live
feature can accurately and prominently represent that exact partial coverage.

An `accepted` decision requires every mandatory gate to be `passed` or genuinely
`not_applicable`; no gate may be `failed` or `ambiguous`. An activation
recommendation additionally requires every structured activation prerequisite
in the review contract to be true.

## Validate, report, and stop

Validate `review.json` with a JSON Schema 2020-12 validator. Validate optional
GeoJSON structurally and run geometry-validity checks without repairing it. If a
required validator is unavailable, record `not_run`; never claim a pass.

Run the semantic validator:

```bash
python3 .agents/skills/geometry-evidence-reviewer/scripts/validate_review.py \
  --approved <approved-asset.json> \
  --acquisition <acquisition-workspace> \
  --review <review-workspace>
```

`report.json` must summarize the decision, failed/ambiguous gates, candidate
geometry path, key metrics, limitations, exact next evidence needed, validation
status, and whether activation was recommended.

Present the decision and paths, then stop. Do not review a second candidate or
move the result into Dende without a new instruction.

## Mutation and concurrency boundary

This skill may read preserved evidence and write only to its ignored review
workspace. It must not:

- modify acquisition artifacts, source code, migrations, schemas, roadmap, or
  other skills;
- query a write endpoint or insert/update/delete database records;
- accept a database review queue item, create an import, or change status;
- activate geometry, enable checks/search, or describe a recommendation as live;
- broaden into new statewide research or acquire unrelated evidence;
- make title, ownership, legal-verification, or completeness claims.

These rules allow reviews to run alongside product development without shared
code, migration, or database conflicts.
