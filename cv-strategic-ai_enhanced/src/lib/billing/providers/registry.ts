import {
  PAYMENT_PROVIDER_IDS,
  type PaymentProviderId,
  type PaymentProviderReadiness,
  type PaymentPurpose,
  type BillingProduct
} from "./types";

/**
 * Provider metadata is deliberately separate from provider adapters.
 * A provider is never considered checkout-ready merely because environment
 * variables exist: merchant approval, explicit enablement and a tested
 * adapter are all required.
 */
const PROVIDER_METADATA: Record<PaymentProviderId, {
  name: string;
  purposes: PaymentPurpose[];
  products: BillingProduct[];
  requiredEnvironment: string[];
  approvalEnvironment: string;
}> = {
  paddle: {
    name: "Paddle",
    purposes: ["subscription", "one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_PADDLE_MERCHANT_APPROVED"
  },
  flouci: {
    name: "Flouci",
    purposes: ["subscription", "one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["FLOUCI_APP_TOKEN", "FLOUCI_APP_SECRET", "FLOUCI_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_FLOUCI_MERCHANT_APPROVED"
  },
  konnect: {
    name: "Konnect",
    purposes: ["one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["KONNECT_API_KEY", "KONNECT_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_KONNECT_MERCHANT_APPROVED"
  },
  ipay: {
    name: "iPay",
    purposes: ["subscription", "one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["IPAY_API_KEY", "IPAY_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_IPAY_MERCHANT_APPROVED"
  },
  paymee: {
    name: "Paymee",
    purposes: ["one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["PAYMEE_API_KEY", "PAYMEE_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_PAYMEE_MERCHANT_APPROVED"
  },
  stripe: {
    name: "Stripe",
    purposes: ["subscription", "one_time"],
    products: ["candidate", "recruiter"],
    requiredEnvironment: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    approvalEnvironment: "BILLING_STRIPE_MERCHANT_APPROVED"
  }
};

// No adapter is registered in this foundation release. Provider-specific
// implementations are added only after merchant onboarding and API contracts
// have been verified. This set is the single allow-list for implemented code.
const IMPLEMENTED_ADAPTERS = new Set<PaymentProviderId>();

function isExplicitlyEnabled(id: PaymentProviderId): boolean {
  return process.env[`BILLING_PROVIDER_${id.toUpperCase()}_ENABLED`] === "true";
}

export function getPaymentProviderReadiness(): PaymentProviderReadiness[] {
  return PAYMENT_PROVIDER_IDS.map((id) => {
    const metadata = PROVIDER_METADATA[id];
    const reasons: string[] = [];
    const enabled = isExplicitlyEnabled(id);
    const approved = process.env[metadata.approvalEnvironment] === "true";
    const missing = metadata.requiredEnvironment.filter((key) => !process.env[key]);

    let status: PaymentProviderReadiness["status"];
    if (!enabled) {
      status = "disabled";
      reasons.push("Provider is disabled by default. Explicit production enablement is required.");
    } else if (!approved) {
      status = "merchant_approval_required";
      reasons.push("Merchant onboarding must be approved and recorded before activation.");
    } else if (missing.length > 0) {
      status = "credentials_missing";
      reasons.push("Required provider credentials are not completely configured.");
    } else if (!IMPLEMENTED_ADAPTERS.has(id)) {
      status = "adapter_not_implemented";
      reasons.push("The provider adapter has not passed implementation and sandbox verification.");
    } else {
      status = "ready";
    }

    return {
      id,
      name: metadata.name,
      checkoutAvailable: status === "ready",
      status,
      supportedPurposes: metadata.purposes,
      products: metadata.products,
      reasons
    };
  });
}

export function getPaymentProviderReadinessById(id: PaymentProviderId) {
  return getPaymentProviderReadiness().find((provider) => provider.id === id)!;
}

export function isPaymentProviderId(value: string): value is PaymentProviderId {
  return PAYMENT_PROVIDER_IDS.includes(value as PaymentProviderId);
}
