# Cross River spatial acquisition rerun

Started: 13 August 2026  
Procedure: `SPATIAL_ASSET_ACQUISITION_PROCEDURE.md` v1.0  
Campaign: `ng-cross-river-spatial-rerun-v1`  
Current stage: initial validation, with government inventory continuing

## Current result

Thirteen forest-reserve/national-park targets are stored individually in
`provenance.spatial_asset_inventory`. All remain excluded from checks until their
legal boundaries are acquired and validated.

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

- Inventory assets: 13
- Source PDFs downloaded and checksummed in workspace: 2
- Geometry candidates: 0
- Check-enabled assets: 0
- Categories completed: forest reserves and national parks - initial enumeration
- Categories still to enumerate: conservation areas/community forests, wetlands
  and waterways, government layouts/estates, industrial/agricultural land,
  public institutions, transport/utility ROWs, planning zones, strategic/federal
  land, acquisitions/revocations and cadastral blocks

## Next exact actions

1. Obtain the Oban and Okwangwo polygon features and validate their provenance
   against the federal park instrument.
2. Search historical and current gazettes for each of the eleven state forest
   reserves, including separate treatment of Boshi Extension.
3. Inspect REDD+, World Bank and Forestry Commission map/data attachments for
   native GIS, coordinate tables or digitisation-grade maps.
4. Continue the government inventory through every remaining asset category
   before beginning Cross River media discovery.

## Validation log

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
