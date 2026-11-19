import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import type { BillingPlan,BillingInterval,BillingCurrency } from "./catalog";
import type { SubscriptionStatus } from "./model";
export class BillingRepository {
 async current(userId:string){
  const r=await pool.query(`SELECT id,provider,provider_subscription_id,plan,billing_interval,currency,base_amount_minor,discount_percent,amount_minor,status,current_period_start,current_period_end,cancel_at_period_end,canceled_at,created_at,updated_at
   FROM billing_subscriptions WHERE user_id=$1 AND (status IN ('active','past_due','canceled_at_period_end') OR (status='pending' AND created_at>NOW()-INTERVAL '30 minutes')) ORDER BY created_at DESC LIMIT 1`,[userId]);
  return r.rows[0]||null;
 }
 async createPending(userId:string,quote:{plan:BillingPlan;interval:BillingInterval;currency:BillingCurrency;baseAmountMinor:number;discountPercent:number;amountMinor:number;discountApplicationId:string|null}){
  const id=randomUUID();
  const r=await pool.query(`INSERT INTO billing_subscriptions(id,user_id,provider,plan,billing_interval,currency,base_amount_minor,discount_percent,amount_minor,status,discount_application_id)
   VALUES($1,$2,'unselected',$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING *`,
   [id,userId,quote.plan,quote.interval,quote.currency,quote.baseAmountMinor,quote.discountPercent,quote.amountMinor,quote.discountApplicationId]);
  return r.rows[0];
 }
 async activateVerified(input:{id:string;provider:"paddle"|"konnect"|"paymaster"|"manual";providerSubscriptionId:string;periodStart:Date;periodEnd:Date;status:SubscriptionStatus}){
  const client=await pool.connect();
  try{await client.query("BEGIN");
   const sub=await client.query("SELECT * FROM billing_subscriptions WHERE id=$1 FOR UPDATE",[input.id]);
   if(!sub.rowCount)throw Object.assign(Error("Subscription intent not found."),{status:404});
   if(!["pending","active","past_due","canceled_at_period_end"].includes(sub.rows[0].status))throw Object.assign(Error("This subscription can no longer be activated."),{status:409});
   const updated=await client.query(`UPDATE billing_subscriptions SET provider=$2,provider_subscription_id=$3,status=$4,current_period_start=$5,current_period_end=$6,updated_at=NOW()
    WHERE id=$1 RETURNING *`,[input.id,input.provider,input.providerSubscriptionId,input.status,input.periodStart,input.periodEnd]);
   await client.query("COMMIT");return updated.rows[0];
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e;}finally{client.release();}
 }
 async updateStatus(id:string,status:SubscriptionStatus,cancelAtPeriodEnd?:boolean){
  const r=await pool.query(`UPDATE billing_subscriptions SET status=COALESCE($2,status),cancel_at_period_end=COALESCE($3,cancel_at_period_end),updated_at=NOW() WHERE id=$1 RETURNING *`,[id,status??null,cancelAtPeriodEnd??null]);
  if(!r.rowCount)throw Object.assign(Error("Subscription not found."),{status:404});return r.rows[0];
 }
 async recordProviderEvent(provider:string,eventId:string,eventType:string){
  const r=await pool.query(`INSERT INTO billing_events(id,provider,provider_event_id,event_type,processing_status,received_at)
   VALUES($1,$2,$3,$4,'received',NOW()) ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id`,[randomUUID(),provider,eventId,eventType]);
  return {inserted:Boolean(r.rowCount),id:r.rows[0]?.id||null};
 }
 async markEvent(id:string,status:"processed"|"failed",errorCode?:string){
  await pool.query("UPDATE billing_events SET processing_status=$2,error_code=$3,processed_at=NOW() WHERE id=$1",[id,status,errorCode?.slice(0,80)||null]);
 }
 async listAdmin(limit=50,offset=0){
  const count=await pool.query("SELECT COUNT(*)::int AS total FROM billing_subscriptions");
  const rows=await pool.query(`SELECT b.id,b.user_id,u.name AS user_name,u.email AS user_email,b.provider,b.provider_subscription_id,b.plan,b.billing_interval,b.currency,b.base_amount_minor,b.discount_percent,b.amount_minor,b.status,b.current_period_start,b.current_period_end,b.cancel_at_period_end,b.created_at,b.updated_at
   FROM billing_subscriptions b JOIN "user" u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,[limit,offset]);
  return {subscriptions:rows.rows,total:Number(count.rows[0]?.total||0)};
 }

 async getActiveSubscription(userId:string,client=pool){
  const r=await client.query(`SELECT * FROM billing_subscriptions WHERE user_id=$1 AND status IN ('active','canceled_at_period_end') AND current_period_start<=NOW() AND current_period_end>NOW() ORDER BY current_period_end DESC LIMIT 1`,[userId]);
  return r.rows[0]||null;
 }
}
