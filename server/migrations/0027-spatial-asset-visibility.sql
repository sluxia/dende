-- Up Migration

ALTER TABLE provenance.spatial_asset_inventory
  ADD COLUMN visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','internal','hidden'));

CREATE INDEX spatial_asset_visibility_idx
  ON provenance.spatial_asset_inventory(visibility,admin_level_1,asset_class);

-- Down Migration
DROP INDEX IF EXISTS provenance.spatial_asset_visibility_idx;
ALTER TABLE provenance.spatial_asset_inventory DROP COLUMN IF EXISTS visibility;
