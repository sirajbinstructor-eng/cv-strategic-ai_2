import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProviderAdapter, CreateCheckoutSessionInput, CheckoutSessionResult, VerifiedProviderEvent } from "./types";
import { PaymentProviderUnavailableError } from "./types";

type PaddleEnvironment = "sandbox" | "live";
type PaddleJson = Record<string, any>;

function paddleEnvironment(): PaddleEnvironment {
  return process.env.PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox";
}
function paddleApiBaseUrl() {
  return paddleEnvironment() === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}
function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PaymentProviderUnavailableError(`Paddle is not configured: ${name} is missing.`);
  return value;
}
function priceIdFor(input: CreateCheckoutSessionInput): string {
  if (input.product !== "candidate" || input.purpose !== "subscription") {
    throw new PaymentProviderUnavailableError("Paddle checkout currently supports candidate subscriptions only.");
  }
  if (input.currency !== "USD" && input.currency !== "EUR") {
    throw new PaymentProviderUnavailableError("Paddle checkout is currently configured for USD and EUR. Select a supported local payment method for TND.");
  }
  const plan = input.metadata.plan?.toUpperCase();
  const interval = input.metadata.interval?.toUpperCase();
  if (!["PRO", "CONSULTANT"].includes(plan || "") || !["MONTHLY", "ANNUAL"].includes(interval || "")) {
    throw new PaymentProviderUnavailableError("The server-side candidate plan mapping is invalid.");
  }
  return requiredEnv(`PADDLE_PRICE_${plan}_${interval}_${input.currency}`);
}

async function paddleRequest(path: string, init: RequestInit = {}): Promise<PaddleJson> {
  const apiKey = requiredEnv("PADDLE_API_KEY");
  const response = await fetch(`${paddleApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": "1",
      ...(init.headers || {})
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({})) as PaddleJson;
  if (!response.ok) {
    const code = typeof payload.error?.code === "string" ? payload.error.code : "provider_error";
    // Do not return provider response bodies: they may contain customer or account details.
    throw Object.assign(new Error(`Paddle rejected the checkout request (${code}).`), { status: response.status, providerCode: code });
  }
  return payload;
}

export function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!signatureHeader || !secret || rawBody.length === 0) return false;
  const fields = signatureHeader.split(";").map((part) => part.trim().split("=", 2));
  const timestamp = fields.find(([key]) => key === "ts")?.[1];
  const signatures = fields.filter(([key]) => key === "h1").map(([, value]) => value).filter(Boolean);
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(nowSeconds - timestampNumber) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}:${rawBody}`, "utf8").digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}

