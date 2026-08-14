# Evidence acquisition handoff

Input is exactly one schema-valid `approved-research-asset/v1` file produced by
the sourcer skill. It can approve one file or an explicit multi-file evidence
bundle. Every acquired file must correspond to one approved retrieval target.

The acquisition manifest follows `acquisition-manifest/v1` and
`acquisition-manifest.schema.json`. Its `files` array is the only file inventory;
do not add ad-hoc `additionalFiles` fields.

Each file records:

- a stable `fileKey`, retrieval/provenance facts and exact checksum;
- detected and declared types;
- `relationship`: `primary`, `corroborating`, or `unrelated_example`;
- the file's actual jurisdiction when known;
- `supportsTargetBoundary`, which is true only when this file contains or links
  boundary evidence for the approved target asset itself;
- whether visual inspection is required and whether it was completed.

The manifest-level relevance decision is:

- `relevant`: the acquired material is demonstrably about the approved target;
- `ambiguous`: identity or relationship remains unresolved;
- `unrelated`: the acquired material is for another asset or jurisdiction.

Mentioning an authority, registry or process does not make a document the target
dataset. An example parcel from another state is `unrelated_example`, even when
it demonstrates the same software or coordinate system.

`analysis.json` remains `land-analysis/v1`. It must include
`diagnostics.observationSources`, keyed by every observation external key:

```json
{
  "observation-key": {
    "fileKey": "file-001",
    "relationship": "primary",
    "countryCode": "NG",
    "adminLevel1": "Cross River",
    "supportsTargetBoundary": true
  }
}
```

Contextual observations may be retained, but a geometry candidate can link only
observations whose source mapping supports the target boundary.
