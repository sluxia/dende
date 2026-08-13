import fs from "fs";

export interface ResolvedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Normalizes the accepted image input forms (filepath, Buffer, base64 data URL)
 * into a Buffer plus its MIME type.
 */
export function resolveImageInput(imageInput: string | Buffer): ResolvedImage {
  let mimeType = "image/jpeg";
  let buffer: Buffer;

  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === "string") {
    if (imageInput.startsWith("data:")) {
      const matches = imageInput.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        throw new Error("Invalid base64 Data URL format.");
      }
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], "base64");
    } else {
      if (!fs.existsSync(imageInput)) {
        throw new Error(`File not found at path: ${imageInput}`);
      }
      buffer = fs.readFileSync(imageInput);
      if (imageInput.endsWith(".png")) mimeType = "image/png";
      else if (imageInput.endsWith(".webp")) mimeType = "image/webp";
      else if (imageInput.endsWith(".gif")) mimeType = "image/gif";
    }
  } else {
    throw new Error(
      "Invalid image input format. Must be a filepath string, base64 data URL, or Buffer."
    );
  }

  return { buffer, mimeType };
}
