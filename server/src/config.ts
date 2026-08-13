import dotenv from "dotenv";
import path from "path";

// Load the repo-root .env (API keys + server config). __dirname is server/dist
// (compiled) or server/src (tsx), so ../.. resolves to the repo root.
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://dende:dende@localhost:5432/dende_registry",
  /** Minimum confidence (%) for a parsed reading to be auto-registered. */
  minConfidence: Number(process.env.MIN_CONFIDENCE ?? 50),
  /** Max accepted |computed - printed| / printed when validating a parse. */
  areaTolerance: Number(process.env.AREA_TOLERANCE ?? 0.05),
  // Anchored to the server package (server/.uploads), independent of cwd.
  imageUploadDir: process.env.IMAGE_UPLOAD_DIR ?? path.resolve(__dirname, "..", ".uploads"),
  maxUploadBytes: 20 * 1024 * 1024,
  /** Shared secret used only by the external discovery/extraction worker API. */
  intelligenceIngestionKey: process.env.DENDE_INTELLIGENCE_INGESTION_KEY ?? "",
  /**
   * Road-corridor buffer (meters) per OSM highway class. A plot within this
   * distance of a road centerline gets a zoning alert.
   */
  roadBuffersMeters: {
    motorway: 30,
    trunk: 30,
    primary: 25,
    secondary: 20,
    tertiary: 15,
    unclassified: 10
  } as const
};

export type RoadClass = keyof typeof config.roadBuffersMeters;
