---
name: sourcer
description: Research Nigerian state or regional government land assets, allocations, acquisitions, reserves, layouts, rights-of-way, planning zones, and related boundary evidence. Use when selecting the next unresearched jurisdiction, running Dende's 21-query statewide discovery pass, investigating inventory items one at a time, locating files or coordinates, or producing validated Dende research JSON. Do not use for activating geometry or making title/ownership claims.
---

# Source land records

Work on one jurisdiction and one inventory item at a time. Treat discovery,
inventory, document extraction, geometry validation, and check activation as
separate stages.

## Read before acting

Read these project sources completely:

1. `README.md` and `ROADMAP.md` for mission and current pauses.
2. `docs/SPATIAL_ASSET_ACQUISITION_PROCEDURE.md` for the binding work order.
3. `docs/AGENT_OUTPUT_CONTRACT.md` for the final inventory contract.
4. `docs/schemas/land-analysis-v1.schema.json` when a file contains numerics,
   coordinates, bearings, beacons, survey references, or geometry.
5. `docs/INTELLIGENCE_WORKER_API.md` only when preparing worker ingestion.
6. `references/queries.md` for the mandatory 21-query discovery pass.
7. `references/output-example.json` and
   `references/subject-analysis-example.json` before writing JSON.
8. `references/run-state.schema.json`, `references/query-log.schema.json`, and
   `references/approved-asset.schema.json` before creating a run.

Project instructions and an explicit user instruction override this skill.

## Select the next jurisdiction

Use the live database as the canonical jurisdiction list. It is populated from
`provenance.data_sources` by `server/migrations/0012-nigeria-authoritative-source-catalog.sql`.
Do not maintain a second state list in this skill.

Run a read-only query equivalent to:

```sql
WITH jurisdictions AS (
  SELECT DISTINCT admin_level_1
  FROM provenance.data_sources
  WHERE country_code='NG' AND admin_level_1 IS NOT NULL
), researched AS (
  SELECT DISTINCT admin_level_1
  FROM provenance.spatial_acquisition_campaigns
  WHERE country_code='NG' AND scope='state'
)
SELECT j.admin_level_1
FROM jurisdictions j
LEFT JOIN researched r USING(admin_level_1)
WHERE r.admin_level_1 IS NULL
ORDER BY j.admin_level_1
LIMIT 1;
```

Treat any jurisdiction with a campaign row as already started, regardless of
quality or completion. Never silently rerun it. If no database is available,
read migration `0012` and subtract state campaigns found in
`provenance.spatial_acquisition_campaigns`; clearly mark this as a fallback.

If the user names a state, use it unless the roadmap pauses or forbids it. If
the user says to continue generally, choose the query result deterministically.
Never research multiple states concurrently. Before selecting or creating a
run, execute:

```bash
python3 .agents/skills/sourcer/scripts/validate_run.py \
  --research-root tmp/research --check-lock --state <state-key>
```

The command must fail when another `run-state.json` is `active`. A legacy run
without `run-state.json` is not silently considered complete: inspect it and
create an accurate state file before continuing.

## Create the temporary workspace

Use this ignored, disposable location:

```text
tmp/research/<YYYY-MM-DD>-<state-key>/
├── run-state.json
├── query-log.json
├── inventory-working.json
├── final-output.json
├── subjects/
│   └── <asset-external-key>.json
├── analyses/
│   └── <asset-external-key>-analysis.json
└── downloads/
```

Create `run-state.json` first, following `references/run-state.schema.json`.
Use `active` while working, `paused` only on an explicit pause, and `completed`
only after the final output validates and is presented. The file records counts
for inventoried, researching, blocked and completed assets; inventory is never
presented as completed subject research.

Use lowercase stable state keys: `abia`, `akwaibom`, `crossriver`, `fct`, and
so on. Temporary files are research staging, not database records. Do not place
downloaded files or working notes in migrations or application source folders.

## Phase 1: run the statewide 21-query pass

Run every query group in `references/queries.md` in order. Do not stop after a
few promising results. Use official sources first; the twenty-first media query
comes only after the government and authoritative-source pass.

After each query group, append exactly one entry to `query-log.json`. It contains
the group metadata and a nested `results` array. Never create one top-level log
entry per search result. Each group entry contains:

- `query_number`, `query_group`, exact `queries_run`, and `searched_at`;
- within each result: result URL, direct file URL when different, title,
  publisher, date, and type;
- authority classification, access stage, file format, and licence if known;
- named assets, instrument/survey references, stated areas, coordinate clues;
- negative result or access barrier when nothing usable was found;
- no copied claims without a supporting URL.

The completed log must have exactly 21 unique entries numbered 1–21 and validate
against `references/query-log.schema.json`.

Never label a website, portal, dashboard, or search form as a dataset. Use
`dataset_found` only for an actual downloadable file, documented API, WFS/WMS,
ArcGIS layer, or native spatial service.

## Phase 2: normalize the inventory

