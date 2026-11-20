import { NextResponse } from "next/server";
import { getPaymentProviderReadiness } from "@/lib/billing/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, non-sensitive capability/status endpoint. Never returns secrets or raw environment values. */
export async function GET() {
  const providers = getPaymentProviderReadiness();
  return NextResponse.json({
    providers,
    checkoutAvailable: providers.some((provider) => provider.checkoutAvailable),
    note: "Provider readiness is informational only. A provider is selectable only when its adapter, merchant approval, credentials and required verification are complete. Tunisian providers remain unavailable until their official merchant API contracts and sandbox tests are verified."
  }, { headers: { "Cache-Control": "no-store" } });
}
