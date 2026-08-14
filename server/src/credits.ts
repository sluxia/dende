import {pool,query} from "./db";
import {activeProduct} from "./catalog";

export interface CreditBalance{available:number;reserved:number;consumed:number;expired:number;promotionalAvailable:number;purchasedAvailable:number}

export async function ensureIntroductoryCredits(userId:string){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const eligible=(await client.query(`SELECT EXISTS(SELECT 1 FROM accounts.identities WHERE user_id=$1 AND verification_status='verified') eligible`,[userId])).rows[0].eligible;
    if(!eligible){await client.query("ROLLBACK");return null;}
    let wallet=(await client.query(`SELECT id FROM accounts.credit_wallets WHERE owner_user_id=$1`,[userId])).rows[0];
    if(!wallet)wallet=(await client.query(`INSERT INTO accounts.credit_wallets(owner_user_id) VALUES($1) ON CONFLICT(owner_user_id) WHERE owner_user_id IS NOT NULL DO UPDATE SET owner_user_id=EXCLUDED.owner_user_id RETURNING id`,[userId])).rows[0];
    await client.query(`INSERT INTO accounts.credit_ledger(wallet_id,entry_type,quantity,bucket,product_key,actor_user_id,idempotency_key,reason,expires_at)
      VALUES($1,'grant',3,'promotional','introductory-check-credits',$2,$3,'One-time introductory grant after identity verification',now()+interval '90 days') ON CONFLICT(idempotency_key) DO NOTHING`,[wallet.id,userId,`introductory-grant:${userId}`]);
    await client.query("COMMIT");return wallet.id as string;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function creditBalance(walletId:string):Promise<CreditBalance>{
  const rows=await query<{bucket:string;available:number;reserved:number;consumed:number;expired:number}>(`SELECT bucket,
    COALESCE(sum(CASE WHEN entry_type IN('grant','purchase','release','refund','transfer_in') THEN quantity WHEN entry_type IN('reserve','expire','transfer_out') THEN -quantity ELSE 0 END),0)::int available,
    COALESCE(sum(CASE WHEN entry_type='reserve' THEN quantity WHEN entry_type IN('consume','release') THEN -quantity ELSE 0 END),0)::int reserved,
    COALESCE(sum(CASE WHEN entry_type='consume' THEN quantity ELSE 0 END),0)::int consumed,
    COALESCE(sum(CASE WHEN entry_type='expire' THEN quantity ELSE 0 END),0)::int expired
    FROM accounts.credit_ledger WHERE wallet_id=$1 GROUP BY bucket`,[walletId]);
  const promo=rows.find(r=>r.bucket==='promotional'),purchased=rows.find(r=>r.bucket==='purchased');
  return{available:rows.reduce((n,r)=>n+r.available,0),reserved:rows.reduce((n,r)=>n+r.reserved,0),consumed:rows.reduce((n,r)=>n+r.consumed,0),expired:rows.reduce((n,r)=>n+r.expired,0),promotionalAvailable:promo?.available??0,purchasedAvailable:purchased?.available??0};
}

export async function releaseExpiredReservations(input:{walletId?:string;limit?:number}={}){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const limit=Math.max(1,Math.min(500,input.limit??100));
    const params:unknown[]=[];let walletFilter="";
    if(input.walletId){params.push(input.walletId);walletFilter=`AND wallet_id=$${params.length}`;}
    params.push(limit);
    const expired=(await client.query(`SELECT id,wallet_id,quantity,bucket,product_key,related_reference FROM accounts.credit_reservations
      WHERE status='active' AND expires_at<=now() ${walletFilter} ORDER BY expires_at FOR UPDATE SKIP LOCKED LIMIT $${params.length}`,params)).rows;
    for(const r of expired){
      await client.query(`INSERT INTO accounts.credit_ledger(wallet_id,entry_type,quantity,bucket,product_key,related_reference,reservation_id,idempotency_key,reason)
        VALUES($1,'release',$2,$3,$4,$5,$6,$7,'Reservation expired before completion') ON CONFLICT(idempotency_key) DO NOTHING`,[r.wallet_id,r.quantity,r.bucket,r.product_key,r.related_reference,r.id,`timeout-release:${r.id}`]);
      await client.query(`UPDATE accounts.credit_reservations SET status='expired',completed_at=now() WHERE id=$1 AND status='active'`,[r.id]);
    }
    await client.query("COMMIT");return{released:expired.length,reservationIds:expired.map(r=>r.id as string)};
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}

export async function creditsForUser(userId:string){const walletId=await ensureIntroductoryCredits(userId);if(!walletId)return null;await releaseExpiredReservations({walletId});return{walletId,balance:await creditBalance(walletId)};}

export async function reserveUserCredits(input:{userId:string;productKey:string;relatedReference?:string;idempotencyKey:string}){
  const product=await activeProduct(input.productKey);
  if(!product?.credit_cost)throw new Error("This product is not available for credits.");
  const quantity=product.credit_cost;
  const credits=await creditsForUser(input.userId);
  if(!credits)throw new Error("Verify your email before using credits.");
  const bucket=credits.balance.promotionalAvailable>=quantity?"promotional":credits.balance.purchasedAvailable>=quantity?"purchased":null;
  if(!bucket)throw new Error("Insufficient credits.");
  return reserveCredits({walletId:credits.walletId,quantity,bucket,productKey:input.productKey,relatedReference:input.relatedReference,idempotencyKey:input.idempotencyKey});
}

export async function reserveCredits(input:{walletId:string;quantity:number;bucket:"promotional"|"purchased";productKey:string;relatedReference?:string;idempotencyKey:string;ttlMinutes?:number}){
  if(!Number.isInteger(input.quantity)||input.quantity<1)throw new Error("Credit quantity must be a positive integer.");
  await releaseExpiredReservations({walletId:input.walletId});
  const client=await pool.connect();try{await client.query("BEGIN");await client.query(`SELECT id FROM accounts.credit_wallets WHERE id=$1 AND status='active' FOR UPDATE`,[input.walletId]);
    const existing=(await client.query(`SELECT id,status,quantity,product_key AS "productKey" FROM accounts.credit_reservations WHERE idempotency_key=$1`,[input.idempotencyKey])).rows[0];if(existing){await client.query("COMMIT");return existing;}
    const available=Number((await client.query(`SELECT COALESCE(sum(CASE WHEN entry_type IN('grant','purchase','release','refund','transfer_in') THEN quantity WHEN entry_type IN('reserve','expire','transfer_out') THEN -quantity ELSE 0 END),0) value FROM accounts.credit_ledger WHERE wallet_id=$1 AND bucket=$2`,[input.walletId,input.bucket])).rows[0].value);
    if(available<input.quantity)throw new Error("Insufficient credits.");
    const reservation=(await client.query(`INSERT INTO accounts.credit_reservations(wallet_id,quantity,bucket,product_key,related_reference,idempotency_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+($7||' minutes')::interval) RETURNING id,status,quantity,product_key AS "productKey"`,[input.walletId,input.quantity,input.bucket,input.productKey,input.relatedReference??null,input.idempotencyKey,String(input.ttlMinutes??15)])).rows[0];
    await client.query(`INSERT INTO accounts.credit_ledger(wallet_id,entry_type,quantity,bucket,product_key,related_reference,reservation_id,idempotency_key,reason) VALUES($1,'reserve',$2,$3,$4,$5,$6,$7,'Reserved before processing')`,[input.walletId,input.quantity,input.bucket,input.productKey,input.relatedReference??null,reservation.id,`reserve:${input.idempotencyKey}`]);await client.query("COMMIT");return reservation;
  }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}

export async function completeReservation(reservationId:string,outcome:"consume"|"release",idempotencyKey:string){
  await releaseExpiredReservations({limit:100});
  const client=await pool.connect();try{await client.query("BEGIN");const r=(await client.query(`SELECT * FROM accounts.credit_reservations WHERE id=$1 FOR UPDATE`,[reservationId])).rows[0];if(!r)throw new Error("Credit reservation not found.");if(r.status!=="active"){await client.query("COMMIT");return{status:r.status};}const status=outcome==='consume'?'consumed':'released';await client.query(`INSERT INTO accounts.credit_ledger(wallet_id,entry_type,quantity,bucket,product_key,related_reference,reservation_id,idempotency_key,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(idempotency_key) DO NOTHING`,[r.wallet_id,outcome,r.quantity,r.bucket,r.product_key,r.related_reference,r.id,idempotencyKey,outcome==='consume'?'Processing completed successfully':'Processing failed or was cancelled']);await client.query(`UPDATE accounts.credit_reservations SET status=$2,completed_at=now() WHERE id=$1`,[r.id,status]);await client.query("COMMIT");return{status};}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}
