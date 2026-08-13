import { ParserOptions, ParserResult, VisionProviderId } from "./types";
import { parseSurveyImageLocal } from "./local-ocr";
import { resolveImageInput } from "./image-input";
import { enhanceImage } from "./enhance-image";
import { computeTraverseVertices } from "./traverse";
import { GeminiProvider, GroqProvider, MistralProvider, VisionProvider } from "./vision";
import { PROJECTIONS, SupportedCRS } from "./projections";

// Define the response JSON schema for Gemini Structured Output
const surveyDataSchema = {
  type: "object",
  properties: {
    crs: {
      type: "string",
      description: "The Coordinate Reference System (CRS) code stated on the survey plan. Minna datum (Nigeria local belts / Minna UTM): EPSG:26391 (West Belt), EPSG:26392 (Mid Belt), EPSG:26393 (East Belt), EPSG:26331 (Minna/UTM 31N), EPSG:26332 (Minna/UTM 32N). WGS 84 datum UTM: EPSG:32631 (WGS84/UTM 31N), EPSG:32632 (WGS84/UTM 32N). Check the stated DATUM carefully: if the plan says DATUM WGS 84 (or WGS84) with a UTM zone, return the 326xx code; only return 263xx codes when the plan states Minna datum or a Nigerian belt. If none is found or it is unclear, return 'unknown'."
    },
    vertices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          beaconId: {
            type: "string",
            description: "The unique identifier of the beacon, boundary corner, or boundary point (e.g. PB1024)"
          },
          easting: {
            type: "number",
            description: "The Easting (X) coordinate value"
          },
          northing: {
            type: "number",
            description: "The Northing (Y) coordinate value"
          }
        },
        required: ["beaconId", "easting", "northing"]
      },
      description: "The list of boundary coordinates defining the land parcel, ordered sequentially as listed on the survey plan's beacon statement table. Empty if the plan has no coordinate table and instead uses an origin coordinate with bearing/distance traverse legs."
    },
    origin: {
      type: "object",
      properties: {
        beaconId: {
          type: "string",
          description: "Beacon ID of the anchor beacon whose coordinates are printed, if the origin/reference coordinate belongs to a beacon"
        },
        easting: {
          type: "number",
          description: "The origin Easting (X) coordinate value printed on the plan"
        },
        northing: {
          type: "number",
          description: "The origin Northing (Y) coordinate value printed on the plan"
        }
      },
      description: "The printed origin/reference coordinate of the plan. Populate when no beacon statement table exists and the plan provides an origin coordinate plus bearing/distance traverse legs around the boundary."
    },
    legs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fromBeaconId: {
            type: "string",
            description: "Beacon ID at the start of this leg"
          },
          toBeaconId: {
            type: "string",
            description: "Beacon ID at the end of this leg"
          },
          bearingDeg: {
            type: "number",
            description: "Survey bearing in decimal degrees, measured clockwise from grid north"
          },
          distanceM: {
            type: "number",
            description: "Leg distance in meters"
          }
        },
        required: ["bearingDeg", "distanceM"]
      },
      description: "Ordered traverse legs connecting adjacent beacons around the boundary loop, starting from the origin/anchor beacon. Include the final closing leg back to the first beacon if it is printed on the plan."
    },
    areaSqm: {
      type: "number",
      description: "The area printed on the survey plan (e.g. 458.197 SQ. M.), in square meters. Populate if the plan prints an AREA value; omit otherwise."
    }
  },
  required: ["crs", "vertices"]
};

interface ParsedTraverseLeg {
  fromBeaconId?: string;
  toBeaconId?: string;
  bearingDeg: number;
  distanceM: number;
}

