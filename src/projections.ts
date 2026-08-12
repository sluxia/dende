// Standard Coordinate Reference System definitions for Nigeria and WGS84
// Proj4 strings include towgs84 parameter transformation coefficients for Minna to WGS84 datum shift.

export const PROJECTIONS = {
  // Minna Datum - Nigeria Local Belts (Transverse Mercator)
  "EPSG:26391": "+proj=tmerc +lat_0=4 +lon_0=4.5 +k=0.99975 +x_0=230738.26 +y_0=0 +a=6378249.145 +rf=293.465 +towgs84=-93.6,-83.7,113.8,0,0,0,0 +units=m +no_defs", // West Belt
  "EPSG:26392": "+proj=tmerc +lat_0=4 +lon_0=8.5 +k=0.99975 +x_0=670553.98 +y_0=0 +a=6378249.145 +rf=293.465 +towgs84=-93.6,-83.7,113.8,0,0,0,0 +units=m +no_defs", // Mid Belt
  "EPSG:26393": "+proj=tmerc +lat_0=4 +lon_0=12.5 +k=0.99975 +x_0=1110369.7 +y_0=0 +a=6378249.145 +rf=293.465 +towgs84=-93.6,-83.7,113.8,0,0,0,0 +units=m +no_defs", // East Belt

  // Minna Datum - UTM Zones
  "EPSG:26331": "+proj=utm +zone=31 +a=6378249.145 +rf=293.465 +towgs84=-93.6,-83.7,113.8,0,0,0,0 +units=m +no_defs", // Minna / UTM zone 31N
  "EPSG:26332": "+proj=utm +zone=32 +a=6378249.145 +rf=293.465 +towgs84=-93.6,-83.7,113.8,0,0,0,0 +units=m +no_defs", // Minna / UTM zone 32N

  // WGS 84 - Standard Global GPS
  "EPSG:4326": "+proj=longlat +datum=WGS84 +no_defs", // WGS84 Geographic

  // WGS 84 - UTM Zones (No datum shift required)
  "EPSG:32631": "+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs", // WGS84 / UTM zone 31N
  "EPSG:32632": "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs"  // WGS84 / UTM zone 32N
} as const;

export type SupportedCRS = keyof typeof PROJECTIONS;

export const CRS_NAMES: Record<SupportedCRS, string> = {
  "EPSG:26391": "Minna / Nigeria West Belt",
  "EPSG:26392": "Minna / Nigeria Mid Belt",
  "EPSG:26393": "Minna / Nigeria East Belt",
  "EPSG:26331": "Minna / UTM Zone 31N",
  "EPSG:26332": "Minna / UTM Zone 32N",
  "EPSG:4326": "WGS 84 (GPS Lat/Long)",
  "EPSG:32631": "WGS 84 / UTM Zone 31N",
  "EPSG:32632": "WGS 84 / UTM Zone 32N"
};
