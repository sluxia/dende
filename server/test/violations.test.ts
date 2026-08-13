import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { runMigrations } from "../src/migrate";
import { runSpatialChecks } from "../src/spatial";
import {
  recordCheckRun,
  upsertViolations,
  setViolationStatus,
  addViolationNote,
  severityForOverlap,
  severityForRoad,
  severityForReserve
} from "../src/violations";

const dbAvailable = { value: true };

// This suite uses its own namespace (VTEST) and coordinates around lon 7.0 so
// it never collides with spatial.test.ts (TEST prefix, lon 8.0) even though
// node --test runs both files in parallel.
const PREFIX = "VTEST";

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

const area = 1e-3;
const BASE = 7.0;
let plotAId: string;
let plotBId: string;

before(async () => {
  try {
    await pool.query("SELECT 1");
  } catch {
    dbAvailable.value = false;
    console.warn("⚠️  PostGIS not reachable — skipping violations tests.");
    return;
  }
  await runMigrations();
  await pool.query(`DELETE FROM registry.plots WHERE source_file = $1`, [`${PREFIX}:violations`]);
  await pool.query(`DELETE FROM zones.roads WHERE name LIKE $1`, [`${PREFIX} %`]);
  await pool.query(`DELETE FROM zones.reserves WHERE name LIKE $1`, [`${PREFIX} %`]);

  const insertPlot = async (geom: string): Promise<string> => {
    const rows = await pool.query<{ id: string }>(
      `INSERT INTO registry.plots (source_file, geometry)
       VALUES ($1, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))) RETURNING id`,
      [`${PREFIX}:violations`, geom]
    );
    return rows.rows[0].id;
  };

  plotAId = await insertPlot(sq(BASE, 5.0, area));
  plotBId = await insertPlot(sq(BASE + 0.5e-3, 5.0 + 0.5e-3, area));

  await pool.query(
    `INSERT INTO zones.roads (name, highway_class, geometry)
     VALUES ($1, 'secondary', ST_SetSRID(ST_Multi(ST_GeomFromGeoJSON($2)), 4326))`,
    [
      `${PREFIX} Violation Road`,
      JSON.stringify({
        type: "LineString",
        coordinates: [
          [BASE, 4.98],
          [BASE, 5.02]
        ]
      })
    ]
  );
});

after(async () => {
  if (dbAvailable.value) {
    await pool.query(`DELETE FROM registry.plots WHERE source_file = $1`, [`${PREFIX}:violations`]);
    await pool.query(`DELETE FROM zones.roads WHERE name LIKE $1`, [`${PREFIX} %`]);
    await pool.query(`DELETE FROM zones.reserves WHERE name LIKE $1`, [`${PREFIX} %`]);
  }
  await pool.end();
});

const count = async (sql: string, params: unknown[] = []): Promise<number> => {
  const rows = await pool.query<{ count: string }>(sql, params);
  return Number(rows.rows[0].count);
};

async function detectForPlot(plotId: string) {
  const geom = (await pool.query<{ geometry: { type: string; coordinates: unknown } }>(
    `SELECT ST_AsGeoJSON(geometry)::jsonb AS geometry FROM registry.plots WHERE id = $1`,
    [plotId]
  )).rows[0].geometry;
  const checks = await runSpatialChecks(JSON.stringify(geom), plotId);
  const checkRunId = await recordCheckRun({
    plotId,
    trigger: "registration",
    plotAreaSqm: checks.plotAreaSqm,
    overlaps: checks.overlaps,
    zoningAlerts: checks.zoningAlerts
  });
  const ids = await upsertViolations(plotId, checkRunId, checks.overlaps, checks.zoningAlerts, checks.plotAreaSqm);
  return { checks, checkRunId, ids };
}

const measurementChanged = (plotId: string) =>
  count(
    `SELECT count(*) FROM registry.violation_events e
      JOIN registry.violations v ON v.id = e.violation_id
     WHERE v.plot_id = $1 AND e.event_type = 'measurement_changed'`,
    [plotId]
  );

test("severity helpers map thresholds", (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  assert.equal(severityForOverlap(80), "critical");
  assert.equal(severityForOverlap(50), "warning");
  assert.equal(severityForOverlap(10), "info");
  assert.equal(severityForRoad(5, "secondary"), "critical");   // ≤ ½ of 20 m buffer
  assert.equal(severityForRoad(15, "secondary"), "warning");
  assert.equal(severityForReserve(0.9 * 12300, 12300), "critical");
  assert.equal(severityForReserve(100, 12300), "warning");
});

