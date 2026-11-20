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
    note: "Paddle sandbox checkout is restricted to controlled integration tests. Live customer checkout remains unavailable until merchant approval, complete credentials, sandbox verification and explicit live enablement are in place."
  }, { headers: { "Cache-Control": "no-store" } });
}
