# Mandatory geometry review gates

Run gates in this order. Every gate needs a status, concise reason, and cited
evidence. `accepted` requires every applicable mandatory gate to pass.

## 1. Provenance integrity

- Match `assetExternalKey`, candidate key, original path and SHA-256.
- Confirm the reviewed bytes are the acquired bytes.
- Confirm source URL, publisher/authority, date and licence/access notes.

## 2. Asset identity

- Match approved asset key and name, source document identity, instrument,
  source jurisdiction, analysis asset key and candidate key.
- Reject another asset's example geometry even if it illustrates the same
  registry, software, survey method or CRS.
- Require every candidate-linked observation source to support this target
  boundary in the acquisition manifest.

## 3. Observation fidelity

- Locate every used observation in the preserved source.
- Compare labels, signs, decimals, units and printed order exactly.
- Confirm the input set is complete for the claimed full or partial boundary.
- Identify excluded rows, pages, sheets, layers and archive members.

## 4. CRS and coordinate semantics

- Resolve datum, projection, zone/belt, EPSG candidate, units and axis order.
- Separate explicit source statements from inference and corroboration.
- Test plausible alternatives when ambiguity could materially move geometry.
- Reject projected values inserted directly as WGS84.

## 5. Construction

- State the method: native boundary, coordinate table, tied traverse,
  georeferenced digitization, or linked dataset.
- Confirm vertex/beacon sequence and ring closure from evidence.
- Require a known start/control for bearing traverses when absolute placement is
  claimed.

## 6. Geometric validity

- Polygon/MultiPolygon only for boundary candidates.
- Minimum ring vertices, closed rings and valid nesting.
- No unexplained duplicate consecutive vertices or zero-length segments.
- No self-intersections, spikes, bow-ties or invalid holes.
- Record standards/PostGIS-equivalent validity and diagnostic reason.

## 7. Closure and topology

- Calculate traverse closure where applicable and state tolerance rationale.
- Check beacon/segment continuity and missing rows.
- Never force closure; report the observed error.

## 8. Area agreement

- Preserve stated area and unit.
- Compute geodesic/projected area using a documented suitable method.
- Report absolute and percentage difference.
- Explain tolerance based on source precision, not a universal magic number.

## 9. Geographic plausibility

- Confirm country and expected state/locality.
- Detect swapped axes, wrong hemisphere, wrong projection zone and implausible
  scale/extent.
- Basemap agreement is corroboration, never legal boundary proof.

## 10. Instrument and currency

- Match the candidate to the correct plan, schedule, instrument and asset.
- Check effective dates, amendments, corrections, revocations and supersession.
- Preserve contradictions rather than selecting a convenient version.

## 11. Coverage and activation prerequisites

- Classify coverage as `full`, `partial`, or `unknown`.
- For partial coverage, enumerate exact inclusions and exclusions.
- Separately assess evidence tier, authority, geometry quality, provenance and
  currency. A technically valid polygon can still be unsuitable for checks.
