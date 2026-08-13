import sharp from "sharp";
import { ResolvedImage } from "./image-input";

const MAX_OCR_DIMENSION = 3000;
const UPSCALE_FACTOR = 2;

export interface EnhanceOptions {
  /** Apply Otsu adaptive binarization (black text on white). Can destroy thin
   *  strokes on very low-resolution scans; off by default. */
  binarize?: boolean;
}

/**
 * Computes an Otsu threshold that best separates foreground text from
 * background for the given grayscale histogram.
 */
function otsuThreshold(histogram: number[]): number {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let weightB = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let i = 0; i < 256; i++) {
    weightB += histogram[i];
    if (weightB === 0) continue;

    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += i * histogram[i];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const varianceBetween = weightB * weightF * (meanB - meanF) * (meanB - meanF);

    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = i;
    }
  }

  return threshold;
}

/**
 * Extracts a grayscale histogram from raw 8-bit pixel data.
 */
function grayscaleHistogram(pixels: Buffer): number[] {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    histogram[gray]++;
  }
  return histogram;
}

/**
 * Preprocesses a survey plan image to improve OCR accuracy:
 * 1. Grayscale + contrast stretch (normalize).
 * 2. Upscale small/medium scans by a factor of 2 (capped to MAX_OCR_DIMENSION).
 * 3. Optionally Otsu-adaptive binarize (off by default).
 *
 * Stamps and colored overlays tend to drop out of the grayscale/contrast
 * output, which helps both tesseract.js and vision models focus on the
 * coordinate table.
 *
 * @param buffer Raw image bytes
 * @param options Enhancement options
 * @returns Enhanced image bytes (lossless PNG) plus its MIME type
 */
export async function enhanceImage(
  buffer: Buffer,
  options?: EnhanceOptions
): Promise<ResolvedImage> {
  let image = sharp(buffer, { failOn: "none" })
    .grayscale()
    .normalize()
    .removeAlpha();

  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const longestSide = Math.max(width, height);

  if (longestSide > 0 && longestSide < MAX_OCR_DIMENSION / UPSCALE_FACTOR) {
    image = image.resize({
      width: Math.min(width * UPSCALE_FACTOR, MAX_OCR_DIMENSION),
      kernel: sharp.kernel.lanczos3
    });
  }

  if (options?.binarize) {
    const { data, info } = await image
      .clone()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const threshold = otsuThreshold(grayscaleHistogram(data));
    image = sharp(data, {
      raw: { width: info.width, height: info.height, channels: 1 }
    }).threshold(threshold);
  }

  const png = await image.png().toBuffer();
  return { buffer: png, mimeType: "image/png" };
}
