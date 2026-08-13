import { SupportedCRS } from "./projections";

export type VisionProviderId = "gemini" | "mistral" | "groq";

export interface ParserOptions {
  apiKey?: string;
  model?: string; // e.g. "gemini-2.5-flash", "mistral-large-2512", "qwen/qwen3.6-27b"
  method?: "auto" | VisionProviderId | "local-ocr";
  provider?: "auto" | VisionProviderId; // which vision API to try first in auto mode
  enhance?: boolean; // preprocess image (grayscale, contrast, threshold) before extraction; defaults to true
  maxAttempts?: number; // vision retries per provider when geometry checks fail; defaults to 3
  areaTolerance?: number; // max accepted |computed - printed| / printed, defaults to 0.05 (5%)
}

export interface ExtractedSurveyData {
  crs: SupportedCRS | "unknown";
  vertices: Array<{
    beaconId: string;
    easting: number;
    northing: number;
  }>;
}

export type ParseMethod = VisionProviderId | "local-ocr";

export interface ParserResult extends ExtractedSurveyData {
  method: ParseMethod;
  confidence?: number;
  /** True when the reading passed the geometry checks (area/closure/self-intersection/duplicate IDs). */
  isGood?: boolean;
  rawText?: string;
  /** Area computed from the extracted vertices (shoelace, in projected meters) */
  computedAreaSqm?: number;
  /** Area printed on the plan, if the model read it */
  printedAreaSqm?: number;
  /** Distance (meters) between the last and first vertex — ~0 for a closed loop */
  closureErrorM?: number;
}
