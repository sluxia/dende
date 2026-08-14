# Research Agent Output Contract

Applies to every state/province spatial-acquisition research run. An agent's
entire deliverable is ONE JSON object. Anything that does not match this
contract is a failure and is discarded at validation.

Rules:

1. No prose, no markdown fences, no `task_result` wrapping inside the JSON.
   Output the JSON object alone.
2. Only the keys defined below. Unknown keys are rejected.
3. Every enum value must be exactly one of the listed values.
4. `assets` is always an array (empty if none found).
5. `target_sources` is always an array (empty if none found).
6. When the tool output would exceed ~60 KB, write the JSON to a file and
   return only `{"file": "/absolute/path.json"}` plus a one-line summary.
7. Do not invent an `external_key`: it must be a stable lowercase slug unique
   within the state, prefixed `{state}-asset-` (e.g. `fct-asset-maje-abuchi-fr`,
   `ogun-asset-omo-forest-reserve`).
8. `stated_area_sqm` is always numeric square metres, never ha/km²/string.
9. Research-only runs: `check_status` is always `excluded` and `geometry` is
   never provided. `geometry_status` is `unavailable` unless a real geometry
   candidate was located.

---

## Full output shape

```json
{
  "state": "string",
  "access_reviewed_at": "2026-08-14",
  "assets": [ <SpatialAsset>, ... ],
  "target_sources": [ <DataSource>, ... ]
}
```

---

## SpatialAsset (provenance.spatial_asset_inventory)

| key | type | required | rules |
|-----|------|----------|-------|
| `external_key` | string | yes | unique slug, prefix `{state}-asset-` |
| `asset_name` | string | yes | |
| `alternate_names` | string[] | yes | empty array if none |
| `asset_class` | enum | yes | one of the values below |
| `authority_name` | string | no | |
| `admin_level_2` | string | no | LGA / district |
| `locality` | string | no | |
| `legal_status` | enum | yes | one of the values below |
| `instrument_reference` | string | no | gazette/instrument reference |
| `survey_reference` | string | no | survey plan reference |
| `stated_area_sqm` | number | no | square metres, null if unknown |
| `source_url` | string | no | one primary URL |
| `file_url` | string | no | direct file if located |
| `geometry_status` | enum | yes | one of the values below |
| `acquisition_status` | enum | yes | one of the values below |
| `missing_material` | string | no | exactly what is needed next |
| `next_action` | string | no | concrete next step |
| `evidence_notes` | string | no | where the evidence came from |
| `risk_priority` | integer | yes | 1=high, 2=medium, 3=low |
| `risk_reason` | string | no | why the risk priority |
| `visibility` | enum | yes | `public` |

**asset_class enum:**
`forest_reserve`, `national_park`, `conservation_area`, `wetland`,
`waterway_buffer`, `government_layout`, `government_estate`, `industrial_area`,
`agricultural_scheme`, `public_institution`, `transport_right_of_way`,
`utility_right_of_way`, `planning_zone`, `strategic_land`, `acquired_land`,
`revoked_land`, `cadastral_block`, `other`

**legal_status enum:**
`reported`, `declared`, `gazetted`, `acquired`, `revoked`, `superseded`,
`unknown`

**geometry_status enum:**
`unavailable`, `located`, `extracting`, `candidate`, `valid`, `rejected`

**acquisition_status enum:**
`not_started`, `source_found`, `file_found`, `downloaded`, `access_required`,
`under_review`, `complete`, `blocked`

`check_status` is set by the system to `excluded` for research-only rows and is
not accepted from the agent.

---

## DataSource (provenance.data_sources)

| key | type | required | rules |
|-----|------|----------|-------|
| `type` | enum | yes | one of the values below |
| `name` | string | yes | |
| `provider` | string | no | |
| `admin_level_1` | string | yes | state name |
| `format` | string | no | e.g. `mixed`, `geojson`, `wfs` |
| `source_url` | string | no | |
| `license` | string | no | note: column is `license` (not `licence`) |
| `authority_level` | enum | yes | `official` for state/federal custodians |
| `status` | enum | yes | `planned` for research-only |
| `coverage_status` | enum | yes | `unavailable` for research-only |
| `access_stage` | enum | yes | one of the values below |
| `access_method` | string | no | how access is obtained |
| `access_contact` | string | no | contact email/phone |
| `access_notes` | string | no | findings from the research run |
| `access_reviewed_at` | string | yes | ISO date `2026-08-14` |
| `description` | string | no | |

`country_code` is set by the system to `NG`.

**type enum:** `road`, `reserve`, `cadastral`, `user_plot`, `survey`, `other`

**authority_level enum:** `official`, `open_data`, `commercial`,
`user_submitted`, `internal_test`

**status enum:** `planned`, `active`, `partial`, `stale`, `test`, `archived`

**coverage_status enum:** `complete`, `partial`, `stale`, `unavailable`,
`test_only`

**access_stage enum:** `authority_identified`, `portal_found`, `access_required`,
`dataset_found`, `under_review`, `usable`, `unavailable`

A portal is never a dataset. If only an authenticated portal/paid service was
found, use `access_stage = "access_required"`. Use `dataset_found` only when a
real downloadable layer, WFS, API or file was located.
