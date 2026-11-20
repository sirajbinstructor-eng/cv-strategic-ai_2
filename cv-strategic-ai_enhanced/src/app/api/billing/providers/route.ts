import { NextResponse } from "next/server";
import { getPaymentProviderReadiness } from "@/lib/billing/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, non-sensitive capability/status endpoint. Never returns secrets or raw environment values. */
export async function GET() {
  return NextResponse.json({
    providers: getPaymentProviderReadiness(),
    checkoutAvailable: false,
    note: "Provider status is informational. Checkout remains unavailable until merchant approval, provider credentials, an implemented adapter and sandbox verification are complete."
  }, { headers: { "Cache-Control": "no-store" } });
}
