import { parseSurveyImage, convertPolygon, ParserResult, VisionProviderId } from "./index";
import { renderSurveyMapHtml } from "./map-render";
import fs from "fs";
import path from "path";

async function runParserTest() {
  console.log("=== Dende Survey Plan Parser Test ===\n");

  const args = process.argv.slice(2);
  const imagePathArg = args[0];
  const providerFlag = args.find((a) => a.startsWith("--provider="))?.split("=")[1];

  if (!imagePathArg) {
    console.error("❌ Error: No survey plan image path provided.");
    console.log("To run: node dist/test-parser.js <path_to_image> [--provider=gemini|mistral|groq]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(imagePathArg);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: File not found at ${resolvedPath}`);
    process.exit(1);
  }

  const keys = {
    gemini: process.env.GEMINI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
    groq: process.env.GROQ_API_KEY
  };
  const provider: VisionProviderId | undefined =
    providerFlag && ["gemini", "mistral", "groq"].includes(providerFlag)
      ? (providerFlag as VisionProviderId)
      : undefined;
  const detected = provider ? keys[provider as keyof typeof keys] : keys.gemini || keys.mistral || keys.groq;

  if (detected) {
    const active = provider
      ? `(${provider})`
      : `(${Object.entries(keys).filter(([, v]) => v).map(([k]) => k).join(" + ")})`;
    console.log(`Vision API key detected ${active} — running vision extraction on: ${resolvedPath}...`);
  } else {
    console.log(`No vision API key — using local OCR fallback (tesseract.js) on: ${resolvedPath}...`);
  }

  let result: ParserResult;
  try {
    result = await parseSurveyImage(resolvedPath, { provider });
    console.log(`✅ Extraction successful (method: ${result.method})`);
    if (result.confidence !== undefined) {
      console.log(`   Confidence: ${result.confidence.toFixed(2)}%`);
    }
  } catch (error) {
    console.error("❌ Extraction failed:", error);
    process.exit(1);
  }

  console.log("\n--- Extracted Survey Metadata ---");
  console.log(`Detected CRS: ${result.crs}`);
  console.log("Vertices Table:");
  console.table(result.vertices);

  if (result.crs !== "unknown" && result.vertices.length > 0) {
    console.log("\nConverting extracted vertices to WGS84 GeoJSON...");
    try {
      const verticesList: [number, number][] = result.vertices.map((v) => [v.easting, v.northing]);
      const geojson = convertPolygon(verticesList, result.crs);

      console.log("\n✅ Generated WGS84 GeoJSON Polygon:");
      console.log(JSON.stringify(geojson, null, 2));

      const mapHtml = renderSurveyMapHtml(
        result.vertices.map((v) => ({ beaconId: v.beaconId, easting: v.easting, northing: v.northing })),
        result.crs,
        { title: "Dende — Survey Plan Plot Boundary" }
      );
      const outputPath = path.resolve("survey-map.html");
      fs.writeFileSync(outputPath, mapHtml, "utf8");
      console.log(`\n🗺️  Map written to: ${outputPath}  (open in a browser)`);
    } catch (err) {
      console.error("❌ Coordinate conversion failed:", err);
      process.exit(1);
    }
  } else {
    console.warn("⚠️ Warning: CRS is 'unknown' or no vertices were extracted, skipping coordinate conversion.");
  }

  process.exit(0);
}

runParserTest();
