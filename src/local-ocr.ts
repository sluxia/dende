import { createWorker, PSM } from "tesseract.js";
import path from "path";
import { SupportedCRS } from "./projections";
import { ParserResult } from "./types";
import { resolveImageInput } from "./image-input";
import { enhanceImage } from "./enhance-image";

export interface LocalOcrOptions {
  enhance?: boolean;
}

const BELT_PATTERNS: Array<{ regex: RegExp; crs: SupportedCRS }> = [
  { regex: /WEST\s*BELT/i, crs: "EPSG:26391" },
  { regex: /MID\s*BELT|MIDDLE\s*BELT|CENTRAL\s*BELT/i, crs: "EPSG:26392" },
  { regex: /EAST\s*BELT/i, crs: "EPSG:26393" }
];
const ZONE_PATTERNS: Array<{ regex: RegExp; crs: SupportedCRS }> = [
  { regex: /ZONE\s*3\s*2/i, crs: "EPSG:26332" },
  { regex: /ZONE\s*3\s*1/i, crs: "EPSG:26331" }
];
// WGS 84 datum plans (common on newer plans) must NOT be treated as Minna:
// applying the Minna->WGS84 shift would displace them by ~100-200 m.
const WGS84_UTM_PATTERNS: Array<{ regex: RegExp; crs: SupportedCRS }> = [
  { regex: /WGS\s*84?.{0,20}ZONE\s*3\s*2|ZONE\s*3\s*2.{0,20}WGS\s*84/i, crs: "EPSG:32632" },
  { regex: /WGS\s*84?.{0,20}ZONE\s*3\s*1|ZONE\s*3\s*1.{0,20}WGS\s*84/i, crs: "EPSG:32631" }
];

const KNOWN_EPSG_CODES: Record<string, SupportedCRS> = {
  "26391": "EPSG:26391",
  "26392": "EPSG:26392",
  "26393": "EPSG:26393",
  "26331": "EPSG:26331",
  "26332": "EPSG:26332",
  "32631": "EPSG:32631",
  "32632": "EPSG:32632"
};

// Beacon ID token: letters + digits (e.g. PB1024), bare digits (1024), or a short letter label (A, B, PB)
const BEACON_TOKEN = /^([A-Z]{1,6}[.\s-]?\d{2,8}|\d{2,8}|[A-Z]{1,4})$/;

const EXCLUDED_BEACONS = new Set([
  "BEACON", "BEACONID", "ID", "POINT", "NO", "SN", "EASTING", "NORTHING",
  "EAST", "NORTH", "DISTANCE", "DIST", "BEARING", "BEAR", "OBS", "COORDS",
  "COORDINATE", "COORDINATES", "STATEMENT", "SURVEY", "PLAN"
]);

interface ParsedRow {
  beaconId: string;
  easting: number;
  northing: number;
  confidence: number;
}

function detectCRS(text: string): SupportedCRS | "unknown" {
  const upper = text.toUpperCase();

  // Explicit WGS 84 / UTM codes take priority (a WGS 84 datum shift would be wrong)
  const wgsCodeMatch = upper.match(/(?:3263[12])/);
  if (wgsCodeMatch) {
    const crs = KNOWN_EPSG_CODES[wgsCodeMatch[0]];
    if (crs) return crs;
  }

  // Scan for a known Minna EPSG code anywhere in the text (tolerates OCR mangling like "EPSG126391")
  const codeMatch = upper.match(/(?:2639[123]|2633[12])/);
  if (codeMatch) {
    const crs = KNOWN_EPSG_CODES[codeMatch[0]];
    if (crs) return crs;
  }
  for (const { regex, crs } of WGS84_UTM_PATTERNS) {
    if (regex.test(upper)) return crs;
  }
  for (const { regex, crs } of BELT_PATTERNS) {
    if (regex.test(upper)) return crs;
  }
  for (const { regex, crs } of ZONE_PATTERNS) {
    if (regex.test(upper)) return crs;
  }
  return "unknown";
}

function parseNumeric(token: string): number | null {
  const cleaned = token.replace(/,/g, "").replace(/\s+/g, "").replace(/^[°'"]+|[°'"]+$/g, "");
  const value = Number(cleaned);
  if (Number.isFinite(value) && value >= 50000 && value <= 2000000) {
    return value;
  }
  return null;
}

function isValidBeacon(token: string): boolean {
  if (EXCLUDED_BEACONS.has(token)) return false;
  return BEACON_TOKEN.test(token);
}

function parseRows(text: string, defaultConfidence: number): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // Prefer splitting on 2+ spaces (column boundaries), fall back to single spaces
    let tokens = line.split(/\s{2,}/);
    if (tokens.length < 3) tokens = line.split(/\s+/);
    if (tokens.length < 3) continue;

    const beaconCandidate = tokens[0].toUpperCase();
    if (!isValidBeacon(beaconCandidate)) continue;

    const easting = parseNumeric(tokens[1]);
    const northing = parseNumeric(tokens[2]);
    if (easting === null || northing === null) continue;

    rows.push({
      beaconId: beaconCandidate,
      easting,
      northing,
      confidence: defaultConfidence
    });
  }

  return rows;
}

/**
 * Parses a survey plan image using a free, local tesseract.js OCR worker.
 * Fallback path used when no Gemini API key is available. Extracts the
 * beacon coordinate table and detects the CRS from the survey stamp text.
 *
 * @param imageInput Local image file path, Buffer containing image bytes, or base64 data URL
 * @returns ParserResult with method "local-ocr" and a confidence score
 */
export async function parseSurveyImageLocal(
  imageInput: string | Buffer,
  options?: LocalOcrOptions
): Promise<ParserResult> {
  let { buffer } = resolveImageInput(imageInput);

  if (options?.enhance !== false) {
    try {
      const enhanced = await enhanceImage(buffer);
      buffer = enhanced.buffer;
    } catch (error) {
      console.warn(`⚠️ Image enhancement skipped (${(error as Error).message}); using raw image.`);
    }
  }

  const worker = await createWorker("eng", undefined, {
    // Keep the fetched traineddata cache under node_modules (gitignored).
    // NB: overriding dataPath breaks tesseract.js v7's loader, so it stays at its default.
    cachePath: path.join(__dirname, "..", "node_modules", ".cache", "tesseract.js"),
    logger: (m) => {
      if (m.status === "recognizing text") {
        process.stdout.write(`\r  OCR progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  try {
    // Let tesseract segment the page automatically; a survey plan is a
    // multi-region document (title block, stamps, coordinate table), not a
    // single text block. No char whitelist: restricting it to uppercase
    // degraded recognition badly in practice.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1"
    });

    const { data: page } = await worker.recognize(buffer);
    process.stdout.write("\n");

    const rows = parseRows(page.text, page.confidence);
    const crs = detectCRS(page.text);
    const confidence = rows.length > 0
      ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
      : page.confidence;

    return {
      crs,
      vertices: rows.map((row) => ({
        beaconId: row.beaconId,
        easting: row.easting,
        northing: row.northing
      })),
      method: "local-ocr",
      confidence: Number(confidence.toFixed(2)),
      rawText: page.text
    };
  } finally {
    await worker.terminate();
  }
}
