import { test } from "node:test";
import assert from "node:assert/strict";
import { getPaymentProviderReadiness, getPaymentProviderReadinessById } from "../src/lib/billing/providers/registry";

const ids = ["ipay", "clictopay", "laposte_d17"] as const;
const envKeys = [
  "BILLING_PROVIDER_IPAY_ENABLED","BILLING_PROVIDER_CLICTOPAY_ENABLED","BILLING_PROVIDER_LAPOSTE_D17_ENABLED",
  "BILLING_IPAY_MERCHANT_APPROVED","BILLING_CLICTOPAY_MERCHANT_APPROVED","BILLING_LAPOSTE_MERCHANT_APPROVED",
  "IPAY_ORG_ID","IPAY_API_TOKEN","IPAY_WEBHOOK_SECRET",
  "CLICTOPAY_API_USERNAME","CLICTOPAY_API_PASSWORD","CLICTOPAY_API_BASE_URL",
  "LAPOSTE_MERCHANT_ID","LAPOSTE_MERCHANT_SECRET","LAPOSTE_API_BASE_URL"
];
function isolatedEnvironment(run: () => void) {
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  try { for (const key of envKeys) delete process.env[key]; run(); }
  finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("new Tunisian payment providers are disabled by default", () => isolatedEnvironment(() => {
  for (const id of ids) {
    const readiness = getPaymentProviderReadinessById(id);
    assert.equal(readiness.status, "disabled");
    assert.equal(readiness.checkoutAvailable, false);
  }
}));
test("credentials and flags cannot enable a Tunisian provider without an implemented adapter", () => isolatedEnvironment(() => {
  for (const key of envKeys) process.env[key] = "placeholder-test-value";
  process.env.BILLING_PROVIDER_IPAY_ENABLED = "true";
  process.env.BILLING_PROVIDER_CLICTOPAY_ENABLED = "true";
  process.env.BILLING_PROVIDER_LAPOSTE_D17_ENABLED = "true";
  process.env.BILLING_IPAY_MERCHANT_APPROVED = "true";
  process.env.BILLING_CLICTOPAY_MERCHANT_APPROVED = "true";
  process.env.BILLING_LAPOSTE_MERCHANT_APPROVED = "true";
  for (const id of ids) {
    const readiness = getPaymentProviderReadinessById(id);
    assert.equal(readiness.status, "adapter_not_implemented");
    assert.equal(readiness.checkoutAvailable, false);
  }
}));
test("provider readiness catalogue includes iPay, direct ClicToPay and direct La Poste/D17", () => isolatedEnvironment(() => {
  const providers = getPaymentProviderReadiness();
  for (const id of ids) assert.ok(providers.some((provider) => provider.id === id));
}));