interface ParsedGeminiResponse {
  crs: ParserResult["crs"];
  vertices: ParserResult["vertices"];
  origin?: { beaconId?: string; easting: number; northing: number };
  legs?: ParsedTraverseLeg[];
  areaSqm?: number;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeCRS(value: unknown): ParserResult["crs"] {
  if (typeof value === "string") {
    const trimmed = value.trim().toUpperCase();
    if ((PROJECTIONS as Record<string, unknown>)[trimmed]) {
      return trimmed as SupportedCRS;
    }
    const codeMatch = trimmed.match(/(\d{4,5})/);
    if (codeMatch) {
      const withPrefix = `EPSG:${codeMatch[1]}`;
      if ((PROJECTIONS as Record<string, unknown>)[withPrefix]) {
        return withPrefix as SupportedCRS;
      }
    }
  }
  return "unknown";
}

const SURVEY_DATA_SCHEMA_DESCRIPTION = `Return a JSON object with this shape:
{
  "crs": "<string: the CRS EPSG code stated on the plan — Minna datum: 26391/26392/26393 (Nigeria West/Mid/East Belt), 26331/26332 (Minna UTM 31N/32N); WGS 84 datum with a UTM zone: 32631/32632 (WGS84 UTM 31N/32N). Check the stated DATUM carefully — only return 263xx codes when the plan states Minna datum or a Nigerian belt; if the plan says DATUM WGS 84 use 326xx. If none/unclear return 'unknown'>",
  "vertices": [
    {
      "beaconId": "<string>",
      "easting": <number>,
      "northing": <number>
    }
  ],
  "origin": {
    "beaconId": "<string, optional>",
    "easting": <number>,
    "northing": <number>
  },
  "legs": [
    {
      "fromBeaconId": "<string, optional>",
      "toBeaconId": "<string, optional>",
      "bearingDeg": <number>,
      "distanceM": <number>
    }
  ],
  "areaSqm": <number, optional: the area printed on the plan, e.g. 458.197>
}`;

/**
 * Extracts the beacon coordinate table and CRS using a vision model.
 * Primary path, used when a vision API key is available.
 */
async function parseSurveyImageWithVision(
  imageInput: string | Buffer,
  options?: ParserOptions
): Promise<ParserResult> {
  const providers = selectVisionProviders(options);
  if (providers.length === 0) {
    throw new Error(
      "No vision provider API key configured. Provide options.apiKey or set one of GEMINI_API_KEY, MISTRAL_API_KEY, or GROQ_API_KEY."
    );
  }

  const { buffer, mimeType } = resolveImageInput(imageInput);

  let imageBuffer = buffer;
  let imageMimeType = mimeType;
  if (options?.enhance !== false) {
    try {
      const enhanced = await enhanceImage(buffer);
      imageBuffer = enhanced.buffer;
      imageMimeType = enhanced.mimeType;
    } catch (error) {
      console.warn(`⚠️ Image enhancement skipped (${(error as Error).message}); using raw image.`);
    }
  }

  let lastError: Error | null = null;
  let best: ParserResult | null = null;
  let bestScore = Infinity;
  const maxAttempts = options?.maxAttempts ?? 3;
  const areaTolerance = options?.areaTolerance ?? 0.05;

  for (const provider of providers) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await provider.extract({
          prompt: buildPrompt(provider.id),
          base64: imageBuffer.toString("base64"),
          mimeType: imageMimeType,
          jsonSchema: provider.id === "gemini" ? surveyDataSchema : undefined
        });
        const result = buildResult(response.text, provider.id);
        if (isGoodResult(result, areaTolerance)) {
          result.isGood = true;
          return result;
        }
        const score = qualityScore(result);
        if (score < bestScore) {
          bestScore = score;
          best = result;
        }
        console.warn(
          `⚠️ ${provider.id} reading #${attempt} rejected (${result.vertices.length} vertices, computed ${result.computedAreaSqm?.toFixed(1) ?? "?"} m² vs printed ${result.printedAreaSqm ?? "?"} m², closure ${result.closureErrorM?.toFixed(2) ?? "?"} m)`
        );
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ ${provider.id} extraction failed: ${lastError.message}`);
        break; // API-level failure — move on to the next provider
      }
    }
    // Do not return best here: a rejected reading from this provider must not
    // prevent the remaining providers from getting a chance at a good one.
  }

  if (best) {
    console.warn(
      `⚠️ No reading passed geometry checks — returning best-effort result with reduced confidence.`
    );
    if (best.confidence !== undefined) {
      best.confidence = Math.min(best.confidence, 50);
    }
    best.isGood = false;
    return best;
  }
  throw lastError ?? new Error("All vision providers failed.");
}

/** Shoelace polygon area in projected meters. */
function polygonAreaSqm(vertices: ParserResult["vertices"]): number | null {
  if (vertices.length < 3) return null;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.easting * b.northing - b.easting * a.northing;
  }
  return Math.abs(sum) / 2;
}

/** Distance between the last and first vertex in meters. */
function closureErrorM(vertices: ParserResult["vertices"]): number | null {
  if (vertices.length < 2) return null;
  const a = vertices[0];
  const b = vertices[vertices.length - 1];
  return Math.hypot(b.easting - a.easting, b.northing - a.northing);
}

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * True when two edges of the ring cross each other. A valid land boundary is
 * always a simple (non-self-intersecting) loop, so this is a hard reject.
 */
function polygonSelfIntersects(vertices: ParserResult["vertices"]): boolean {
  const n = vertices.length;
  if (n < 4) return false;
  const pts = vertices.map((v) => [v.easting, v.northing] as [number, number]);
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      // skip edges sharing a vertex
      if (i === j || (i + 1) % n === j || (j + 1) % n === i) continue;
      const c1 = cross(a1, a2, b1);
      const c2 = cross(a1, a2, b2);
      const c3 = cross(b1, b2, a1);
      const c4 = cross(b1, b2, a2);
      if (
        ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) &&
        ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A result is "good" when it passes the strongest available geometric check.
 * Hard reject: a valid land boundary is always a simple (non-self-intersecting)
 * loop, so a self-intersecting ring is hallucinated regardless of any printed
 * value — this resists self-consistent hallucinations where a model fakes both
 * coordinates and area. Then the area printed on the plan must match the
 * computed area within `areaTolerance` (default 5% — a correct extraction
 * reproduces the printed area to well under 1%), or — when no printed area was
 * read — the boundary loop must close (≤ 3 m).
 */
function isGoodResult(result: ParserResult, areaTolerance: number): boolean {
  if (result.vertices.length < 3) return false;
  if (polygonSelfIntersects(result.vertices)) return false;
  if (result.printedAreaSqm && result.computedAreaSqm) {
    return Math.abs(result.computedAreaSqm - result.printedAreaSqm) / result.printedAreaSqm <= areaTolerance;
  }
  if (result.closureErrorM != null) {
    return result.closureErrorM <= 3;
  }
  return true;
}

/** Lower is better: area discrepancy ratio when a printed area exists, else closure error. */
function qualityScore(result: ParserResult): number {
  if (result.vertices.length < 3) return Infinity;
  if (result.printedAreaSqm && result.computedAreaSqm) {
    return Math.abs(result.computedAreaSqm - result.printedAreaSqm) / result.printedAreaSqm;
  }
  return result.closureErrorM ?? Infinity;
}

/**
 * Provider-specific extraction prompts. Different models struggle with
 * different scan conditions, so each provider gets tailored instructions
 * (e.g. qwen3.6 on Groq tends to drop leading digits from northings).
 * Add a new case here when wiring up another provider.
 */
function buildPrompt(provider: VisionProviderId): string {
  const schemaBlock =
    provider === "gemini" ? "" : `\n\n${SURVEY_DATA_SCHEMA_DESCRIPTION}`;

  switch (provider) {
    case "groq":
      return `You are a land registry and survey engineering assistant running on Groq qwen3.6.
Analyze the uploaded survey plan image and extract exactly what is printed. Known weak spot of your model: leading digits of six-digit northings are often misread — a coordinate printed 553084.066 must NOT become 533084.066. Transcribe every digit of the ORIGIN coordinate character-by-character before writing it out, and write down the printed area so you can sanity-check your traverse.

Extract:
1. The CRS printed on the survey stamps or title block. Pay close attention to the stated DATUM: Minna datum plans are Minna / Nigeria West/Mid/East Belt or Minna / UTM Zone 31/32 (EPSG:263xx). WGS 84 datum plans state DATUM: WGS 84 with a UTM zone (EPSG:326xx). Never assume Minna unless the plan says so — converting a WGS 84 plan with the Minna shift is 100-200 meters off.
2. The beacon coordinate table (Beacon Statement) with Beacon IDs, Easting (X), Northing (Y), if printed.
3. If there is NO coordinate table, extract the printed ORIGIN coordinate into 'origin', and each boundary traverse leg (bearing in decimal degrees clockwise from grid north, distance in meters) between adjacent beacons into 'legs', ordered around the loop from the anchor beacon. Include the closing leg back to the first beacon if printed.
4. The legs must form a geometrically consistent closed loop. On a regular plot consecutive bearings typically differ by roughly 90° (e.g. 76°, 166°, 256°, 346°). If your bearings do not close the loop, re-read the degree digits very carefully — faint scans obscure digits (166° can look like 27°, 346° like 18°). Prefer the reading that makes the loop close.

Read all values exactly as printed. Do not hallucinate. If digits are unclear due to stamp overlays, give your best readable estimates.${schemaBlock}`;

    case "mistral":
      return `You are a land registry and survey engineering assistant running on Mistral Large 3.
Analyze the uploaded survey plan image and extract exactly what is printed. Two known weak spots of your model:
1. You sometimes SWAP Easting and Northing. Easting (E/X) is the first printed coordinate and is the smaller value for these UTM plans (e.g. 429802.516); Northing (N/Y) is the second printed coordinate and is the larger value (e.g. 553084.066). Read the E and N column headers on the plan and keep them in that order — a swapped origin displaces the plot roughly 100 km.
2. Be meticulous about full digit transcription — six-figure eastings/northings and three-figure bearings must be read completely; faint scans often smear individual digits.

Extract:
1. The CRS printed on the survey stamps or title block. Pay close attention to the stated DATUM: Minna datum plans are Minna / Nigeria West/Mid/East Belt or Minna / UTM Zone 31/32 (EPSG:263xx). WGS 84 datum plans state DATUM: WGS 84 with a UTM zone (EPSG:326xx). Never assume Minna unless the plan says so — converting a WGS 84 plan with the Minna shift is 100-200 meters off.
2. The beacon coordinate table (Beacon Statement) with Beacon IDs, Easting (X), Northing (Y), if printed.
3. If there is NO coordinate table, extract the printed ORIGIN coordinate into 'origin' (Easting first, Northing second — do NOT swap them), and each boundary traverse leg (bearing in decimal degrees clockwise from grid north, distance in meters) between adjacent beacons into 'legs', ordered around the loop from the anchor beacon. Include the closing leg back to the first beacon if printed.
4. The legs must form a geometrically consistent closed loop. On a regular plot consecutive bearings typically differ by roughly 90° (e.g. 76°, 166°, 256°, 346°). If your bearings do not close the loop, re-read the degree digits very carefully — faint scans obscure digits (166° can look like 27°, 346° like 18°). Prefer the reading that makes the loop close.
5. Transcribe the printed AREA (in square meters) into 'areaSqm' and use it to sanity-check that your extracted polygon is the same size.

Read all values exactly as printed. Do not hallucinate. If digits are unclear due to stamp overlays, give your best readable estimates.${schemaBlock}`;

    default: // gemini
      return `You are a land registry and survey engineering assistant. 
Your task is to analyze the uploaded survey plan image and extract:
1. The Coordinate Reference System (CRS) printed on the survey stamps, labels, or title block. Pay close attention to the stated DATUM: Minna datum plans are referenced as Minna / Nigeria West/Mid/East Belt or Minna / UTM Zone 31/32 (EPSG:263xx). WGS 84 datum plans state DATUM: WGS 84 with a UTM zone (EPSG:326xx). Distinguish these carefully — converting a WGS 84 plan with the Minna datum shift produces coordinates roughly 100-200 meters off, so never assume Minna unless the plan says so.
2. The beacon coordinate table (Beacon Statement) containing Beacon IDs, Easting (X) values, and Northing (Y) values, if one is printed.
3. If the plan has NO coordinate table, extract the printed ORIGIN/reference coordinate into 'origin', and every boundary traverse leg (bearing in decimal degrees measured clockwise from grid north, and distance in meters) between adjacent beacons into 'legs', ordered around the boundary loop starting from the origin/anchor beacon. Include the closing leg back to the first beacon if printed.
4. The legs must form a geometrically consistent closed loop. On a regular plot the consecutive bearings typically differ by roughly 90° (e.g. 76°, 166°, 256°, 346°). If your bearings do not close the loop, re-read the degree numbers very carefully — degree values on faint scans are often partially obscured (e.g. 166° can look like 27°, 346° like 18°). Prefer the reading that makes the loop close.

Read all values exactly as they are printed. Do not hallucinate. If some numbers are unclear due to stamp overlays, provide your best readable digit estimates.${schemaBlock}`;
  }
}

function selectVisionProviders(options?: ParserOptions): VisionProvider[] {
  const requested = options?.provider ?? "auto";
  const providers: VisionProvider[] = [];

  if (requested === "gemini" || requested === "auto") {
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
    if (apiKey) {
      providers.push(new GeminiProvider(apiKey, options?.model));
    }
  }
  if (requested === "groq" || requested === "auto") {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      providers.push(new GroqProvider(apiKey, options?.model));
    }
  }
  if (requested === "mistral" || requested === "auto") {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (apiKey) {
      providers.push(new MistralProvider(apiKey, options?.model));
    }
  }

  return providers;
}

function buildResult(responseText: string, provider: VisionProviderId): ParserResult {
  const parsed = JSON.parse(responseText) as ParsedGeminiResponse;

  let vertices: ParserResult["vertices"] = Array.isArray(parsed.vertices) ? parsed.vertices : [];

  // No Beacon Statement table? If the plan provides an origin coordinate plus
  // ordered traverse legs, compute the beacon coordinates around the boundary.
  if (
    vertices.length === 0 &&
    parsed.origin &&
    typeof parsed.origin.easting === "number" &&
    typeof parsed.origin.northing === "number" &&
    Array.isArray(parsed.legs) &&
    parsed.legs.length >= 3
  ) {
    const computed = computeTraverseVertices(
      { easting: parsed.origin.easting, northing: parsed.origin.northing },
      parsed.legs.map((leg) => ({ bearingDeg: leg.bearingDeg, distanceM: leg.distanceM }))
    );
    vertices = computed.map((vertex, index) => {
      const beaconId =
        index === 0
          ? parsed.origin?.beaconId
          : parsed.legs?.[index - 1]?.toBeaconId;
      return {
        beaconId: beaconId ?? `PT-${index + 1}`,
        easting: round3(vertex.easting),
        northing: round3(vertex.northing)
      };
    });
  }

  const computedArea = polygonAreaSqm(vertices);
  const closure = closureErrorM(vertices);
  const printedArea = typeof parsed.areaSqm === "number" ? parsed.areaSqm : undefined;

  const result: ParserResult = {
    crs: normalizeCRS(parsed.crs),
    vertices,
    method: provider,
    computedAreaSqm: computedArea ?? undefined,
    closureErrorM: closure ?? undefined,
    ...(printedArea ? { printedAreaSqm: printedArea } : {})
  };

  const score = qualityScore(result);
  if (Number.isFinite(score)) {
    result.confidence = Math.round(100 * (1 - Math.min(score, 1)));
  }
  return result;
}

/**
 * Parses a survey plan image to extract the beacon coordinate table and CRS.
 *
 * Method selection:
 * - method: "local-ocr" forces the free tesseract.js fallback.
 * - method: "gemini" | "mistral" | "groq" forces that vision provider (requires its API key).
 * - method: "auto" (default) tries vision providers (gemini, then groq, then mistral) whose
 *   keys are available, falling back to local OCR when no key is configured.
 *
 * @param imageInput Local image file path, Buffer containing image bytes, or base64 data URL/string
 * @param options Parser configuration options
 * @returns ParserResult containing CRS, vertices, extraction method, and confidence
 */
export async function parseSurveyImage(
  imageInput: string | Buffer,
  options?: ParserOptions
): Promise<ParserResult> {
  const method = options?.method ?? "auto";
  const hasVisionKey =
    !!options?.apiKey ||
    !!process.env.GEMINI_API_KEY ||
    !!process.env.MISTRAL_API_KEY ||
    !!process.env.GROQ_API_KEY;

  if (method === "local-ocr") {
    return parseSurveyImageLocal(imageInput, { enhance: options?.enhance });
  }
  if (method === "auto") {
    if (hasVisionKey) {
      return parseSurveyImageWithVision(imageInput, options);
    }
    return parseSurveyImageLocal(imageInput, { enhance: options?.enhance });
  }
  return parseSurveyImageWithVision(imageInput, { ...options, provider: method });
}

export type { ParserOptions, ParserResult, ExtractedSurveyData, ParseMethod } from "./types";
