import { PAYMENT_PROVIDER_IDS, type PaymentProviderId, type PaymentProviderReadiness, type PaymentPurpose, type BillingProduct } from "./types";

type ProviderMetadata = {
  name: string;
  purposes: PaymentPurpose[];
  products: BillingProduct[];
  requiredEnvironment: string[];
  approvalEnvironment: string;
  integrationNote?: string;
};

const PROVIDER_METADATA: Record<PaymentProviderId, ProviderMetadata> = {
  paddle: {
    name: "Paddle", purposes: ["subscription"], products: ["candidate"],
    requiredEnvironment: ["PADDLE_API_KEY","PADDLE_WEBHOOK_SECRET","NEXT_PUBLIC_PADDLE_CLIENT_TOKEN","PADDLE_PRICE_PRO_MONTHLY_USD","PADDLE_PRICE_PRO_ANNUAL_USD","PADDLE_PRICE_PRO_MONTHLY_EUR","PADDLE_PRICE_PRO_ANNUAL_EUR","PADDLE_PRICE_CONSULTANT_MONTHLY_USD","PADDLE_PRICE_CONSULTANT_ANNUAL_USD","PADDLE_PRICE_CONSULTANT_MONTHLY_EUR","PADDLE_PRICE_CONSULTANT_ANNUAL_EUR","PADDLE_DISCOUNT_10_ID","PADDLE_DISCOUNT_20_ID","PADDLE_DISCOUNT_40_ID"],
    approvalEnvironment: "BILLING_PADDLE_MERCHANT_APPROVED"
  },
  flouci: { name:"Flouci", purposes:["subscription","one_time"], products:["candidate","recruiter"], requiredEnvironment:["FLOUCI_APP_TOKEN","FLOUCI_APP_SECRET","FLOUCI_WEBHOOK_SECRET"], approvalEnvironment:"BILLING_FLOUCI_MERCHANT_APPROVED" },
  konnect: { name:"Konnect", purposes:["one_time"], products:["candidate","recruiter"], requiredEnvironment:["KONNECT_API_KEY","KONNECT_WEBHOOK_SECRET"], approvalEnvironment:"BILLING_KONNECT_MERCHANT_APPROVED" },
  ipay: {
    name:"iPay (aggregator)", purposes:["subscription","one_time"], products:["candidate","recruiter"],
    requiredEnvironment:["IPAY_ORG_ID","IPAY_API_TOKEN","IPAY_WEBHOOK_SECRET"], approvalEnvironment:"BILLING_IPAY_MERCHANT_APPROVED",
    integrationNote:"iPay publicly documents JWT authentication and admin endpoints, but the complete payment-creation and webhook verification contract is available through its authenticated merchant documentation. Adapter remains blocked pending that pack."
  },
  clictopay: {
    name:"ClicToPay / SMT (direct)", purposes:["one_time"], products:["candidate","recruiter"],
    requiredEnvironment:["CLICTOPAY_API_USERNAME","CLICTOPAY_API_PASSWORD","CLICTOPAY_API_BASE_URL"], approvalEnvironment:"BILLING_CLICTOPAY_MERCHANT_APPROVED",
    integrationNote:"Direct access is acquired through the merchant's Tunisian bank and SMT certification. The exact environment URLs, credentials, callback contract and test scenarios must come from the merchant integration pack."
  },
  laposte_d17: {
    name:"La Poste Tunisienne / e-Dinar / D17 (direct)", purposes:["one_time"], products:["candidate","recruiter"],
    requiredEnvironment:["LAPOSTE_MERCHANT_ID","LAPOSTE_MERCHANT_SECRET","LAPOSTE_API_BASE_URL"], approvalEnvironment:"BILLING_LAPOSTE_MERCHANT_APPROVED",
    integrationNote:"No public standalone D17 merchant API contract has been verified. Obtain the official La Poste merchant kit and confirm whether D17 wallet checkout is available to this merchant."
  },
  paymee: { name:"Paymee", purposes:["one_time"], products:["candidate","recruiter"], requiredEnvironment:["PAYMEE_API_KEY","PAYMEE_WEBHOOK_SECRET"], approvalEnvironment:"BILLING_PAYMEE_MERCHANT_APPROVED" },
  stripe: { name:"Stripe", purposes:["subscription","one_time"], products:["candidate","recruiter"], requiredEnvironment:["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"], approvalEnvironment:"BILLING_STRIPE_MERCHANT_APPROVED" }
};

// Only Paddle has an implemented adapter. New Tunisian routes intentionally remain
// unavailable even if someone sets environment variables or an enablement flag.
const IMPLEMENTED_ADAPTERS = new Set<PaymentProviderId>(["paddle"]);

export function getPaymentProviderReadiness(): PaymentProviderReadiness[] {
  return PAYMENT_PROVIDER_IDS.map((id) => {
    const m = PROVIDER_METADATA[id];
    const reasons: string[] = [];
    const enabled = process.env["BILLING_PROVIDER_" + id.toUpperCase() + "_ENABLED"] === "true";
    const paddleEnvironment = process.env.PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox";
    const approved = process.env[m.approvalEnvironment] === "true";
    const missing = m.requiredEnvironment.filter((key) => !process.env[key]);
    let status: PaymentProviderReadiness["status"];

    if (!enabled) {
      status = "disabled";
      reasons.push("Provider is disabled. No checkout session can be created.");
    } else if (!approved) {
      status = "merchant_approval_required";
      reasons.push("Merchant onboarding and written approval have not been confirmed.");
    } else if (missing.length) {
      status = "credentials_missing";
      reasons.push("Required merchant credentials are not completely configured.");
    } else if (!IMPLEMENTED_ADAPTERS.has(id)) {
      status = "adapter_not_implemented";
      reasons.push(m.integrationNote || "The provider adapter and its security verification have not been implemented.");
    } else if (id === "paddle" && paddleEnvironment === "sandbox") {
      status = "sandbox_testing";
      reasons.push("Paddle sandbox is restricted to controlled administrator integration tests; it is not customer live checkout.");
    } else if (id === "paddle" && paddleEnvironment === "live" && process.env.BILLING_PADDLE_SANDBOX_VERIFIED !== "true") {
      status = "sandbox_verification_required";
      reasons.push("Complete Paddle sandbox checkout and webhook verification before live checkout.");
    } else {
      status = "ready";
    }

    return {
      id, name: m.name, checkoutAvailable: status === "ready", status,
      supportedPurposes: m.purposes, products: m.products, reasons
    };
  });
}

export function getPaymentProviderReadinessById(id: PaymentProviderId) {
  return getPaymentProviderReadiness().find((provider) => provider.id === id)!;
}
export function isPaymentProviderId(value: string): value is PaymentProviderId {
  return PAYMENT_PROVIDER_IDS.includes(value as PaymentProviderId);
}
