import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const transactionId = request.nextUrl.searchParams.get("transactionId") || "";
  if (!/^txn_[a-z0-9]{26}$/i.test(transactionId)) return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400 });
  await ensureAuthSchema();
  const result = await pool.query(
    `SELECT p.status AS payment_status,s.status AS subscription_status,s.current_period_end
     FROM payment_transactions p
     JOIN billing_subscriptions s ON s.id=p.reference_id
     WHERE p.provider='paddle' AND p.provider_transaction_id=$1 AND p.user_id=$2
     LIMIT 1`,
    [transactionId,session.user.id]
  );
  if (!result.rowCount) return NextResponse.json({ error: "Payment reference not found." }, { status: 404 });
  return NextResponse.json({
    paymentStatus: result.rows[0].payment_status,
    subscriptionStatus: result.rows[0].subscription_status,
    currentPeriodEnd: result.rows[0].current_period_end
  },{headers:{"Cache-Control":"no-store"}});
}
