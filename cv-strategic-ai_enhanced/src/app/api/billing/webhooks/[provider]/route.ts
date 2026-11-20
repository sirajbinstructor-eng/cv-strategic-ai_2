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

async function activateSubscription(subscriptionId: string, paddleSubscriptionId: string, periodStart: Date, periodEnd: Date) {
  if (periodEnd <= periodStart) throw new Error("Paddle supplied an invalid subscription billing period.");
  await pool.query(
    `UPDATE billing_subscriptions
     SET provider='paddle',provider_subscription_id=$2,status='active',
         current_period_start=$3,current_period_end=$4,cancel_at_period_end=false,updated_at=NOW()
     WHERE id=$1 AND status IN ('pending','active','past_due','canceled_at_period_end')`,
    [subscriptionId, paddleSubscriptionId, periodStart, periodEnd]
  );
}

async function processTransactionPaid(data: Record<string, any>) {
  const transactionId = typeof data.id === "string" ? data.id : "";
  const payment = await findPaddlePaymentByTransaction(transactionId);
  if (!payment) throw new Error("No local payment intent matches the Paddle transaction.");
  if (payment.status === "failed" || payment.status === "refunded" || payment.status === "disputed") throw new Error("The local payment intent is no longer payable.");
  const localSubscriptionId = payment.reference_id;
  const customSubscriptionId = data.custom_data?.app_subscription_id;
  if (customSubscriptionId && customSubscriptionId !== localSubscriptionId) {
    throw new Error("Paddle transaction reference does not match the local subscription intent.");
  }
  const currency = data.currency_code;
  const amount = data.details?.totals?.total;
  if (currency !== payment.currency || typeof amount !== "string" || !/^\d+$/.test(amount) || Number(amount) !== Number(payment.amount_minor)) {
    throw new Error("Paddle transaction amount or currency does not match the server-side payment intent.");
  }
  await markPaddlePaymentPaid(transactionId);

  const subscriptionResult = await pool.query(
    `SELECT id,provider_subscription_id,current_period_start,current_period_end
     FROM billing_subscriptions WHERE id=$1 LIMIT 1`,
    [localSubscriptionId]
  );
  const subscription = subscriptionResult.rows[0];
  if (!subscription) throw new Error("The local subscription intent no longer exists.");
  const paddleSubscriptionId = typeof data.subscription_id === "string" ? data.subscription_id : subscription.provider_subscription_id;
  const periodStart = validDate(data.billing_period?.starts_at) || validDate(subscription.current_period_start);
  const periodEnd = validDate(data.billing_period?.ends_at) || validDate(subscription.current_period_end);
  if (paddleSubscriptionId && periodStart && periodEnd) {
    await activateSubscription(localSubscriptionId, paddleSubscriptionId, periodStart, periodEnd);
  }
  // Paddle may send transaction.paid before subscription.created. In that
  // case access remains pending until the signed subscription event arrives.
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
  else if (paddleStatus === "active" && (paymentStatus === "paid" || ["active","past_due","canceled_at_period_end"].includes(prior.rows[0].status))) localStatus = "active";
  else if (paddleStatus === "paused") localStatus = "past_due";
  else localStatus = prior.rows[0].status;

  await pool.query(
    `UPDATE billing_subscriptions SET provider='paddle',provider_subscription_id=$2,status=$3,
       current_period_start=COALESCE($4,current_period_start),
       current_period_end=COALESCE($5,current_period_end),
       cancel_at_period_end=$6,updated_at=NOW()
     WHERE id=$1`,
    [localSubscriptionId, data.id, localStatus, periodStart, periodEnd, scheduledCancel]
  );
}

export async function POST(request: NextRequest, context: Context) {
  const { provider } = await context.params;
  if (provider !== "paddle") return NextResponse.json({ error: "Unsupported or inactive payment provider." }, { status: 404 });
  const rawBody = await request.text();
  try {
    await ensureAuthSchema();
    const event = await adapter.verifyWebhook(rawBody, request.headers);
    const recorded = await billingRepository.recordProviderEvent("paddle", event.eventId, event.eventType);
    let eventRecordId = recorded.id;
    if (!recorded.inserted) {
      const existing = await pool.query(
        "SELECT id,processing_status FROM billing_events WHERE provider='paddle' AND provider_event_id=$1 LIMIT 1",
        [event.eventId]
      );
      if (!existing.rowCount || existing.rows[0].processing_status === "processed") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      if (existing.rows[0].processing_status === "received") {
        return NextResponse.json({ error: "Event is already being processed." }, { status: 409 });
      }
      eventRecordId = existing.rows[0].id;
    }
    if (!eventRecordId) return NextResponse.json({ error: "Unable to register webhook event." }, { status: 503 });
    try {
      const data = event.data || {};
      if (event.rawType === "transaction.paid" || event.rawType === "transaction.completed") {
        await processTransactionPaid(data);
      } else if (event.rawType.startsWith("subscription.")) {
        await processSubscriptionEvent(event.rawType, data, typeof data.transaction_id === "string" ? data.transaction_id : undefined);
      } else if (event.rawType === "transaction.payment_failed" || event.rawType === "transaction.past_due") {
        const transactionId = typeof data.id === "string" ? data.id : "";
        const payment = await findPaddlePaymentByTransaction(transactionId);
        if (payment) {
          await pool.query("UPDATE payment_transactions SET status='failed',updated_at=NOW() WHERE provider='paddle' AND provider_transaction_id=$1 AND status='pending'", [transactionId]);
          await pool.query("UPDATE billing_subscriptions SET status=CASE WHEN status='pending' THEN 'expired' ELSE 'past_due' END,updated_at=NOW() WHERE id=$1 AND status IN ('pending','active')", [payment.reference_id]);
        }
      }
      if (eventRecordId) await billingRepository.markEvent(eventRecordId, "processed");
      return NextResponse.json({ received: true });
    } catch (error) {
      if (eventRecordId) await billingRepository.markEvent(eventRecordId, "failed", "event_processing_failed");
      console.error("[billing] Paddle webhook processing failed:", error);
      return NextResponse.json({ error: "Paddle event could not be processed. The provider may retry delivery." }, { status: 500 });
    }
  } catch (error) {
    const e = error as { message?: string; status?: number };
    return NextResponse.json({ error: e.message || "Invalid Paddle webhook." }, { status: e.status || 400 });
  }
}