export class PaddleAdapter implements PaymentProviderAdapter {
  readonly id = "paddle" as const;

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult> {
    const priceId = priceIdFor(input);
    const expectedBaseAmount = Number(input.metadata.baseAmountMinor);
    const expectedCurrency = input.currency;
    if (!Number.isSafeInteger(expectedBaseAmount) || expectedBaseAmount <= 0) {
      throw new Error("Invalid server-calculated base amount.");
    }

    const priceResponse = await paddleRequest(`/prices/${encodeURIComponent(priceId)}`);
    const price = priceResponse.data as PaddleJson | undefined;
    const unitPrice = price?.unit_price as PaddleJson | undefined;
    const cycle = price?.billing_cycle as PaddleJson | null | undefined;
    if (!price || unitPrice?.currency_code !== expectedCurrency || Number(unitPrice?.amount) !== expectedBaseAmount) {
      throw new Error("The configured Paddle price does not match the server-owned catalogue. Checkout was stopped.");
    }
    const expectedCycle = input.metadata.interval === "annual" ? "year" : "month";
    if (!cycle || cycle.interval !== expectedCycle || Number(cycle.frequency) !== 1) {
      throw new Error("The configured Paddle price has the wrong billing interval. Checkout was stopped.");
    }

    const percent = Number(input.metadata.discountPercent || 0);
    let discountId: string | undefined;
    if (percent > 0) {
      if (![10, 20, 40].includes(percent)) throw new Error("Unsupported discount percentage.");
      discountId = requiredEnv(`PADDLE_DISCOUNT_${percent}_ID`);
      const discountResponse = await paddleRequest(`/discounts/${encodeURIComponent(discountId)}`);
      const discount = discountResponse.data as PaddleJson | undefined;
      if (!discount || discount.status !== "active" || discount.type !== "percentage" || Number(discount.amount) !== percent) {
        throw new Error("The configured Paddle discount does not match the approved application. Checkout was stopped.");
      }
    }

    const body: PaddleJson = {
      items: [{ price_id: priceId, quantity: 1 }],
      collection_mode: "automatic",
      custom_data: {
        app_product: "candidate",
        app_subscription_id: input.referenceId,
        app_user_id: input.customerId,
        app_checkout_version: "1"
      }
    };
    if (discountId) body.discount_id = discountId;
    const response = await paddleRequest("/transactions", {
      method: "POST",
      headers: { "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify(body)
    });
    const transaction = response.data as PaddleJson | undefined;
    const transactionId = transaction?.id;
    if (typeof transactionId !== "string" || !/^txn_[a-z0-9]{26}$/i.test(transactionId)) {
      throw new Error("Paddle did not return a valid transaction reference.");
    }

    // The application checkout page opens the draft transaction with Paddle.js.
    // No provider URL or browser redirect is treated as proof of payment.
    return {
      provider: "paddle",
      checkoutUrl: `${input.successUrl}?transactionId=${encodeURIComponent(transactionId)}`,
      providerCheckoutId: transactionId
    };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedProviderEvent> {
    const secret = requiredEnv("PADDLE_WEBHOOK_SECRET");
    const signature = headers.get("Paddle-Signature") || "";
    if (!verifyPaddleSignature(rawBody, signature, secret)) {
      throw Object.assign(new Error("Invalid or expired Paddle webhook signature."), { status: 401 });
    }
    let payload: PaddleJson;
    try { payload = JSON.parse(rawBody) as PaddleJson; }
    catch { throw Object.assign(new Error("Invalid Paddle webhook JSON."), { status: 400 }); }

    const eventId = payload.event_id;
    const eventType = payload.event_type;
    const data = payload.data as PaddleJson | undefined;
    if (typeof eventId !== "string" || !/^evt_[a-z0-9]{26}$/i.test(eventId)
      || typeof eventType !== "string" || !data || typeof data !== "object") {
      throw Object.assign(new Error("Malformed Paddle webhook event."), { status: 400 });
    }

    const isTransaction = eventType.startsWith("transaction.");
    const isSubscription = eventType.startsWith("subscription.");
    let status: VerifiedProviderEvent["status"] = "ignored";
    if (eventType === "transaction.paid" || eventType === "transaction.completed") status = "paid";
    else if (eventType === "transaction.payment_failed" || eventType === "transaction.past_due") status = "failed";
    else if (isSubscription) status = "subscription_updated";
    else if (eventType === "adjustment.created") status = "refunded";

    return {
      provider: "paddle",
      eventId,
      eventType,
      occurredAt: typeof payload.occurred_at === "string" ? new Date(payload.occurred_at) : undefined,
      externalTransactionId: isTransaction && typeof data.id === "string" ? data.id : (typeof data.transaction_id === "string" ? data.transaction_id : undefined),
      externalSubscriptionId: isSubscription && typeof data.id === "string" ? data.id : (typeof data.subscription_id === "string" ? data.subscription_id : undefined),
      referenceId: typeof data.custom_data?.app_subscription_id === "string" ? data.custom_data.app_subscription_id : undefined,
      amountMinor: typeof data.details?.totals?.total === "string" && /^\d+$/.test(data.details.totals.total) ? Number(data.details.totals.total) : undefined,
      currency: typeof data.currency_code === "string" ? data.currency_code : undefined,
      status,
      rawType: eventType,
      data
    };
  }
}
