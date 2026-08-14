import { FastifyRequest } from "fastify";
import { config } from "./config";
import { currentAccount, parseSessionCookie } from "./accounts";
import { query, queryOne } from "./db";

export type SystemPermission = "internal.read" | "intelligence.write" | "intelligence.review" | "sources.manage" | "credits.manage" | "commerce.manage" | "commerce.read";
export interface StaffAccess { allowed:boolean; statusCode?:401|403; error?:string; actorType?:"user"|"worker"; userId?:string; }

async function audit(request:FastifyRequest,permission:SystemPermission,outcome:"allowed"|"denied",actor:{userId?:string;workerIdentity?:string}){
  await query(`INSERT INTO accounts.privileged_access_events(actor_user_id,worker_identity,permission,method,path,outcome,request_context)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[actor.userId??null,actor.workerIdentity??null,permission,request.method,request.url.split("?")[0],outcome,JSON.stringify({ipAddress:request.ip,userAgent:request.headers["user-agent"]??null})]);
}

export async function systemAccessFor(request:FastifyRequest,permission:SystemPermission):Promise<StaffAccess>{
  const supplied=request.headers["x-dende-ingestion-key"];
  if(supplied!==undefined){
    const worker={workerIdentity:"intelligence-worker"};
    if(config.intelligenceIngestionKey&&supplied===config.intelligenceIngestionKey){await audit(request,permission,"allowed",worker);return{allowed:true,actorType:"worker"};}
    await audit(request,permission,"denied",worker);return{allowed:false,statusCode:401,error:"Invalid intelligence worker credential."};
  }
  const account=await currentAccount(parseSessionCookie(request.headers.cookie));
  if(!account){await audit(request,permission,"denied",{workerIdentity:"anonymous"});return{allowed:false,statusCode:401,error:"Sign in with an authorized staff account."};}
  const grant=await queryOne<{role:string}>(`SELECT a.role FROM accounts.system_role_assignments a JOIN accounts.system_role_permissions p ON p.role=a.role
    WHERE a.user_id=$1 AND a.status='active' AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()) AND p.permission=$2 LIMIT 1`,[account.id,permission]);
  await audit(request,permission,grant?"allowed":"denied",{userId:account.id});
  return grant?{allowed:true,actorType:"user",userId:account.id}:{allowed:false,statusCode:403,error:"Your staff role does not grant this permission."};
}

export async function staffProfile(userId:string){
  const assignments=await query<{role:string;startsAt:string;expiresAt:string|null}>(`SELECT role,starts_at::text AS "startsAt",expires_at::text AS "expiresAt" FROM accounts.system_role_assignments WHERE user_id=$1 AND status='active' AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now()) ORDER BY role`,[userId]);
  const permissions=await query<{permission:string}>(`SELECT DISTINCT p.permission FROM accounts.system_role_assignments a JOIN accounts.system_role_permissions p ON p.role=a.role WHERE a.user_id=$1 AND a.status='active' AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()) ORDER BY p.permission`,[userId]);
  return{assignments,permissions:permissions.map(p=>p.permission)};
}