test("detection creates one violation per finding + detected events", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const { checks, ids } = await detectForPlot(plotAId);

  const overlapViolations = await count(
    `SELECT count(*) FROM registry.violations WHERE plot_id = $1 AND kind = 'overlap'`,
    [plotAId]
  );
  assert.equal(overlapViolations, 1, "one overlap case vs plot B");
  assert.equal(checks.overlaps.length, 1);

  const zoningViolations = await count(
    `SELECT count(*) FROM registry.violations WHERE plot_id = $1 AND kind = 'zoning'`,
    [plotAId]
  );
  assert.equal(zoningViolations, 1, `${PREFIX} Violation Road corridor should be flagged`);
  assert.equal(checks.zoningAlerts.length, 1);

  assert.equal(ids.length, checks.overlaps.length + checks.zoningAlerts.length);

  const detected = await count(
    `SELECT count(*) FROM registry.violation_events e
      JOIN registry.violations v ON v.id = e.violation_id
     WHERE v.plot_id = $1 AND e.event_type = 'detected'`,
    [plotAId]
  );
  assert.equal(detected, ids.length, "every new violation got a detected event");

  const checkRuns = await count(`SELECT count(*) FROM registry.check_runs WHERE plot_id = $1`, [plotAId]);
  assert.equal(checkRuns, 1);
});

test("re-detection reuses the same violations and appends measurement_changed", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const first = await detectForPlot(plotAId);
  const firstIds = new Set(first.ids);
  const changedBefore = await measurementChanged(plotAId);

  const second = await detectForPlot(plotAId);

  assert.equal(firstIds.size, second.ids.length);
  for (const id of second.ids) assert.ok(firstIds.has(id), "no duplicate violation rows");

  const changedAfter = await measurementChanged(plotAId);
  assert.equal(changedAfter - changedBefore, second.ids.length, "one measurement_changed per known violation");

  const total = await count(`SELECT count(*) FROM registry.violations WHERE plot_id = $1`, [plotAId]);
  assert.equal(total, first.ids.length, "re-detection must not create new cases");
});

test("status lifecycle: resolve records resolution + event; re-detection reopens", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const { ids } = await detectForPlot(plotAId);
  const target = ids[0];

  await setViolationStatus(target, "acknowledged", "VTEST-operator", "Checked on site");
  await setViolationStatus(target, "resolved", "VTEST-operator", "Fence relocated");

  const row = (await pool.query<{ status: string; resolved_at: string | null; resolution: string | null }>(
    `SELECT status, resolved_at, resolution FROM registry.violations WHERE id = $1`,
    [target]
  )).rows[0];
  assert.equal(row.status, "resolved");
  assert.ok(row.resolved_at, "resolved_at set");
  assert.equal(row.resolution, "Fence relocated");

  const statusEvents = await count(
    `SELECT count(*) FROM registry.violation_events WHERE violation_id = $1 AND event_type = 'status_changed'`,
    [target]
  );
  assert.equal(statusEvents, 2);

  await detectForPlot(plotAId);
  const reopened = (await pool.query<{ status: string }>(
    `SELECT status FROM registry.violations WHERE id = $1`,
    [target]
  )).rows[0];
  assert.equal(reopened.status, "open", "re-detection reopens a resolved violation");
});

test("false_positive closes the case and is excluded from the active set", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  await detectForPlot(plotBId);
  const overlapViolation = (await pool.query<{ id: string }>(
    `SELECT id FROM registry.violations
      WHERE plot_id = $1 AND kind = 'overlap' ORDER BY created_at LIMIT 1`,
    [plotBId]
  )).rows[0];
  assert.ok(overlapViolation, "plot B overlaps plot A");

  await setViolationStatus(overlapViolation.id, "false_positive", "VTEST-operator", "Duplicate survey");

  const active = await count(
    `SELECT count(*) FROM registry.violations WHERE plot_id = $1 AND status <> 'false_positive'`,
    [plotBId]
  );
  assert.equal(active, 0, "false-positive case dropped from the active set");
});

test("notes append to the timeline", async (t) => {
  if (!dbAvailable.value) { t.skip("PostGIS not reachable"); return; }
  const { ids } = await detectForPlot(plotAId);
  await addViolationNote(ids[0], "Owner disputes the survey baseline", "VTEST-operator");
  const notes = await count(
    `SELECT count(*) FROM registry.violation_events WHERE violation_id = $1 AND event_type = 'note'`,
    [ids[0]]
  );
  assert.equal(notes, 1);
});
