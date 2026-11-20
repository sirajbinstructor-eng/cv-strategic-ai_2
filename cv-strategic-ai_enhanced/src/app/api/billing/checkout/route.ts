import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { checkoutRequestSchema } from "@/lib/billing/model";
import { BillingService, billingRepository } from "@/lib/billing/service";
import { PaddleAdapter } from "@/lib/billing/providers/paddle";
import { createPaddlePaymentIntent } from "@/lib/billing/paddle-checkout-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const service = new BillingService();
const adapter = new PaddleAdapter();

function appOrigin() {
  const configured = process.env.BETTER_AUTH_URL;
  if (!configured) throw new Error("The application public URL is not configured.");
  return new URL(configured).origin;
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid plan, interval or currency." }, { status: 400 });

  if (process.env.BILLING_PROVIDER_PADDLE_ENABLED !== "true") {
    return NextResponse.json({ error: "Paddle checkout is currently disabled. No payment has been created." }, { status: 503 });
  }
  const environment = process.env.PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox";
  if (environment === "sandbox" && process.env.BILLING_PADDLE_SANDBOX_ENABLED !== "true") {
    return NextResponse.json({ error: "Paddle sandbox checkout has not been explicitly enabled." }, { status: 503 });
  }
  if (environment === "live" && (process.env.BILLING_PADDLE_MERCHANT_APPROVED !== "true" || process.env.BILLING_PADDLE_SANDBOX_VERIFIED !== "true")) {
    return NextResponse.json({ error: "Paddle live checkout requires merchant approval and successful sandbox verification." }, { status: 503 });
  }
  if (parsed.data.currency === "TND") {
    return NextResponse.json({ error: "Paddle checkout is currently configured for USD and EUR. TND checkout will be handled by an approved Tunisian gateway." }, { status: 422 });
  }
  if (!process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN) {
    return NextResponse.json({ error: "Paddle's public client token is not configured." }, { status: 503 });
  }

  let pendingSubscriptionId: string | undefined;
  try {
    await ensureAuthSchema();
    const quote = await service.quote(session.user.id, parsed.data);
    const subscription = await billingRepository.createPending(session.user.id, {
      provider: "paddle",
      plan: parsed.data.plan,
      interval: parsed.data.interval,
      currency: parsed.data.currency,
      baseAmountMinor: quote.price.baseAmountMinor,
      discountPercent: quote.price.discountPercent,
      amountMinor: quote.price.amountMinor,
      discountApplicationId: quote.discountApplicationId
    });
    pendingSubscriptionId = String(subscription.id);
    const suppliedKey = request.headers.get("Idempotency-Key")?.trim() || "";
    const idempotencyKey = /^[0-9a-f-]{36}$/i.test(suppliedKey) ? suppliedKey : randomUUID();
    const origin = appOrigin();
    const checkout = await adapter.createCheckoutSession({
      product: "candidate",
      purpose: "subscription",
      customerId: session.user.id,
      referenceId: subscription.id,
      amountMinor: quote.price.amountMinor,
      currency: parsed.data.currency,
      successUrl: `${origin}/billing/checkout/paddle`,
      cancelUrl: `${origin}/pricing`,
      idempotencyKey,
      metadata: {
        plan: parsed.data.plan,
        interval: parsed.data.interval,
        discountPercent: String(quote.price.discountPercent),
        baseAmountMinor: String(quote.price.baseAmountMinor)
      }
    });
    const checkoutDestination = new URL(checkout.checkoutUrl);
    if (checkoutDestination.origin !== origin || checkoutDestination.pathname !== "/billing/checkout/paddle") {
      throw new Error("The Paddle checkout destination did not match the configured application origin.");
    }
    await createPaddlePaymentIntent({
      userId: session.user.id,
      subscriptionId: subscription.id,
      paddleTransactionId: checkout.providerCheckoutId,
      amountMinor: quote.price.amountMinor,
      currency: parsed.data.currency,
      idempotencyKey
    });
    return NextResponse.json({
      checkoutUrl: checkoutDestination.pathname + checkoutDestination.search,
      provider: "paddle",
      transactionId: checkout.providerCheckoutId,
      subscriptionId: subscription.id,
      amountMinor: quote.price.amountMinor,
      currency: parsed.data.currency,
      status: "pending",
      message: "Continue to Paddle's secure checkout. Your subscription activates only after a verified payment notification."
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (pendingSubscriptionId) await billingRepository.updateStatus(pendingSubscriptionId, "expired").catch(() => undefined);
    const e = error as { message?: string; status?: number };
    return NextResponse.json({ error: e.message || "Unable to create Paddle checkout." }, { status: e.status || 500 });
  }
}
