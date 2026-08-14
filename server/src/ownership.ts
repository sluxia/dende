import { query, queryOne } from "./db";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface OwnershipNotice {
  id: string;
  plotId: string;
  submitterName: string | null;
  statement: string | null;
  ownershipStatus: "unverified" | "verified" | "rejected" | "disputed";
  verificationLevel: "none" | "identity" | "documents" | "professional" | "authority";
  visibility: "public" | "limited" | "private";
  status: "active" | "withdrawn" | "expired" | "disputed";
  submittedAt: string;
  verifiedAt: string | null;
}

export interface OwnershipEvent {
  id: string;
  noticeId: string;
  verificationId: string | null;
  eventType: string;
  actor: string;
  reason: string | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export interface PublicOwnershipRequest {
  id: string;
  noticeId: string;
  requestType: "challenge" | "correction";
  status: string;
  submittedAt: string;
  updatedAt: string;
}

function keyHash(key: string): string { return createHash("sha256").update(key).digest("hex"); }

interface NoticeRow {
  id: string;
  plot_id: string;
  submitter_name: string | null;
  statement: string | null;
  ownership_status: OwnershipNotice["ownershipStatus"];
  verification_level: OwnershipNotice["verificationLevel"];
  visibility: OwnershipNotice["visibility"];
  status: OwnershipNotice["status"];
  submitted_at: string;
  verified_at: string | null;
}

function mapNotice(row: NoticeRow): OwnershipNotice {
  return {
    id: row.id,
    plotId: row.plot_id,
    submitterName: row.submitter_name,
    statement: row.statement,
    ownershipStatus: row.ownership_status,
    verificationLevel: row.verification_level,
    visibility: row.visibility,
    status: row.status,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at
  };
}

export async function createOwnershipNotice(input: {
  plotId: string;
  submitterName?: string | null;
  contactReference?: string | null;
  statement?: string | null;
  visibility?: OwnershipNotice["visibility"];
  ownerUserId?: string | null;
}): Promise<OwnershipNotice & { managementKey: string }> {
  const managementKey = randomBytes(32).toString("base64url");
  const row = await queryOne<NoticeRow>(
    `INSERT INTO registry.ownership_notices
       (plot_id, submitter_name, contact_reference, statement, visibility, management_key_hash, owner_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, plot_id, submitter_name, statement, ownership_status,
               verification_level, visibility, status, submitted_at, verified_at`,
    [input.plotId, input.submitterName ?? null, input.contactReference ?? null,
      input.statement ?? null, input.visibility ?? "public", keyHash(managementKey), input.ownerUserId ?? null]
  );
  if (!row) throw new Error("Could not create ownership notice.");
  return { ...mapNotice(row), managementKey };
}

export async function noticesForPlots(plotIds: string[]): Promise<Record<string, OwnershipNotice[]>> {
  if (plotIds.length === 0) return {};
  const rows = await query<NoticeRow>(
    `SELECT id, plot_id, submitter_name, statement, ownership_status,
            verification_level, visibility, status, submitted_at, verified_at
       FROM registry.ownership_notices
      WHERE plot_id = ANY($1::uuid[]) AND status IN ('active', 'disputed') AND visibility <> 'private'
      ORDER BY submitted_at ASC`,
    [plotIds]
  );
  return rows.reduce<Record<string, OwnershipNotice[]>>((grouped, row) => {
    (grouped[row.plot_id] ??= []).push(mapNotice(row));
    return grouped;
  }, {});
}

export async function ownershipHistoryForNotices(noticeIds: string[]): Promise<Record<string, OwnershipEvent[]>> {
  if (noticeIds.length === 0) return {};
  const rows = await query<{
    id:string;notice_id:string;verification_id:string|null;event_type:string;actor:string;reason:string|null;snapshot:Record<string,unknown>;created_at:string;
  }>(`SELECT id,notice_id,verification_id,event_type,actor,reason,snapshot,created_at::text
        FROM registry.ownership_events WHERE notice_id=ANY($1::uuid[]) ORDER BY created_at ASC,id ASC`,[noticeIds]);
  return rows.reduce<Record<string,OwnershipEvent[]>>((grouped,row)=>{
    (grouped[row.notice_id]??=[]).push({id:row.id,noticeId:row.notice_id,verificationId:row.verification_id,eventType:row.event_type,actor:row.actor,reason:row.reason,snapshot:row.snapshot,createdAt:row.created_at});
    return grouped;
  },{});
}

export async function createOwnershipRequest(input:{noticeId:string;requestType:"challenge"|"correction";requesterName?:string|null;contactReference:string;reason:string;proposedCorrection?:Record<string,unknown>|null}):Promise<PublicOwnershipRequest>{
  const row=await queryOne<{id:string;notice_id:string;request_type:"challenge"|"correction";status:string;submitted_at:string;updated_at:string}>(
    `INSERT INTO registry.ownership_requests(notice_id,request_type,requester_name,contact_reference,reason,proposed_correction)
     VALUES($1,$2,$3,$4,$5,$6::jsonb) RETURNING id,notice_id,request_type,status,submitted_at::text,updated_at::text`,
    [input.noticeId,input.requestType,input.requesterName??null,input.contactReference,input.reason,JSON.stringify(input.proposedCorrection??null)]);
  if(!row)throw new Error("Could not create ownership request.");
  return {id:row.id,noticeId:row.notice_id,requestType:row.request_type,status:row.status,submittedAt:row.submitted_at,updatedAt:row.updated_at};
}

export async function publicRequestsForNotice(noticeId:string):Promise<PublicOwnershipRequest[]>{
  const rows=await query<{id:string;notice_id:string;request_type:"challenge"|"correction";status:string;submitted_at:string;updated_at:string}>(
    `SELECT id,notice_id,request_type,status,submitted_at::text,updated_at::text FROM registry.ownership_requests WHERE notice_id=$1 ORDER BY submitted_at DESC`,[noticeId]);
  return rows.map(row=>({id:row.id,noticeId:row.notice_id,requestType:row.request_type,status:row.status,submittedAt:row.submitted_at,updatedAt:row.updated_at}));
}

export async function withdrawOwnershipNotice(noticeId:string,managementKey:string,reason?:string|null):Promise<boolean>{
  const row=await queryOne<{management_key_hash:string|null}>(`SELECT management_key_hash FROM registry.ownership_notices WHERE id=$1`,[noticeId]);
  if(!row?.management_key_hash)return false;
  const expected=Buffer.from(row.management_key_hash,"hex"),actual=Buffer.from(keyHash(managementKey),"hex");
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return false;
  await query(`UPDATE registry.ownership_notices SET status='withdrawn' WHERE id=$1`,[noticeId]);
  await query(`INSERT INTO registry.ownership_events(notice_id,event_type,actor,reason,snapshot) VALUES($1,'withdrawal_confirmed','notice:management-key',$2,'{"status":"withdrawn"}'::jsonb)`,[noticeId,reason??"Withdrawn by management key"]);
  return true;
}
