import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { BillingRepository } from "@/lib/billing/repository";
import { PaddleAdapter } from "@/lib/billing/providers/paddle";
import { findPaddlePaymentByTransaction, getPaddlePaymentStatus, markPaddlePaymentPaid } from "@/lib/billing/paddle-checkout-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ provider: string }> };
const adapter = new PaddleAdapter();
const billingRepository = new BillingRepository();

function validDate(value: unknown): Date | null {
  if (!(typeof value === "string" || value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function amountBeforeTax(data: Record<string, any>): number | null {
  const totals = data.details?.totals || {};
  const subtotal = typeof totals.subtotal === "string" && /^\d+$/.test(totals.subtotal) ? Number(totals.subtotal) : NaN;
  const discount = typeof totals.discount === "string" && /^\d+$/.test(totals.discount) ? Number(totals.discount) : 0;
  return Number.isSafeInteger(subtotal) && Number.isSafeInteger(discount) && subtotal >= discount ? subtotal - discount : null;
}

async function activateSubscription(subscriptionId: string, paddleSubscriptionId: string, periodStart: Date, periodEnd: Date) {
  if (periodEnd <= periodStart) throw new Error("Paddle supplied an invalid subscription billing period.");
  const updated = await pool.query(
    `UPDATE billing_subscriptions
     SET provider='paddle',provider_subscription_id=$2,status='active',
         current_period_start=$3,current_period_end=$4,updated_at=NOW()
     WHERE id=$1 AND status IN ('pending','active','past_due','canceled_at_period_end')
     RETURNING id`,
    [subscriptionId, paddleSubscriptionId, periodStart, periodEnd]
  );
  if (!updated.rowCount) throw new Error("The local subscription is no longer eligible for activation.");
}

async function processInitialTransactionPaid(data: Record<string, any>, payment: Record<string, any>) {
  if (payment.status === "failed" || payment.status === "refunded" || payment.status === "disputed") {
    throw new Error("The local payment intent is no longer payable.");
  }
  const localSubscriptionId = String(payment.reference_id);
  const customSubscriptionId = data.custom_data?.app_subscription_id;
  if (customSubscriptionId && customSubscriptionId !== localSubscriptionId) {
    throw new Error("Paddle transaction reference does not match the local subscription intent.");
  }
  const amount = amountBeforeTax(data);
  if (data.currency_code !== payment.currency || amount === null || amount !== Number(payment.amount_minor)) {
    throw new Error("Paddle transaction amount or currency does not match the server-side payment intent.");
  }
  const subscriptionResult = await pool.query(
    `SELECT id,provider_subscription_id,current_period_start,current_period_end
     FROM billing_subscriptions WHERE id=$1 LIMIT 1`,
    [localSubscriptionId]
  );
  const subscription = subscriptionResult.rows[0];
  if (!subscription) throw new Error("The local subscription intent no longer exists.");
  await markPaddlePaymentPaid(String(data.id));
  const paddleSubscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : subscription.provider_subscription_id;
  const periodStart = validDate(data.billing_period?.starts_at) || validDate(subscription.current_period_start);
  const periodEnd = validDate(data.billing_period?.ends_at) || validDate(subscription.current_period_end);
  if (paddleSubscriptionId && periodStart && periodEnd) {
    await activateSubscription(localSubscriptionId, paddleSubscriptionId, periodStart, periodEnd);
  }
  // transaction.paid can arrive before subscription.created. In that case,
  // access stays pending until the signed subscription event supplies its ID.
}

async function processRenewalTransactionPaid(data: Record<string, any>) {
  const paddleSubscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : "";
  if (!paddleSubscriptionId) throw new Error("A recurring Paddle payment is missing its subscription reference.");
  const result = await pool.query(
    `SELECT id,user_id,amount_minor,currency,status
     FROM billing_subscriptions
     WHERE provider='paddle' AND provider_subscription_id=$1
     LIMIT 1`,
    [paddleSubscriptionId]
  );
  const subscription = result.rows[0];
  if (!subscription) throw new Error("No local subscription matches this Paddle renewal.");
  if (!["active","past_due","canceled_at_period_end"].includes(subscription.status)) {
    throw new Error("The Paddle renewal refers to a subscription that is not eligible for renewal.");
  }
  const amount = amountBeforeTax(data);
  if (data.currency_code !== subscription.currency || amount === null || amount !== Number(subscription.amount_minor)) {
    throw new Error("Paddle renewal amount or currency does not match the stored subscription price.");
  }
  const periodStart = validDate(data.billing_period?.starts_at);
  const periodEnd = validDate(data.billing_period?.ends_at);
  if (!periodStart || !periodEnd || periodEnd <= periodStart) {
    throw new Error("Paddle renewal is missing a valid billing period.");
  }

  const transactionId = String(data.id);
  await pool.query(
    `INSERT INTO payment_transactions
      (id,product,user_id,workspace_id,provider,provider_checkout_id,provider_transaction_id,reference_id,purpose,amount_minor,currency,status,idempotency_key,metadata)
     VALUES($1,'candidate',$2,NULL,'paddle',NULL,$3,$4,'subscription',$5,$6,'paid',$7,$8::jsonb)
     ON CONFLICT DO NOTHING`,
    [randomUUID(),subscription.user_id,transactionId,subscription.id,amount,subscription.currency,`paddle-renewal-${transactionId}`,JSON.stringify({renewal:true})]
  );
  await pool.query(
    `UPDATE billing_subscriptions
     SET status='active',current_period_start=$2,current_period_end=$3,updated_at=NOW()
     WHERE id=$1 AND status IN ('active','past_due','canceled_at_period_end')`,
    [subscription.id,periodStart,periodEnd]
  );
}

async function processSubscriptionEvent(eventType: string, data: Record<string, any>, transactionId?: string) {
  let localSubscriptionId = typeof data.custom_data?.app_subscription_id === "string" ? data.custom_data.app_subscription_id : "";
  if (!localSubscriptionId && transactionId) {
    const payment = await findPaddlePaymentByTransaction(transactionId);
    localSubscriptionId = payment?.reference_id || "";
  }
  if (!localSubscriptionId && typeof data.id === "string") {
    const existing = await pool.query("SELECT id FROM billing_subscriptions WHERE provider='paddle' AND provider_subscription_id=$1 LIMIT 1", [data.id]);
    localSubscriptionId = existing.rows[0]?.id || "";
  }
  if (!localSubscriptionId) throw new Error("No local subscription intent matches the Paddle subscription event.");

  const paymentStatus = transactionId ? await getPaddlePaymentStatus(transactionId) : null;
  const periodStart = validDate(data.current_billing_period?.starts_at);
  const periodEnd = validDate(data.current_billing_period?.ends_at);
  const paddleStatus = data.status;
  const scheduledCancel = data.scheduled_change?.action === "cancel";
  const isCanceled = paddleStatus === "canceled" || eventType === "subscription.canceled";
  const isPastDue = paddleStatus === "past_due" || eventType === "subscription.past_due";
  const prior = await pool.query("SELECT status FROM billing_subscriptions WHERE id=$1 LIMIT 1", [localSubscriptionId]);
  if (!prior.rowCount) throw new Error("The local subscription intent was not found.");

  let localStatus: string;
  if (isCanceled) localStatus = "expired";
  else if (isPastDue) localStatus = "past_due";
  else if (paddleStatus === "active" && (paymentStatus === "paid" || ["active","canceled_at_period_end"].includes(prior.rows[0].status))) localStatus = "active";
  else if (paddleStatus === "paused") localStatus = "past_due";
  else localStatus = prior.rows[0].status;

  // A subscription.updated event may precede a renewal payment. Do not extend
  // the paid-through period from that event; only transaction.paid/completed
  // advances the period. subscription.created can cache the first period while
  // pending so a later transaction.paid event can safely activate it.
  const saveInitialPeriod = eventType === "subscription.created" && prior.rows[0].status === "pending";
  await pool.query(
    `UPDATE billing_subscriptions SET provider='paddle',provider_subscription_id=$2,status=$3,
       current_period_start=CASE WHEN $7 THEN COALESCE($4,current_period_start) ELSE current_period_start END,
       current_period_end=CASE WHEN $7 THEN COALESCE($5,current_period_end) ELSE current_period_end END,
       cancel_at_period_end=$6,updated_at=NOW()
     WHERE id=$1`,
    [localSubscriptionId,data.id,localStatus,periodStart,periodEnd,scheduledCancel,saveInitialPeriod]
  );
}

export async function POST(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (provider !== "paddle") return NextResponse.json({ error: "Unsupported or inactive payment provider." }, { status: 404 });
  const rawBody = await request.text();
  try {
    await ensureAuthSchema();
    const event = await adapter.verifyWebhook(rawBody, request.headers);
    const recorded = await billingRepository.recordProviderEvent("paddle",event.eventId,event.eventType);
    let eventRecordId = recorded.id;
    if (!recorded.inserted) {
      const existing = await pool.query(
        "SELECT id,processing_status,received_at FROM billing_events WHERE provider='paddle' AND provider_event_id=$1 LIMIT 1",
        [event.eventId]
      );
      if (!existing.rowCount || existing.rows[0].processing_status === "processed") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (existing.rows[0].processing_status === "received") {
        const receivedAt = new Date(existing.rows[0].received_at).getTime();
        if (Number.isFinite(receivedAt) && Date.now() - receivedAt < 120_000) {
          return NextResponse.json({ error: "Event is already being processed." }, { status: 409 });
        }
        await pool.query("UPDATE billing_events SET processing_status='failed',error_code='stale_processing_lease' WHERE id=$1 AND processing_status='received'", [existing.rows[0].id]);
      }
      eventRecordId = existing.rows[0].id;
    }
    if (!eventRecordId) return NextResponse.json({ error: "Unable to register webhook event." }, { status: 503 });
    try {
      const data = event.data || {};
      if (event.rawType === "transaction.paid" || event.rawType === "transaction.completed") {
        const payment = await findPaddlePaymentByTransaction(String(data.id || ""));
        if (payment) await processInitialTransactionPaid(data,payment);
        else await processRenewalTransactionPaid(data);
      } else if (event.rawType.startsWith("subscription.")) {
        await processSubscriptionEvent(event.rawType,data,typeof data.transaction_id === "string" ? data.transaction_id : undefined);
      } else if (event.rawType === "transaction.payment_failed" || event.rawType === "transaction.past_due") {
        const transactionId = typeof data.id === "string" ? data.id : "";
        const payment = await findPaddlePaymentByTransaction(transactionId);
        if (payment) {
          await pool.query("UPDATE payment_transactions SET status='failed',updated_at=NOW() WHERE provider='paddle' AND provider_transaction_id=$1 AND status='pending'",[transactionId]);
          await pool.query("UPDATE billing_subscriptions SET status=CASE WHEN status='pending' THEN 'expired' ELSE 'past_due' END,updated_at=NOW() WHERE id=$1 AND status IN ('pending','active')",[payment.reference_id]);
        } else if (typeof data.subscription_id === "string") {
          await pool.query("UPDATE billing_subscriptions SET status='past_due',updated_at=NOW() WHERE provider='paddle' AND provider_subscription_id=$1 AND status IN ('active','canceled_at_period_end')",[data.subscription_id]);
        }
      }
      await billingRepository.markEvent(eventRecordId,"processed");
      return NextResponse.json({ received: true });
    } catch (error) {
      await billingRepository.markEvent(eventRecordId,"failed","event_processing_failed");
      console.error("[billing] Paddle webhook processing failed:",error);
      return NextResponse.json({ error: "Paddle event could not be processed. The provider may retry delivery." },{status:500});
    }
  } catch (error) {
    const e = error as { message?: string; status?: number };
    return NextResponse.json({ error: e.message || "Invalid Paddle webhook." },{status:e.status || 400});
  }
}
