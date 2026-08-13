/**
 * Loads zoning/master-plan data (road corridors, protected/agricultural
 * reserves) into the PostGIS `zones` schema.
 *
 *   geojson mode:
 *     tsx scripts/import-zones.ts geojson --file=roads.geojson --layer=roads [--source-url=...]
 *     tsx scripts/import-zones.ts geojson --file=reserves.geojson --layer=reserves [--source-url=...]
 *     (properties: name, highway -> road class; name, protect_class/landuse for reserves)
 *
 *   pbf mode (requires osm2pgsql, e.g. `brew install osm2pgsql` or Docker):
 *     tsx scripts/import-zones.ts pbf --url=https://download.geofabrik.de/africa/nigeria-latest.osm.pbf
 *     Uses scripts/osm-flex.lua to fill zones.roads + zones.reserves.
 */
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";
import { pool } from "../src/db";

const execFileAsync = promisify(execFile);

interface Options {
  layer?: string;
  file?: string;
  url?: string;
  sourceUrl?: string;
  sourceName?: string;
  provider?: string;
  country?: string;
  state?: string;
  locality?: string;
  license?: string;
  authority?: string;
  status?: string;
}

function parseArgs(args: string[]): { mode: string; options: Options } {
  const mode = args[0] ?? "geojson";
  const options: Options = {};
  for (const arg of args.slice(1)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      const key = match[1].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      (options as Record<string, string>)[key] = match[2];
    }
  }
  return { mode, options };
}

function properties(feature: { properties?: Record<string, unknown> | null }): Record<string, unknown> {
  return feature.properties ?? {};
}

/**
 * After an idempotent re-import, re-point open zoning violations at the new
 * zone rows and record a `zone_changed` event (zone rows are replaced by name,
 * so their ids change).
 */
async function reconcileZoneViolations(
  client: { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> },
  layer: "roads" | "reserves",
  sourceUrl?: string
): Promise<void> {
  const table = layer === "roads" ? "zones.roads" : "zones.reserves";
  const typeCol = layer === "roads" ? "highway_class" : "protection_class";
  const rows = await client.query(
    `SELECT v.id, z.id AS new_zone_id
       FROM registry.violations v
       JOIN ${table} z ON v.zone_name = z.name
      WHERE v.kind = 'zoning' AND v.zone_layer = $1 AND v.zone_id IS DISTINCT FROM z.id`,
    [layer]
  );
  if ((rows.rowCount ?? 0) === 0) return;
  await client.query(
    `INSERT INTO registry.violation_events (violation_id, event_type, actor, reason, snapshot)
     SELECT v.id, 'zone_changed', $2, $3,
            jsonb_build_object('zoneId', z.id, 'zoneName', z.name, 'zoneLayer', $4)
       FROM registry.violations v
       JOIN ${table} z ON v.zone_name = z.name
      WHERE v.kind = 'zoning' AND v.zone_layer = $4 AND v.zone_id IS DISTINCT FROM z.id`,
    [layer, "system:zone-import", `Zone re-imported (${sourceUrl ?? "unknown source"})`, layer]
  );
  await client.query(
    `UPDATE registry.violations v
        SET zone_id = z.id, zone_name = z.name, zone_type = z.${typeCol}, updated_at = now()
       FROM ${table} z
      WHERE v.kind = 'zoning' AND v.zone_layer = $1 AND v.zone_name = z.name AND v.zone_id IS DISTINCT FROM z.id`,
    [layer]
  );
}

