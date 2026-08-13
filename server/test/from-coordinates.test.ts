import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { runMigrations } from "../src/migrate";
import { registerPlotFromCoordinates, RegistrationError } from "../src/registration";

const dbAvailable = { value: true };

// Own namespace (FTEST) around lon 6.0 — never collides with spatial.test.ts
// (TEST, lon 8.0) or violations.test.ts (VTEST, lon 7.0) under node --test.
const PREFIX = "FTEST";

function sqVerts(minLon: number, minLat: number, sizeDeg: number): [number, number][] {
  return [
    [minLon, minLat],
    [minLon + sizeDeg, minLat],
    [minLon + sizeDeg, minLat + sizeDeg],
    [minLon, minLat + sizeDeg]
  ];
}

// Same quad (lon 6.5 / lat 5.0, 0.001 deg) expressed in UTM zone 31N, used to
// prove EPSG:4326 and projected input converge on the same ground area.
const GPS_QUAD = sqVerts(6.5, 5.0, 0.001);
const UTM_QUAD: [number, number][] = [
  [888229.671, 553698.748],
  [888340.731, 553699.34],
  [888340.14, 553810.083],
  [888229.08, 553809.491]
];

before(async () => {
  try {
    await pool.query("SELECT 1");
  } catch {
    dbAvailable.value = false;
    console.warn("⚠️  PostGIS not reachable — skipping from-coordinates tests.");
    return;
  }
  await runMigrations();
  await pool.query(`DELETE FROM registry.plots WHERE source_file LIKE $1`, [`${PREFIX}:%`]);
  await pool.query(`DELETE FROM zones.roads WHERE name LIKE $1`, [`${PREFIX} %`]);
  await pool.query(`DELETE FROM zones.reserves WHERE name LIKE $1`, [`${PREFIX} %`]);
});

after(async () => {
  if (dbAvailable.value) {
    await pool.query(`DELETE FROM registry.plots WHERE source_file LIKE $1`, [`${PREFIX}:%`]);
    await pool.query(`DELETE FROM zones.roads WHERE name LIKE $1`, [`${PREFIX} %`]);
    await pool.query(`DELETE FROM zones.reserves WHERE name LIKE $1`, [`${PREFIX} %`]);
  }
  await pool.end();
});

function countPlots(): Promise<number> {
  return pool
    .query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM registry.plots WHERE source_file LIKE $1`, [
      `${PREFIX}:%`
    ])
    .then((r) => Number(r.rows[0].n));
}

test("check-only does not insert a plot and returns no violation ids", async () => {
  const before = await countPlots();
  const result = await registerPlotFromCoordinates(sqVerts(6.0, 5.0, 0.001), "EPSG:4326", {
    label: `${PREFIX}:check`
  });
  const after = await countPlots();

  assert.equal(result.registered, false);
  assert.equal(result.plot, null);
  assert.deepEqual(result.violations, []);
  assert.ok(result.consultedSources.length > 0, "check-only results should disclose consulted sources");
  assert.ok(result.consultedSources.every((source) => source.coverageStatus && source.authorityLevel));
  assert.ok(result.plotAreaSqm > 0);
  assert.equal(after, before);
});

test("register=true persists a manual plot with method/crs/raw_vertices", async () => {
  const result = await registerPlotFromCoordinates(sqVerts(6.01, 5.01, 0.001), "EPSG:4326", {
    label: `${PREFIX}:reg`,
    register: true
  });

  assert.equal(result.registered, true);
  assert.ok(result.plot, "plot should be returned");
  assert.equal(result.plot.method, "manual");
  assert.equal(result.plot.crs, "EPSG:4326");
  assert.equal(result.plot.sourceFile, `${PREFIX}:reg`);
  assert.equal(result.plot.confidence, null);
  assert.ok(result.plotAreaSqm > 0);

  const row = await pool.query<{ status: string; raw_vertices: unknown; consulted_sources: unknown }>(
    `SELECT p.status, p.raw_vertices, c.consulted_sources
       FROM registry.plots p
       JOIN registry.check_runs c ON c.plot_id = p.id
      WHERE p.id = $1 ORDER BY c.ran_at DESC LIMIT 1`,
    [result.plot.id]
  );
  assert.equal(row.rows.length, 1);
  assert.equal(row.rows[0].status, "active");
  assert.deepEqual(row.rows[0].consulted_sources, result.consultedSources);
  const verts = row.rows[0].raw_vertices as { beaconId: string }[];
  assert.equal(verts.length, 4);
  assert.deepEqual(
    verts.map((v) => v.beaconId),
    ["PT-1", "PT-2", "PT-3", "PT-4"]
  );
});

test("overlapping manual registrations produce an overlap violation", async () => {
  const a = await registerPlotFromCoordinates(sqVerts(6.02, 5.02, 0.002), "EPSG:4326", {
    label: `${PREFIX}:overlapA`,
    register: true
  });
  const b = await registerPlotFromCoordinates(sqVerts(6.021, 5.021, 0.002), "EPSG:4326", {
    label: `${PREFIX}:overlapB`,
    register: true
  });

  assert.ok(b.plot, "plot B should be returned");
  assert.ok(b.violations.length >= 1, "overlap should create a violation");
  const overlap = b.overlaps.find((o) => o.plotId === a.plot!.id);
  assert.ok(overlap, "overlap should reference plot A");
  assert.ok(Math.abs(overlap.intersectionPercent - 25) < 2, `expected ~25% overlap, got ${overlap.intersectionPercent}%`);

  const rows = await pool.query<{ kind: string; other_plot_id: string }>(
    `SELECT kind, other_plot_id FROM registry.violations WHERE plot_id = $1 AND kind = 'overlap'`,
    [b.plot.id]
  );
  assert.ok(rows.rows.length >= 1);
  assert.equal(rows.rows[0].other_plot_id, a.plot!.id);
});

test("fewer than 3 corners is rejected with status 400", async () => {
  await assert.rejects(
    registerPlotFromCoordinates(
      [
        [6.0, 5.0],
        [6.001, 5.0]
      ],
      "EPSG:4326"
    ),
    (err: unknown) => err instanceof RegistrationError && err.statusCode === 400
  );
});

test("GPS and UTM input of the same quad converge on the same area", async () => {
  const gps = await registerPlotFromCoordinates(GPS_QUAD, "EPSG:4326", { label: `${PREFIX}:gps` });
  const utm = await registerPlotFromCoordinates(UTM_QUAD, "EPSG:32631", { label: `${PREFIX}:utm` });

  assert.ok(gps.plotAreaSqm > 10000, "0.001 deg quad should be ~12,000 m²");
  const diff = Math.abs(gps.plotAreaSqm - utm.plotAreaSqm) / gps.plotAreaSqm;
  assert.ok(diff < 0.01, `GPS/UTM area mismatch: ${diff * 100}%`);
});
