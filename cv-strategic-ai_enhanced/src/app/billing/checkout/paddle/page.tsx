import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { pool } from "@/lib/db";
import { PaddleCheckout } from "@/components/billing/paddle-checkout";

export const dynamic = "force-dynamic";

export default async function PaddleCheckoutPage({ searchParams }: { searchParams: Promise<{ transactionId?: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/?signIn=required");
  const { transactionId } = await searchParams;
  if (!transactionId || !/^txn_[a-z0-9]{26}$/i.test(transactionId)) notFound();
  await ensureAuthSchema();
  const result = await pool.query(
    `SELECT p.status AS payment_status,s.status AS subscription_status
     FROM payment_transactions p
     JOIN billing_subscriptions s ON s.id=p.reference_id
     WHERE p.provider='paddle' AND p.provider_checkout_id=$1 AND p.user_id=$2
       AND p.status IN ('pending','paid')
     LIMIT 1`,
    [transactionId,session.user.id]
  );
  if (!result.rowCount) notFound();
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (result.rows[0].payment_status === "paid" && ["active","canceled_at_period_end"].includes(result.rows[0].subscription_status)) {
    return <main className="marketing-page"><section className="marketing-content" style={{maxWidth:760,margin:"0 auto",paddingTop:80}}><p className="eyebrow">PAYMENT RECEIVED</p><h1>Your subscription is active</h1><p>Paddle confirmed your payment and your plan is active.</p><Link className="button button-primary" href="/dashboard">Go to dashboard</Link></section></main>;
  }
  if (!token) return <main className="marketing-page"><section className="marketing-content"><h1>Checkout unavailable</h1><p>Paddle checkout is not configured yet. No payment has been taken.</p><Link href="/pricing">Return to pricing</Link></section></main>;
  return <PaddleCheckout transactionId={transactionId} clientToken={token} environment={process.env.PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox"} initialCompleted={result.rows[0].payment_status === "paid"} />;
}
