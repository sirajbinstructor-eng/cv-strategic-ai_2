export const PAYMENT_PROVIDER_IDS = ["paddle", "flouci", "konnect", "ipay", "paymee", "stripe"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];
export type BillingProduct = "candidate" | "recruiter";
export type PaymentPurpose = "subscription" | "one_time";
export type ProviderReadinessStatus =
  | "disabled"
  | "merchant_approval_required"
  | "credentials_missing"
  | "adapter_not_implemented"
  | "ready";

export interface PaymentProviderReadiness {
  id: PaymentProviderId;
  name: string;
  checkoutAvailable: boolean;
  status: ProviderReadinessStatus;
  supportedPurposes: PaymentPurpose[];
  products: BillingProduct[];
  reasons: string[];
}

export interface CreateCheckoutSessionInput {
  product: BillingProduct;
  purpose: PaymentPurpose;
  customerId: string;
  referenceId: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface CheckoutSessionResult {
  provider: PaymentProviderId;
  checkoutUrl: string;
  providerCheckoutId: string;
  expiresAt?: Date;
}

export interface VerifiedProviderEvent {
  provider: PaymentProviderId;
  eventId: string;
  eventType: string;
  occurredAt?: Date;
  externalTransactionId?: string;
  externalSubscriptionId?: string;
  referenceId?: string;
  amountMinor?: number;
  currency?: string;
  status: "paid" | "failed" | "refunded" | "subscription_updated" | "subscription_canceled";
  rawType: string;
}

export interface PaymentProviderAdapter {
  readonly id: PaymentProviderId;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CheckoutSessionResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedProviderEvent>;
}

export class PaymentProviderUnavailableError extends Error {
  readonly code = "PAYMENT_PROVIDER_UNAVAILABLE";
  constructor(message = "This payment provider is not enabled for this account.") {
    super(message);
    this.name = "PaymentProviderUnavailableError";
  }
}
