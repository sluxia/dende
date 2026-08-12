import proj4 from "proj4";
import { PROJECTIONS, SupportedCRS } from "./projections";

// Register all supported projections with proj4
Object.entries(PROJECTIONS).forEach(([crs, projString]) => {
  proj4.defs(crs, projString);
});

export interface TranslationOptions {
  // Allow overriding default towgs84 values (e.g., "-92,-93,122" or specific geocentric parameters)
  customToWGS84?: string;
}

/**
 * Converts a single set of projected coordinates (Easting/Northing) to a target Coordinate Reference System.
 * Defaults to WGS 84 (GPS Latitude/Longitude).
 * 
 * @param easting The Easting coordinate (X)
 * @param northing The Northing coordinate (Y)
 * @param sourceCRS The source Coordinate Reference System (e.g. "EPSG:26391")
 * @param targetCRS The target Coordinate Reference System (defaults to "EPSG:4326")
 * @param options Translation options
 * @returns An object containing the converted coordinates { longitude, latitude }
 */
export function convertCoordinate(
  easting: number,
  northing: number,
  sourceCRS: SupportedCRS,
  targetCRS: SupportedCRS = "EPSG:4326",
  options?: TranslationOptions
): { longitude: number; latitude: number } {
  let finalSourceCRS: string = sourceCRS;

  // If a custom datum shift is provided, modify the proj4 definition dynamically
  if (options?.customToWGS84 && sourceCRS in PROJECTIONS) {
    const baseProj: string = PROJECTIONS[sourceCRS];
    // Replace default +towgs84 or append if not present
    let modifiedProj: string = baseProj;
    if (baseProj.includes("+towgs84=")) {
      modifiedProj = baseProj.replace(/\+towgs84=[^\s]+/, `+towgs84=${options.customToWGS84}`);
    } else {
      modifiedProj = `${baseProj} +towgs84=${options.customToWGS84}`;
    }

    const tempCrsKey = `${sourceCRS}_custom_${Date.now()}`;
    proj4.defs(tempCrsKey, modifiedProj);
    finalSourceCRS = tempCrsKey;
  }

  // proj4 takes coordinates as [X, Y] (Easting, Northing) and returns [X, Y] (Longitude, Latitude)
  const [longitude, latitude] = proj4(finalSourceCRS, targetCRS, [easting, northing]);

  return { longitude, latitude };
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // Array of rings containing [longitude, latitude] points
}

/**
 * Translates an array of projected vertices (Easting/Northing boundary corners) into a GeoJSON Polygon.
 * Ensures the polygon boundary is closed to comply with the GeoJSON specification (RFC 7946).
 * 
 * @param vertices Array of coordinates as [easting, northing]
 * @param sourceCRS The source Coordinate Reference System
 * @param options Translation options
 * @returns A GeoJSON Polygon object in WGS84
 */
export function convertPolygon(
  vertices: [number, number][],
  sourceCRS: SupportedCRS,
  options?: TranslationOptions
): GeoJSONPolygon {
  if (vertices.length < 3) {
    throw new Error("A polygon requires at least 3 vertices.");
  }

  // Convert each vertex to WGS 84 [longitude, latitude]
  const convertedPoints: number[][] = vertices.map(([easting, northing]) => {
    const { longitude, latitude } = convertCoordinate(easting, northing, sourceCRS, "EPSG:4326", options);
    return [longitude, latitude];
  });

  // GeoJSON specifications require the first and last points to be identical
  const firstPoint = convertedPoints[0];
  const lastPoint = convertedPoints[convertedPoints.length - 1];
  
  if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
    convertedPoints.push([...firstPoint]);
  }

  return {
    type: "Polygon",
    coordinates: [convertedPoints]
  };
}

export { PROJECTIONS, CRS_NAMES } from "./projections";
export type { SupportedCRS } from "./projections";
