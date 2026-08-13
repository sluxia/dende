import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { runMigrations } from "../src/migrate";
import { checkOverlaps, checkZoning, runSpatialChecks } from "../src/spatial";
import { collectConsultedSources } from "../src/check-evidence";

const dbAvailable = { value: true };

function sq(minLon: number, minLat: number, sizeDeg: number): string {
  const [minX, maxX] = [minLon, minLon + sizeDeg];
  const [minY, maxY] = [minLat, minLat + sizeDeg];
  return JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY]
      ]
    ]
  });
}

// 1e-4 deg longitude ≈ 11 m at latitude 5. Squares below are ~110 m.
const area = 1e-3;
const A = sq(8.0, 5.0, area); // existing plot
let plotAId: string;

before(async () => {
  try {
    await pool.query("SELECT 1");
  } catch {
    dbAvailable.value = false;
    console.warn("⚠️  PostGIS not reachable — skipping spatial tests (run `docker compose up -d db` or a local PostGIS and set DATABASE_URL).");
    return;
  }
  await runMigrations();
  // Only clean up this suite's own rows — never wipe registered user plots.
  await pool.query("DELETE FROM registry.plots WHERE source_file = 'TEST:spatial'");
  await pool.query("DELETE FROM zones.roads WHERE name LIKE 'TEST %'");
  await pool.query("DELETE FROM zones.reserves WHERE name LIKE 'TEST %'");

  await pool.query(
    `INSERT INTO registry.plots (source_file, geometry)
     VALUES ($1, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)))`,
    ["TEST:spatial", A]
  );
  plotAId = (await pool.query<{ id: string }>(
    `SELECT id FROM registry.plots WHERE source_file = 'TEST:spatial'`
  )).rows[0].id;
});

after(async () => {
  if (dbAvailable.value) {
    await pool.query("DELETE FROM registry.plots WHERE source_file = 'TEST:spatial'");
    await pool.query("DELETE FROM zones.roads WHERE name LIKE 'TEST %'");
    await pool.query("DELETE FROM zones.reserves WHERE name LIKE 'TEST %'");
  }
  await pool.end();
});

test("overlap: genuinely overlapping plot is flagged", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const overlapping = sq(8.0 + 0.5e-3, 5.0 + 0.5e-3, area);
  const hits = await checkOverlaps(overlapping, 12000);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].plotId, plotAId);
  assert.ok(hits[0].intersectionAreaSqm > 2500 && hits[0].intersectionAreaSqm < 4000, `intersection should be ~25% of the ~12300 m² plot, got ${hits[0].intersectionAreaSqm}`);
  assert.ok(hits[0].intersectionPercent > 20 && hits[0].intersectionPercent < 30, `got ${hits[0].intersectionPercent}%`);
});

test("overlap: shared boundary edge is flagged (spec: any intersection)", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  // Shares the eastern edge x=8.001 with plot A, no interior overlap.
  const sharedEdge = sq(8.0 + area, 5.0, area);
  const hits = await checkOverlaps(sharedEdge, 12000);
  assert.equal(hits.length, 1, "shared edges count as an intersection per spec");
});

test("overlap: disjoint plot is clean", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const disjoint = sq(8.0 + 3 * area, 5.0 + 3 * area, area);
  const hits = await checkOverlaps(disjoint, 12000);
  assert.equal(hits.length, 0);
});

test("zoning: road corridor buffer flags nearby plot, ignores far plot", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  await pool.query(
    `INSERT INTO zones.roads (name, highway_class, geometry)
     VALUES ('TEST Road', 'secondary', ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($1)), 4326))`,
    [
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [8.0, 4.98],
          [8.0, 5.02]
        ]
      })
    ]
  );
  const near = await checkZoning(sq(8.0 + 0.1e-3, 5.0, area)); // ~11 m east of the road
  const far = await checkZoning(sq(8.0 + 0.5e-3, 5.0, area)); // ~55 m east — outside 20 m buffer
  const nearRoads = near.filter((a) => a.layer === "roads");
  const farRoads = far.filter((a) => a.layer === "roads");
  assert.ok(nearRoads.length >= 1, "plot within the secondary road buffer should alert");
  assert.ok(nearRoads[0].distanceM != null && nearRoads[0].distanceM! <= 20);
  assert.equal(farRoads.length, 0, "plot beyond the buffer must not alert");
});

