import { query } from "./db";
import { config, RoadClass } from "./config";

export interface OverlapHit {
  plotId: string;
  intersectionAreaSqm: number;
  intersectionPercent: number;
}

export interface ZoningAlert {
  layer: "roads" | "reserves";
  /** FK into zones.roads / zones.reserves (zone_layer tells which). */
  zoneId: number | null;
  zoneName: string | null;
  zoneType: string | null;
  /** Distance to a road centerline in meters (roads only). */
  distanceM: number | null;
  /** Intersection area in square meters (reserves only). */
  intersectionAreaSqm: number | null;
}

export interface SpatialCheckResult {
  overlaps: OverlapHit[];
  zoningAlerts: ZoningAlert[];
  /** Geodesic area of the plot in square meters (geography cast). */
  plotAreaSqm: number;
}

/** Parses a plot GeoJSON geometry string into an EPSG:4326 MultiPolygon (inline SQL). */
const PLOT_GEOM = "ST_Multi(ST_GeomFromGeoJSON($1))";

/**
 * Overlap check (raw ST_Intersects, shared edges included per spec):
 * returns every already-registered plot whose boundary intersects the new one,
 * with the intersection area (geodesic m²) and share of the new plot.
 */
export async function checkOverlaps(
  plotGeometryJson: string,
  plotAreaSqm: number,
  excludePlotId?: string
): Promise<OverlapHit[]> {
  const rows = await query<{
    id: string;
    intersection_area_sqm: number;
  }>(
    `SELECT p.id,
            ST_Area(ST_Intersection(p.geometry, ${PLOT_GEOM})::geography) AS intersection_area_sqm
       FROM registry.plots p
      WHERE ST_Intersects(p.geometry, ${PLOT_GEOM})
        AND ($2::uuid IS NULL OR p.id <> $2::uuid)
      ORDER BY intersection_area_sqm DESC`,
    [plotGeometryJson, excludePlotId ?? null]
  );

  return rows.map((row) => ({
    plotId: row.id,
    intersectionAreaSqm: Math.round(row.intersection_area_sqm * 100) / 100,
    intersectionPercent:
      plotAreaSqm > 0 ? Math.round((row.intersection_area_sqm / plotAreaSqm) * 1000) / 10 : 0
  }));
}

/**
 * Zoning check. Road corridors are enforced with a per-class buffer from the
 * road centerline (ST_DWithin on geography); reserves use a strict
 * ST_Intersects against protected/agricultural area polygons.
 */
export async function checkZoning(plotGeometryJson: string): Promise<ZoningAlert[]> {
  const alerts: ZoningAlert[] = [];

  const maxRoadBuffer = Math.max(...Object.values(config.roadBuffersMeters));
  const roadRows = await query<{
    id: number;
    name: string | null;
    highway_class: string | null;
    distance_m: number | null;
  }>(
    `SELECT r.id,
            r.name,
            r.highway_class,
            ST_Distance(r.geometry::geography, ${PLOT_GEOM}::geography) AS distance_m
       FROM zones.roads r
      WHERE ST_DWithin(r.geometry::geography, ${PLOT_GEOM}::geography, $2)
      ORDER BY distance_m ASC`,
    [plotGeometryJson, maxRoadBuffer]
  );

  for (const row of roadRows) {
    const roadClass = (row.highway_class ?? "").toLowerCase() as RoadClass;
    const buffer = config.roadBuffersMeters[roadClass] ?? 10;
    const distanceM = row.distance_m ?? Number.POSITIVE_INFINITY;
    if (distanceM <= buffer) {
      alerts.push({
        layer: "roads",
        zoneId: row.id,
        zoneName: row.name ?? null,
        zoneType: row.highway_class ?? null,
        distanceM: Math.round(distanceM * 100) / 100,
        intersectionAreaSqm: null
      });
    }
  }

  const reserveRows = await query<{
    id: number;
    name: string | null;
    protection_class: string | null;
    landuse: string | null;
    intersection_area_sqm: number | null;
  }>(
    `SELECT r.id,
            r.name,
            r.protection_class,
            r.landuse,
            ST_Area(ST_Intersection(r.geometry, ${PLOT_GEOM})::geography) AS intersection_area_sqm
       FROM zones.reserves r
      WHERE ST_Intersects(r.geometry, ${PLOT_GEOM})
      ORDER BY intersection_area_sqm DESC`,
    [plotGeometryJson]
  );

  for (const row of reserveRows) {
    alerts.push({
      layer: "reserves",
      zoneId: row.id,
      zoneName: row.name ?? null,
      zoneType: row.protection_class ?? row.landuse ?? null,
      distanceM: null,
      intersectionAreaSqm:
        row.intersection_area_sqm == null
          ? null
          : Math.round(row.intersection_area_sqm * 100) / 100
    });
  }

  return alerts;
}

/** Runs both checks against a plot's GeoJSON geometry string. */
export async function runSpatialChecks(
  plotGeometryJson: string,
  excludePlotId?: string
): Promise<SpatialCheckResult> {
  const areaRows = await query<{ area_sqm: number }>(
    `SELECT ST_Area(${PLOT_GEOM}::geography) AS area_sqm`,
    [plotGeometryJson]
  );
  const plotAreaSqm = Math.round((areaRows[0]?.area_sqm ?? 0) * 100) / 100;
  const [overlaps, zoningAlerts] = await Promise.all([
    checkOverlaps(plotGeometryJson, plotAreaSqm, excludePlotId),
    checkZoning(plotGeometryJson)
  ]);
  return { overlaps, zoningAlerts, plotAreaSqm };
}
