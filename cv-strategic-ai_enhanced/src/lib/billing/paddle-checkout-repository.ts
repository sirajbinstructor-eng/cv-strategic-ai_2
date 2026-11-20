import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";

export async function createPaddlePaymentIntent(input: {
  userId: string; subscriptionId: string; paddleTransactionId: string;
  amountMinor: number; currency: "USD" | "EUR"; idempotencyKey: string;
}) {
  await pool.query(
    `INSERT INTO payment_transactions
      (id,product,user_id,workspace_id,provider,provider_checkout_id,provider_transaction_id,reference_id,purpose,amount_minor,currency,status,idempotency_key,metadata)
     VALUES($1,'candidate',$2,NULL,'paddle',$3,$3,$4,'subscription',$5,$6,'pending',$7,$8::jsonb)`,
    [randomUUID(),input.userId,input.paddleTransactionId,input.subscriptionId,input.amountMinor,input.currency,input.idempotencyKey,JSON.stringify({subscriptionId:input.subscriptionId})]
  );
}
export async function findPaddlePaymentByTransaction(transactionId:string) {
  const result=await pool.query(
    `SELECT id,user_id,reference_id,amount_minor,currency,status FROM payment_transactions
     WHERE provider='paddle' AND provider_transaction_id=$1 LIMIT 1`,[transactionId]);
  return result.rows[0]||null;
}
export async function markPaddlePaymentPaid(transactionId:string) {
  await pool.query(`UPDATE payment_transactions SET status='paid',updated_at=NOW()
    WHERE provider='paddle' AND provider_transaction_id=$1 AND status IN ('pending','paid')`,[transactionId]);
}
export async function getPaddlePaymentStatus(transactionId:string) {
  const result=await pool.query("SELECT status FROM payment_transactions WHERE provider='paddle' AND provider_transaction_id=$1 LIMIT 1",[transactionId]);
  return result.rows[0]?.status||null;
}