test("zoning: reserve overlap flags contained plot", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  await pool.query(
    `INSERT INTO zones.reserves (name, protection_class, geometry)
     VALUES ('TEST Forest Reserve', 'forest_reserve', ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($1)), 4326))`,
    [
      JSON.stringify({
        type: "Polygon",
        coordinates: [
          [
            [8.01, 5.01],
            [8.02, 5.01],
            [8.02, 5.02],
            [8.01, 5.02],
            [8.01, 5.01]
          ]
        ]
      })
    ]
  );
  const inside = await checkZoning(sq(8.015, 5.015, area));
  const outside = await checkZoning(sq(8.0, 5.0, area));
  const insideReserves = inside.filter((a) => a.layer === "reserves");
  assert.ok(insideReserves.length >= 1, "plot inside the reserve should alert");
  assert.ok(insideReserves[0].intersectionAreaSqm! > 0);
  assert.equal(outside.filter((a) => a.layer === "reserves").length, 0);
});

test("runSpatialChecks returns plot area and both check groups", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const result = await runSpatialChecks(sq(8.0 + 0.5e-3, 5.0 + 0.5e-3, area));
  assert.ok(result.plotAreaSqm > 10000 && result.plotAreaSqm < 13000);
  assert.ok(Array.isArray(result.overlaps));
  assert.ok(Array.isArray(result.zoningAlerts));
});

test("authoritative coverage catalogue includes every state and FCT but planned sources are not consulted", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const catalog = await pool.query<{ id: string; admin_level_1: string | null; access_stage: string }>(
    `SELECT id, admin_level_1, access_stage
       FROM provenance.data_sources
      WHERE country_code = 'NG' AND authority_level = 'official'
        AND status = 'planned' AND coverage_status = 'unavailable'`
  );
  const jurisdictions = new Set(catalog.rows.map((row) => row.admin_level_1).filter(Boolean));
  assert.equal(jurisdictions.size, 37, "all 36 states and the FCT should be catalogued");
  assert.ok(catalog.rows.every((row) => row.access_stage !== "usable"), "authority websites must not be classified as usable datasets");

  // Even if a feature is accidentally linked before activation, the evidence
  // collector must not claim that this unavailable source was consulted.
  const planned = catalog.rows.find((row) => row.admin_level_1 === "Cross River");
  assert.ok(planned);
  await pool.query(`UPDATE registry.plots SET source_id = $1 WHERE id = $2`, [planned.id, plotAId]);
  const consulted = await collectConsultedSources();
  assert.equal(consulted.some((source) => source.id === planned.id), false);
  await pool.query(`UPDATE registry.plots SET source_id = NULL WHERE id = $1`, [plotAId]);
});

test("Cross River acquisition audit records access routes without activating coverage", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const targets = await pool.query<{ name: string; access_stage: string; access_method: string | null; access_reviewed_at: string | null }>(
    `SELECT name, access_stage, access_method, access_reviewed_at::text
       FROM provenance.data_sources
      WHERE country_code = 'NG' AND admin_level_1 = 'Cross River'
        AND authority_level = 'official' AND status = 'planned'`
  );
  assert.equal(targets.rows.length, 6);
  assert.ok(targets.rows.every((row) => row.access_stage !== "usable"));
  assert.ok(targets.rows.every((row) => row.access_method && row.access_reviewed_at === "2026-08-13"));
  assert.ok(targets.rows.some((row) => row.name.includes("survey lodgements") && row.access_stage === "access_required"));
  assert.ok(targets.rows.some((row) => row.name.includes("forest reserve") && row.access_stage === "authority_identified"));
});
