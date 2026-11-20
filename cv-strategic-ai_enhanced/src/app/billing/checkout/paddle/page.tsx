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
    `SELECT id FROM payment_transactions
     WHERE provider='paddle' AND provider_checkout_id=$1 AND user_id=$2 AND status='pending'
     LIMIT 1`,
    [transactionId, session.user.id]
  );
  if (!result.rowCount) notFound();
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) return <main className="marketing-page"><section className="marketing-content"><h1>Checkout unavailable</h1><p>Paddle checkout is not configured yet. No payment has been taken.</p><a href="/pricing">Return to pricing</a></section></main>;
  return <PaddleCheckout transactionId={transactionId} clientToken={token} environment={process.env.PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox"} />;
}
