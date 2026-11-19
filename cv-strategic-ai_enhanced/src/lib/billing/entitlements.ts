import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import { PLAN_QUOTAS,type BillingPlan,type BillingInterval } from "./catalog";
import { BillingRepository } from "./repository";
const repo=new BillingRepository();
export type BillingReservation={id:string;source:"free"|"subscription";periodStart:string|null;feature:"analysis"|"cv_generation"};
async function getPeriod(client:any,userId:string,sub:any){
 const start=new Date(sub.current_period_start),end=new Date(sub.current_period_end);
 const plan=sub.plan as BillingPlan,interval=sub.billing_interval as BillingInterval;
 const quotas=PLAN_QUOTAS[plan][interval];
 await client.query(`INSERT INTO billing_usage_periods(id,user_id,period_start,period_end,plan,billing_interval,analyses_limit,generations_limit)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,period_start) DO NOTHING`,
  [randomUUID(),userId,start,end,plan,interval,quotas.analyses,quotas.generations]);
 const row=await client.query("SELECT * FROM billing_usage_periods WHERE user_id=$1 AND period_start=$2 FOR UPDATE",[userId,start]);
 return row.rows[0];
}
export async function reserveSubscriptionAnalysis(userId:string):Promise<BillingReservation|null>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const user=await client.query('SELECT is_admin,is_unrestricted FROM "user" WHERE id=$1 FOR UPDATE',[userId]);
  if(!user.rowCount)throw Error("Account not found.");
  if(user.rows[0].is_admin||user.rows[0].is_unrestricted){await client.query("COMMIT");return null;}
  const sub=await repo.getActiveSubscription(userId,client);
  if(!sub){await client.query("COMMIT");return null;}
  const period=await getPeriod(client,userId,sub);
  const update=await client.query(`UPDATE billing_usage_periods SET analyses_reserved=analyses_reserved+1,updated_at=NOW()
   WHERE id=$1 AND analyses_used+analyses_reserved<analyses_limit RETURNING id`,[period.id]);
  if(!update.rowCount)throw Object.assign(Error("You have reached your analysis quota for this billing period. Upgrade your plan or wait for the next period."),{status:402,code:"ANALYSIS_QUOTA_EXHAUSTED"});
  const id=randomUUID();await client.query("INSERT INTO entitlement_reservations(id,user_id,feature,source,usage_period_start,status) VALUES($1,$2,'analysis','subscription',$3,'reserved')",[id,userId,period.period_start]);
  await client.query("INSERT INTO analysis_usage(id,user_id,status,mode) VALUES($1,$2,'reserved','automatic')",[id,userId]);
  await client.query("COMMIT");return {id,source:"subscription",periodStart:new Date(period.period_start).toISOString(),feature:"analysis"};
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
}
export async function reserveCvGeneration(userId:string,analysisId:string):Promise<BillingReservation>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const user=await client.query('SELECT is_admin,is_unrestricted,analysis_trials_used FROM "user" WHERE id=$1 FOR UPDATE',[userId]);
  if(!user.rowCount)throw Object.assign(Error("Account not found."),{status:404});
  const analysis=await client.query("SELECT id FROM analysis_records WHERE id=$1 AND user_id=$2",[analysisId,userId]);
  if(!analysis.rowCount)throw Object.assign(Error("This analysis is unavailable."),{status:404});
  if(user.rows[0].is_admin||user.rows[0].is_unrestricted){await client.query("COMMIT");return {id:"",source:"free",periodStart:null,feature:"cv_generation"};}
  const sub=await repo.getActiveSubscription(userId,client);
  if(sub){const period=await getPeriod(client,userId,sub);const update=await client.query(`UPDATE billing_usage_periods SET generations_reserved=generations_reserved+1,updated_at=NOW()
    WHERE id=$1 AND generations_used+generations_reserved<generations_limit RETURNING id`,[period.id]);
   if(!update.rowCount)throw Object.assign(Error("You have reached your CV generation quota for this billing period."),{status:402,code:"GENERATION_QUOTA_EXHAUSTED"});
   const id=randomUUID();await client.query("INSERT INTO entitlement_reservations(id,user_id,feature,source,usage_period_start,status) VALUES($1,$2,'cv_generation','subscription',$3,'reserved')",[id,userId,period.period_start]);
   await client.query("COMMIT");return {id,source:"subscription",periodStart:new Date(period.period_start).toISOString(),feature:"cv_generation"};
  }
  if(Number(user.rows[0].analysis_trials_used)<1)throw Object.assign(Error("Complete an eligible analysis before generating your first CV."),{status:402});
  const count=await client.query("SELECT COUNT(*)::int AS total FROM entitlement_reservations WHERE user_id=$1 AND feature='cv_generation' AND source='free' AND status IN ('reserved','consumed')",[userId]);
  if(Number(count.rows[0].total)>=1)throw Object.assign(Error("Your one free CV generation has already been used. Upgrade to generate more CVs."),{status:402,code:"FREE_GENERATION_USED"});
  const id=randomUUID();await client.query("INSERT INTO entitlement_reservations(id,user_id,feature,source,status) VALUES($1,$2,'cv_generation','free','reserved')",[id,userId]);
  await client.query("COMMIT");return {id,source:"free",periodStart:null,feature:"cv_generation"};
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
}
export async function completeEntitlementReservation(reservation:BillingReservation){
 if(!reservation.id)return;
 const client=await pool.connect();try{await client.query("BEGIN");
  const updated=await client.query("UPDATE entitlement_reservations SET status='consumed',completed_at=NOW() WHERE id=$1 AND status='reserved' RETURNING id,user_id,feature,source,usage_period_start",[reservation.id]);
  if(!updated.rowCount)throw Error("Entitlement reservation is no longer valid.");
  const row=updated.rows[0];
  if(row.source==="subscription"){
   const col=row.feature==="analysis"?"analyses":"generations";
   const r=await client.query(`UPDATE billing_usage_periods SET ${col}_reserved=GREATEST(0,${col}_reserved-1),${col}_used=${col}_used+1,updated_at=NOW() WHERE user_id=$1 AND period_start=$2`,[row.user_id,row.usage_period_start]);
   if(!r.rowCount)throw Error("Billing usage period not found.");
  }
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
}
export async function releaseEntitlementReservation(reservation:BillingReservation){
 if(!reservation.id)return;
 const client=await pool.connect();try{await client.query("BEGIN");
  const r=await client.query("UPDATE entitlement_reservations SET status='released',completed_at=NOW() WHERE id=$1 AND status='reserved' RETURNING user_id,feature,source,usage_period_start",[reservation.id]);
  if(r.rowCount&&r.rows[0].source==="subscription"){
   const col=r.rows[0].feature==="analysis"?"analyses":"generations";
   await client.query(`UPDATE billing_usage_periods SET ${col}_reserved=GREATEST(0,${col}_reserved-1),updated_at=NOW() WHERE user_id=$1 AND period_start=$2`,[r.rows[0].user_id,r.rows[0].usage_period_start]);
  }
  await client.query("COMMIT");
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
}
export async function getBillingEntitlements(userId:string){
 const sub=await repo.getActiveSubscription(userId);
 if(!sub)return null;
 const client=await pool.connect();try{const period=await getPeriod(client,userId,sub);return {plan:sub.plan,interval:sub.billing_interval,status:sub.status,currency:sub.currency,amountMinor:sub.amount_minor,discountPercent:sub.discount_percent,periodStart:new Date(period.period_start).toISOString(),periodEnd:new Date(period.period_end).toISOString(),analyses:{limit:Number(period.analyses_limit),used:Number(period.analyses_used),reserved:Number(period.analyses_reserved),remaining:Math.max(0,Number(period.analyses_limit)-Number(period.analyses_used)-Number(period.analyses_reserved))},generations:{limit:Number(period.generations_limit),used:Number(period.generations_used),reserved:Number(period.generations_reserved),remaining:Math.max(0,Number(period.generations_limit)-Number(period.generations_used)-Number(period.generations_reserved))}};}finally{client.release();}
}
