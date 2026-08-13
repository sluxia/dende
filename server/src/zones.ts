import { query } from "./db";
import { config, RoadClass } from "./config";

export interface ViewerZone {
  layer: "roads" | "reserves";
  name: string | null;
  zoneType: string | null;
  geometry: { type: string; coordinates: unknown };
  bufferGeometry: { type: string; coordinates: unknown } | null;
}

/**
 * Loads all zones for map rendering: road corridors (line + computed buffer)
 * and reserves, transformed to EPSG:4326 GeoJSON.
 */
export async function fetchZoneLayers(): Promise<ViewerZone[]> {
  const roads = await query<{ id: number; name: string | null; highway_class: string | null }>(
    "SELECT id, name, highway_class FROM zones.roads"
  );
  const roadIds = roads.map((r) => r.id);
  const roadMeters = roads.map((r) => config.roadBuffersMeters[(r.highway_class ?? "").toLowerCase() as RoadClass] ?? 20);
  const [roadZones, reserveZones] = await Promise.all([
    roadIds.length > 0
      ? query<{
          name: string | null;
          highway_class: string | null;
          geometry: { type: string; coordinates: unknown };
          buffer_geometry: { type: string; coordinates: unknown } | null;
        }>(
          `WITH buf AS (SELECT unnest($1::int[]) AS id, unnest($2::double precision[]) AS meters)
           SELECT r.name, r.highway_class,
                  ST_AsGeoJSON(r.geometry)::jsonb AS geometry,
                  ST_AsGeoJSON(ST_Transform(ST_Buffer(r.geometry::geography, b.meters)::geometry, 4326))::jsonb AS buffer_geometry
             FROM zones.roads r JOIN buf b ON b.id = r.id`,
          [roadIds, roadMeters]
        )
      : Promise.resolve([]),
    query<{
      name: string | null;
      protection_class: string | null;
      geometry: { type: string; coordinates: unknown };
    }>("SELECT name, protection_class, ST_AsGeoJSON(geometry)::jsonb AS geometry FROM zones.reserves")
  ]);
  return [
    ...roadZones.map((r) => ({
      layer: "roads" as const,
      name: r.name,
      zoneType: r.highway_class,
      geometry: r.geometry,
      bufferGeometry: r.buffer_geometry
    })),
    ...reserveZones.map((r) => ({
      layer: "reserves" as const,
      name: r.name,
      zoneType: r.protection_class,
      geometry: r.geometry,
      bufferGeometry: null
    }))
  ];
}