Deduplicate names and aliases without merging distinct legal assets. Keep
extensions, divisions, phases, schemes, rights-of-way, ceded parcels, residual
land, and disputed versions separate unless an authoritative instrument proves
they are identical.

Write the evolving state object to `inventory-working.json`. Include all asset
categories searched, including explicit negative results in `query-log.json`.
Every asset must state its missing boundary material and next exact action.

Set research records to:

- `visibility: "public"` unless sensitivity requires internal handling;
- `geometry_status: "unavailable"` unless a real geometry-bearing source was
  located; a place point or stated area is not geometry;
- `acquisition_status` based on what actually exists;
- `risk_priority` from encroachment/fraud exposure and likely buyer confusion;
- check eligibility excluded by the receiving system.

## Phase 3: investigate one inventory item at a time

Pick the highest-priority unresolved asset, breaking ties by canonical name.
Finish or explicitly block it before opening the next item.

For the selected asset:

1. Search its canonical name, aliases, authority, locality, instrument, survey
   reference, title/layout number, and stated area.
2. Find the constituting law/gazette, acquisition/revocation notice, deposited
   plan, survey/beacon schedule, allocation list, approved layout, or native GIS.
3. Search at least PDF, image, Word, spreadsheet/delimited, native geospatial,
   HTML/API, and archive families where relevant.
4. Store discovery URLs separately from direct file URLs.
5. Download permitted files to `downloads/`; preserve filenames and calculate
   SHA-256 checksums. Never bypass authentication or access controls.
6. Inspect every relevant page, sheet, table, map, attachment, archive member,
   or service layer. OCR scans when text extraction fails.
7. Extract raw coordinates, bearings, distances, areas, beacons, plot/layout,
   survey/title numbers, CRS clues, page/sheet/cell locators, and confidence.
8. Never repair or guess corrupted digits, CRS, axis order, vertex order, or
   topology. Record ambiguity and continue searching for corroboration.
9. Write the item to `subjects/<external-key>.json`. If numerics or geometry
   were found, also write a `land-analysis/v1` object under `analyses/` using
   `references/subject-analysis-example.json`.
10. Merge the improved asset into `inventory-working.json`, then select the
    next unresolved item.

Update the asset counters in `run-state.json` at every transition. An asset may
be `inventoried`, `researching`, `blocked`, or `completed`; there is at most one
`researching` asset. Do not open the next subject until the current subject file
exists and its state is `completed` or `blocked`.

Coordinates discovered in documents belong in analysis observations, not in
the inventory asset object. Geometry candidates remain quarantined and
unreviewed. Never create a polygon from a centre point, approximate locality,
stated area, media map, bounding box, or geocoder result.

## Phase 4: produce consistent output

Write exactly one final inventory object to `final-output.json`, following
`docs/AGENT_OUTPUT_CONTRACT.md` and `references/output-example.json`.

The final `state` value is the lowercase external-key prefix (`abia`, `fct`,
`akwaibom`), while each target source uses the canonical jurisdiction name in
`admin_level_1`. Do not add query logs, coordinate observations, prose, or
unknown keys to `final-output.json`; those remain in their dedicated files.

Validate without applying anything to the database:

```bash
npx tsx server/scripts/ingest-research-output.ts \
  tmp/research/<run>/final-output.json \
  tmp/research/<run>/validated
```

This validator may generate a temporary SQL file under the same ignored run
directory. It does not authorize applying that SQL.

Also run the deterministic skill validator:

```bash
python3 .agents/skills/sourcer/scripts/validate_run.py \
  --run tmp/research/<run>
```

Before handing an asset to acquisition, write
`handoffs/<asset-external-key>-approved.json` against
`references/approved-asset.schema.json`. It must identify exactly one asset,
jurisdiction and approved retrieval target. Discovery does not imply approval.

## Approval and mutation boundary

Research autonomously inside `tmp/research/<run>/`. Do not create or edit a
production migration, call a write endpoint, import a dataset, update campaign
status, or insert database records without explicit user approval of the final
JSON. Present:

- selected jurisdiction and why it was next;
- confirmation that all 21 query groups ran;
- inventory counts by class and risk priority;
- files and coordinate-bearing materials found;
- assets with candidate, ambiguous, or missing geometry;
- exact temporary paths;
- validation result and remaining gaps.

Stop after presenting the state output. Wait for approval before ingestion or
starting another state.

## Non-negotiable safety rules

- A portal is not a dataset; a news report is not boundary evidence.
- A coordinate point is not a parcel or reserve boundary.
- Searchability is not check eligibility.
- Research output never activates geometry.
- Preserve contradictory evidence; do not choose the convenient version.
- Record source authority, dates, licences, access barriers, and limitations.
- Do not claim title, ownership, verification, completeness, or state coverage.
- Do not expose credentials, private contact data, or restricted documents.
- Do not create helper scripts, caches or bytecode in the run root. Put reusable
  code in the skill's versioned `scripts/`; put disposable tool output under the
  selected subject workspace and exclude `__pycache__`.