async function importGeojson(file: string, layer: "roads" | "reserves", options: Options): Promise<void> {
  if (layer !== "roads" && layer !== "reserves") {
    throw new Error("--layer must be 'roads' or 'reserves'.");
  }
  const fileBuffer = await fs.promises.readFile(file);
  const raw = JSON.parse(fileBuffer.toString("utf8"));
  const features: Array<{
    type?: string;
    geometry?: { type?: string; coordinates?: unknown } | null;
    properties?: Record<string, unknown> | null;
  }> = Array.isArray(raw) ? raw : raw.features ?? [];
  if (features.length === 0) {
    throw new Error(`No features found in ${file}.`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sourceType = layer === "roads" ? "road" : "reserve";
    const sourceName = options.sourceName ?? `${path.basename(file)} (${layer})`;
    const sourceResult = await client.query(
      `WITH existing AS (
         SELECT id FROM provenance.data_sources
          WHERE type = $1 AND name = $2
            AND country_code IS NOT DISTINCT FROM $4
            AND admin_level_1 IS NOT DISTINCT FROM $5
            AND admin_level_2 IS NOT DISTINCT FROM $6
          LIMIT 1
       ), inserted AS (
         INSERT INTO provenance.data_sources
           (type, name, provider, country_code, admin_level_1, admin_level_2, format,
            source_url, license, authority_level, status)
         SELECT $1, $2, $3, $4, $5, $6, 'geojson', $7, $8, $9, $10
          WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id
       )
       SELECT id FROM existing UNION ALL SELECT id FROM inserted LIMIT 1`,
      [sourceType, sourceName, options.provider ?? null, options.country?.toUpperCase() ?? null,
        options.state ?? null, options.locality ?? null, options.sourceUrl ?? null,
        options.license ?? null, options.authority ?? "open_data", options.status ?? "active"]
    );
    const sourceId = (sourceResult as unknown as { rows: Array<{ id: string }> }).rows[0].id;
    const checksum = createHash("sha256").update(fileBuffer).digest("hex");
    const importResult = await client.query(
      `INSERT INTO provenance.data_imports
         (source_id, filename, file_type, checksum, record_count, imported_by, status)
       VALUES ($1, $2, 'application/geo+json', $3, $4, 'system:zone-import', 'complete')
       ON CONFLICT (source_id, checksum) WHERE checksum IS NOT NULL
       DO UPDATE SET imported_at = now(), record_count = EXCLUDED.record_count, status = 'complete'
       RETURNING id`,
      [sourceId, path.basename(file), checksum, features.length]
    );
    const importId = (importResult as unknown as { rows: Array<{ id: string }> }).rows[0].id;
    // Curated imports are authoritative: replace pre-existing rows for the
    // same layer + name so re-importing a file is idempotent.
    const names = features
      .map((f) => properties(f).name as string | undefined)
      .filter((n): n is string => typeof n === "string" && n.length > 0);
    if (names.length > 0) {
      const table = layer === "roads" ? "zones.roads" : "zones.reserves";
      await client.query(`DELETE FROM ${table} WHERE source_id = $1 AND name = ANY($2)`, [sourceId, names]);
    }
    let inserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < features.length; i += chunkSize) {
      const chunk = features.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: unknown[] = [];
      let p = 1;
      for (const feature of chunk) {
        const geometry = feature.geometry;
        if (!geometry || typeof geometry.type !== "string" || !Array.isArray(geometry.coordinates)) {
          continue;
        }
        const props = properties(feature);
        const name = (props.name as string) ?? null;
        const roadClass = (props.highway as string) ?? null;
        const protectionClass = (props.protect_class as string) ?? props.boundary ?? props.leisure ?? null;
        const landuse = (props.landuse as string) ?? null;
        if (layer === "roads") {
          values.push(`($${p++}, $${p++}, $${p++}, $${p++}, now(), $${p++}, $${p++})`);
          params.push(name, roadClass, JSON.stringify(geometry), options.sourceUrl ?? null, sourceId, importId);
        } else {
          values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, now(), $${p++}, $${p++})`);
          params.push(name, protectionClass, landuse, JSON.stringify(geometry), options.sourceUrl ?? null, sourceId, importId);
        }
      }
      if (values.length === 0) continue;
      const table = layer === "roads" ? "zones.roads" : "zones.reserves";
      const columns =
        layer === "roads"
          ? "(name, highway_class, geometry, source_url, imported_at, source_id, import_id)"
          : "(name, protection_class, landuse, geometry, source_url, imported_at, source_id, import_id)";
      await client.query(`INSERT INTO ${table} ${columns} VALUES ${values.join(",")}`, params);
      inserted += values.length;
    }
    await reconcileZoneViolations(client, layer, options.sourceUrl);
    await client.query(
      `INSERT INTO zones.meta (layer, source_url, row_count) VALUES ($1, $2, $3)`,
      [layer, options.sourceUrl ?? null, inserted]
    );
    await client.query("COMMIT");
    console.log(`Imported ${inserted} ${layer} features from ${file}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function download(url: string, output: string): Promise<void> {
  console.log(`Downloading ${url} → ${output}...`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(output));
  console.log(`Downloaded ${output} (${(fs.statSync(output).size / 1024 / 1024).toFixed(1)} MB).`);
}

async function importPbf(url: string): Promise<void> {
  const osm2pgsql = process.env.OSM2PGSQL ?? "osm2pgsql";
  const output = path.resolve(process.env.PBF_CACHE_DIR ?? ".", "dende-zones.osm.pbf");
  if (!fs.existsSync(output)) {
    await download(url, output);
  } else {
    console.log(`Reusing cached ${output}.`);
  }
  const flex = path.resolve(__dirname, "osm-flex.lua");

  await pool.query("DROP TABLE IF EXISTS zones.roads");
  await pool.query("DROP TABLE IF EXISTS zones.reserves");
  await pool.query("DELETE FROM zones.meta WHERE layer IN ('roads', 'reserves')");

  console.log("Running osm2pgsql (flex)...");
  try {
    await execFileAsync(osm2pgsql, ["-O", "flex", "-S", flex, "-d", process.env.DATABASE_URL ?? "", output]);
  } catch (error) {
    const message = (error as Error).message;
    if (/ENOENT/.test(message)) {
      throw new Error(
        "osm2pgsql not found. Install it (`brew install osm2pgsql`) or pre-import a dataset with the 'geojson' mode."
      );
    }
    throw error;
  }

  await pool.query("CREATE INDEX IF NOT EXISTS roads_geometry_gix ON zones.roads USING GIST (geometry)");
  await pool.query("CREATE INDEX IF NOT EXISTS reserves_geometry_gix ON zones.reserves USING GIST (geometry)");

  const rows = await pool.query("SELECT count(*) AS count FROM zones.roads");
  const reserves = await pool.query("SELECT count(*) AS count FROM zones.reserves");
  await pool.query(
    `INSERT INTO zones.meta (layer, source_url, row_count) VALUES ('roads', $1, $2), ('reserves', $1, $3)`,
    [url, Number(rows.rows[0]?.count ?? 0), Number(reserves.rows[0]?.count ?? 0)]
  );
  await reconcileZoneViolations(pool, "roads", url);
  await reconcileZoneViolations(pool, "reserves", url);
  console.log(`Imported ${rows.rows[0]?.count} roads and ${reserves.rows[0]?.count} reserves from OSM.`);
}

async function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));
  if (mode === "pbf") {
    if (!options.url) throw new Error("pbf mode requires --url=<geofabrik or other .osm.pbf URL>");
    await importPbf(options.url);
  } else {
    if (!options.file) throw new Error("geojson mode requires --file=<path.geojson>");
    await importGeojson(options.file, (options.layer ?? "roads") as "roads" | "reserves", options);
  }
  await pool.end();
  console.log("Done.");
  process.exit(0);
}

main().catch(async (error) => {
  console.error("Import failed:", error);
  await pool.end().catch(() => {});
  process.exit(1);
});
