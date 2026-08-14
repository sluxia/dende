-- Up Migration

UPDATE provenance.spatial_acquisition_campaigns
SET status='paused',
    notes='Paused by user on 2026-08-13 after the approved Kwa Falls bundle. Current inventory: 63 assets, all excluded from checks. On resumption, resolve the statewide-inventory gate versus the later one-subject/10-15-query/explicit-approval protocol before selecting another subject.'
WHERE external_key='ng-cross-river-spatial-rerun-v1';

-- Down Migration

UPDATE provenance.spatial_acquisition_campaigns
SET status='inventory',
    notes='Cross River spatial acquisition campaign resumed; current procedure must be confirmed before further subject work.'
WHERE external_key='ng-cross-river-spatial-rerun-v1';
