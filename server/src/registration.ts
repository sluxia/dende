import fs from "fs";
import path from "path";
import { parseSurveyImage, convertPolygon, ParserResult, SupportedCRS } from "@sluxia/dende-core";
import { config } from "./config";
import { query } from "./db";
import { runSpatialChecks, OverlapHit, ZoningAlert } from "./spatial";
import { recordCheckRun, upsertViolations } from "./violations";
import { collectConsultedSources, ConsultedSource } from "./check-evidence";

export class RegistrationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface RegisteredPlot {
  id: string;
  status: string;
  method: string | null;
  confidence: number | null;
  crs: string | null;
  computedAreaSqm: number | null;
  printedAreaSqm: number | null;
  sourceFile: string | null;
  createdAt: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  isGood: boolean;
}

export interface RegistrationResult {
  plot: RegisteredPlot;
  plotAreaSqm: number;
  overlaps: OverlapHit[];
  zoningAlerts: ZoningAlert[];
  /** Violation case ids created/updated for this registration. */
  violations: string[];
  consultedSources: ConsultedSource[];
}

interface PlotRow {
  id: string;
  status: string;
  method: string | null;
  confidence: number | null;
  crs: string | null;
  computed_area_sqm: number | null;
  printed_area_sqm: number | null;
  source_file: string | null;
  created_at: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

/**
 * Full registration pipeline: parse the survey plan image with the vision
 * pipeline (gemini → groq → mistral), convert the extracted vertices to
 * WGS84 GeoJSON, persist the plot, then run the overlap and zoning checks.
 *
 * Rejects readings that failed the geometry checks unless `allowLowConfidence`
 * is true (best-effort parses are capped at 50% confidence by the parser).
 */
export async function registerPlot(
  imageInput: string | Buffer,
  options: { sourceFile?: string; allowLowConfidence?: boolean; ownerUserId?: string | null } = {}
): Promise<RegistrationResult> {
  const result: ParserResult = await parseSurveyImage(imageInput, {
    areaTolerance: config.areaTolerance
  });

  const passed =
    result.isGood === true &&
    (result.confidence === undefined || result.confidence >= config.minConfidence);

  if (!passed && !options.allowLowConfidence) {
    throw new RegistrationError(
      `Reading failed geometry checks (${result.vertices.length} vertices, confidence ${result.confidence?.toFixed(0) ?? "n/a"}%). ` +
        "Re-upload a clearer scan, or pass allowLowConfidence=true to register anyway.",
      422
    );
  }
  if (result.crs === "unknown" || result.vertices.length < 3) {
    throw new RegistrationError(
      `Cannot register: CRS is '${result.crs}' or fewer than 3 vertices extracted.`,
      422
    );
  }

  const vertices: [number, number][] = result.vertices.map((v) => [v.easting, v.northing]);
  const geometry = convertPolygon(vertices, result.crs);

  // Run checks against the geometry BEFORE inserting, so a plot never flags an
  // overlap with itself. The checks query only already-registered plots.
  const checks = await runSpatialChecks(JSON.stringify(geometry));
  const consultedSources = await collectConsultedSources();

  const source = await query<{ id: string }>(
    `SELECT id FROM provenance.data_sources WHERE type = 'survey' ORDER BY created_at ASC LIMIT 1`
  );
  const sourceId = source[0]?.id ?? null;
  const imports = sourceId
    ? await query<{ id: string }>(
        `INSERT INTO provenance.data_imports
           (source_id, filename, file_type, record_count, imported_by, status)
         VALUES ($1, $2, 'survey_scan', 1, 'system:survey-upload', 'complete') RETURNING id`,
        [sourceId, options.sourceFile ?? null]
      )
    : [];
  const importId = imports[0]?.id ?? null;

  const rows = await query<PlotRow>(
    `INSERT INTO registry.plots
       (status, method, confidence, crs, computed_area_sqm, printed_area_sqm, source_file,
        raw_vertices, geometry, record_type, source_id, import_id, owner_user_id, created_by_user_id)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7, $8::jsonb,
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($9), 4326)), 'survey_submission', $10, $11, $12, $12)
     RETURNING id, status, method, confidence, crs, computed_area_sqm, printed_area_sqm, source_file, created_at,
               ST_AsGeoJSON(geometry)::jsonb AS geometry`,
    [
      passed ? "active" : "low_confidence",
      result.method,
      result.confidence ?? null,
      result.crs,
      result.computedAreaSqm ?? null,
      result.printedAreaSqm ?? null,
      options.sourceFile ?? null,
      JSON.stringify(result.vertices),
      JSON.stringify(geometry),
      sourceId,
      importId
      ,options.ownerUserId ?? null
    ]
  );
  const plotRow = rows[0];

  const checkRunId = await recordCheckRun({
    plotId: plotRow.id,
    trigger: "registration",
    sourceUpload: options.sourceFile ?? null,
    parseMethod: result.method,
    confidence: result.confidence ?? null,
    plotAreaSqm: checks.plotAreaSqm,
    overlaps: checks.overlaps,
    zoningAlerts: checks.zoningAlerts,
    consultedSources
  });
  const violationIds = await upsertViolations(
    plotRow.id,
    checkRunId,
    checks.overlaps,
    checks.zoningAlerts,
    checks.plotAreaSqm
  );

  return {
    plot: {
      id: plotRow.id,
      status: plotRow.status,
      method: plotRow.method,
      confidence: plotRow.confidence,
      crs: plotRow.crs,
      computedAreaSqm: plotRow.computed_area_sqm,
      printedAreaSqm: plotRow.printed_area_sqm,
      sourceFile: plotRow.source_file,
      createdAt: plotRow.created_at,
      geometry: plotRow.geometry,
      isGood: passed
    },
    plotAreaSqm: checks.plotAreaSqm,
    overlaps: checks.overlaps,
    zoningAlerts: checks.zoningAlerts,
    violations: violationIds,
    consultedSources
  };
}

/** Persists a multi-part image upload to the uploads directory. */
export async function saveUpload(buffer: Buffer, originalName: string): Promise<string> {
  const dir = path.resolve(config.imageUploadDir);
  await fs.promises.mkdir(dir, { recursive: true });
  const ext = path.extname(originalName) || ".png";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext.toLowerCase()}`;
  const filePath = path.join(dir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

export interface ManualPlotResult {
  registered: boolean;
  plot: RegisteredPlot | null;
  plotAreaSqm: number;
  overlaps: OverlapHit[];
  zoningAlerts: ZoningAlert[];
  /** Violation case ids created/updated (empty when not registered). */
  violations: string[];
  consultedSources: ConsultedSource[];
}

/**
 * Registers (or merely checks) a plot entered as boundary-corner coordinates.
 * Vertices are [easting, northing] in the given CRS — for WGS84 GPS input that
 * means [longitude, latitude] with crs "EPSG:4326". Converts to a GeoJSON
 * polygon, runs the overlap + zoning checks, and — when `register` is true —
 * persists the plot exactly like an image-scan registration.
 */
export async function registerPlotFromCoordinates(
  vertices: [number, number][],
  crs: SupportedCRS,
  options: {
    label?: string;
    register?: boolean;
    recordType?: "manual_submission" | "ownership_notice" | "reference_test";
    ownerUserId?: string | null;
  } = {}
): Promise<ManualPlotResult> {
  if (vertices.length < 3) {
    throw new RegistrationError("A polygon requires at least 3 corner coordinates.", 400);
  }
  for (const [x, y] of vertices) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RegistrationError("All corner coordinates must be finite numbers.", 400);
    }
  }

  const geometry = convertPolygon(vertices, crs);
  // Checks run before insert so a registering plot never flags itself.
  const checks = await runSpatialChecks(JSON.stringify(geometry));
  const consultedSources = await collectConsultedSources();

  if (!options.register) {
    return {
      registered: false,
      plot: null,
      plotAreaSqm: checks.plotAreaSqm,
      overlaps: checks.overlaps,
      zoningAlerts: checks.zoningAlerts,
      violations: [],
      consultedSources
    };
  }

  const rawVertices = vertices.map(([x, y], i) => ({
    beaconId: `PT-${i + 1}`,
    easting: x,
    northing: y
  }));
  const recordType = options.recordType ?? "manual_submission";
  const sourceName = recordType === "ownership_notice"
    ? "Dende ownership notices"
    : recordType === "reference_test"
      ? "Dende manual development plots"
      : "Dende manual submissions";
  const rows = await query<PlotRow>(
    `INSERT INTO registry.plots
       (status, method, confidence, crs, computed_area_sqm, printed_area_sqm, source_file,
        raw_vertices, geometry, record_type, source_id, owner_user_id, created_by_user_id)
     VALUES
       ('active', 'manual', NULL, $1, $2, NULL, $3, $4::jsonb,
        ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)), $6,
        (SELECT id FROM provenance.data_sources WHERE name = $7 ORDER BY created_at ASC LIMIT 1), $8, $8)
     RETURNING id, status, method, confidence, crs, computed_area_sqm, printed_area_sqm, source_file, created_at,
               ST_AsGeoJSON(geometry)::jsonb AS geometry`,
    [
      crs,
      checks.plotAreaSqm,
      options.label ?? "manual",
      JSON.stringify(rawVertices),
      JSON.stringify(geometry),
      recordType,
      sourceName
      ,options.ownerUserId ?? null
    ]
  );
  const plotRow = rows[0];

  const checkRunId = await recordCheckRun({
    plotId: plotRow.id,
    trigger: "registration",
    sourceUpload: options.label ?? null,
    parseMethod: "manual-coordinates",
    confidence: null,
    plotAreaSqm: checks.plotAreaSqm,
    overlaps: checks.overlaps,
    zoningAlerts: checks.zoningAlerts,
    consultedSources
  });
  const violationIds = await upsertViolations(
    plotRow.id,
    checkRunId,
    checks.overlaps,
    checks.zoningAlerts,
    checks.plotAreaSqm
  );

  return {
    registered: true,
    plot: {
      id: plotRow.id,
      status: plotRow.status,
      method: plotRow.method,
      confidence: plotRow.confidence,
      crs: plotRow.crs,
      computedAreaSqm: plotRow.computed_area_sqm,
      printedAreaSqm: plotRow.printed_area_sqm,
      sourceFile: plotRow.source_file,
      createdAt: plotRow.created_at,
      geometry: plotRow.geometry,
      isGood: true
    },
    plotAreaSqm: checks.plotAreaSqm,
    overlaps: checks.overlaps,
    zoningAlerts: checks.zoningAlerts,
    violations: violationIds,
    consultedSources
  };
}
