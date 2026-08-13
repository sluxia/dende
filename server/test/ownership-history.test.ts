import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../src/db";
import { runMigrations } from "../src/migrate";
import { createOwnershipNotice, ownershipHistoryForNotices, createOwnershipRequest, publicRequestsForNotice, withdrawOwnershipNotice } from "../src/ownership";

let available = true;
let plotId: string | null = null;

before(async () => {
  try {
    await pool.query("SELECT 1");
    await runMigrations();
    await pool.query(`DELETE FROM registry.plots WHERE source_file='OWNHIST:test'`);
    const row = await pool.query<{id:string}>(`INSERT INTO registry.plots
      (status,method,crs,computed_area_sqm,source_file,raw_vertices,geometry,record_type)
      VALUES ('active','manual','EPSG:4326',100,'OWNHIST:test','[]'::jsonb,
        ST_Multi(ST_GeomFromText('POLYGON((6.8 5.8,6.801 5.8,6.801 5.801,6.8 5.801,6.8 5.8))',4326)),
        'ownership_notice') RETURNING id`);
    plotId = row.rows[0].id;
  } catch {
    available = false;
  }
});

after(async () => {
  if (plotId) await pool.query(`DELETE FROM registry.plots WHERE id=$1`,[plotId]);
  await pool.end();
});

test("ownership history is captured automatically and cannot be rewritten", async (t) => {
  if (!available || !plotId) return t.skip("PostGIS not reachable");
  const notice = await createOwnershipNotice({plotId,submitterName:"History test",visibility:"public"});
  await pool.query(`UPDATE registry.ownership_notices SET status='disputed',ownership_status='disputed' WHERE id=$1`,[notice.id]);
  const grouped = await ownershipHistoryForNotices([notice.id]);
  assert.deepEqual(grouped[notice.id].map((event)=>event.eventType),["submitted","status_changed"]);
  await assert.rejects(
    pool.query(`UPDATE registry.ownership_events SET reason='rewritten' WHERE notice_id=$1`,[notice.id]),
    /append-only/
  );
  const afterAttempt = await ownershipHistoryForNotices([notice.id]);
  assert.equal(afterAttempt[notice.id].length,2);
});

test("public requests redact contact details and withdrawal requires the private key", async (t) => {
  if (!available || !plotId) return t.skip("PostGIS not reachable");
  const notice = await createOwnershipNotice({plotId,submitterName:"Workflow test",visibility:"public"});
  const request = await createOwnershipRequest({noticeId:notice.id,requestType:"challenge",requesterName:"Challenger",contactReference:"private@example.test",reason:"Boundary is disputed"});
  assert.equal(request.requestType,"challenge");
  const publicRows = await publicRequestsForNotice(notice.id);
  assert.equal(publicRows.length,1);
  assert.equal("contactReference" in publicRows[0],false);
  assert.equal("reason" in publicRows[0],false);
  assert.equal(await withdrawOwnershipNotice(notice.id,"wrong-key"),false);
  assert.equal(await withdrawOwnershipNotice(notice.id,notice.managementKey,"Requested by submitter"),true);
  const history = await ownershipHistoryForNotices([notice.id]);
  assert.ok(history[notice.id].some((event)=>event.eventType==="withdrawal_confirmed"));
});
