import { randomUUID } from "node:crypto";
import { pool } from "@/lib/db";
import { reserveSubscriptionAnalysis, getBillingEntitlements } from "@/lib/billing/entitlements";

// 31 Dec 2026, 23:59:59 Africa/Tunis (UTC+01:00) inclusive.
export const TRIAL_EXPIRY_UTC = new Date("2026-12-31T23:00:00.000Z");
export const TRIAL_OFFER_END_LABEL = "31 December 2026";

export type EntitlementSnapshot = {
  isAdmin: boolean;
  isUnrestricted: boolean;
  consultantEntitled: boolean;
  granted: number;
  used: number;
  reserved: number;
  remaining: number;
  expired: boolean;
  unlimited: boolean;
  workspaceLocked: boolean;
  expiresAt: string;
  subscription?: { plan:string; interval:string; status:string; analyses:{limit:number;used:number;reserved:number;remaining:number}; generations:{limit:number;used:number;reserved:number;remaining:number}; periodEnd:string };
};

/** CV generation is a launch-trial benefit only after the user's first completed analysis. */
export function canGenerateCv(entitlements: Pick<EntitlementSnapshot, "unlimited" | "expired" | "used">): boolean {
  return entitlements.unlimited || (!entitlements.expired && entitlements.used === 1);
}

export function toEntitlementSnapshot(row: Record<string, unknown>): EntitlementSnapshot {
  const isAdmin = Boolean(row.is_admin);
  const isUnrestricted = Boolean(row.is_unrestricted);
  const consultantEntitled = Boolean(row.consultant_entitled) || Boolean(row.is_admin) || Boolean(row.is_unrestricted);
  const granted = Number(row.analysis_trials_granted ?? 3);
  const used = Number(row.analysis_trials_used ?? 0);
  const reserved = Number(row.analysis_trials_reserved ?? 0);
  const expiresAt = new Date(String(row.analysis_trial_expires_at ?? TRIAL_EXPIRY_UTC.toISOString()));
  const unlimited = isAdmin || isUnrestricted;
  const expired = Date.now() >= expiresAt.getTime();
  const remaining = unlimited ? Number.POSITIVE_INFINITY : Math.max(0, granted - used - reserved);
  return {
    isAdmin, isUnrestricted, consultantEntitled, granted, used, reserved,
    remaining, expired, unlimited,
    workspaceLocked: !unlimited && (expired || remaining <= 0),
    expiresAt: expiresAt.toISOString()
  };
}

export async function getEntitlements(userId: string): Promise<EntitlementSnapshot | null> {
  const result = await pool.query(
    `SELECT is_admin, is_unrestricted, consultant_entitled,
            analysis_trials_granted, analysis_trials_used, analysis_trials_reserved,
            analysis_trial_expires_at
       FROM "user" WHERE id = $1 LIMIT 1`,
    [userId]
  );
  if (!result.rows[0]) return null;
  const snapshot=toEntitlementSnapshot(result.rows[0]);
  const paid=await getBillingEntitlements(userId);
  if(!paid)return snapshot;
  return {...snapshot,consultantEntitled:snapshot.isAdmin||snapshot.isUnrestricted||paid.plan==="consultant",granted:paid.analyses.limit,used:paid.analyses.used,reserved:paid.analyses.reserved,remaining:paid.analyses.remaining,expired:false,workspaceLocked:false,expiresAt:paid.periodEnd,subscription:{plan:paid.plan,interval:paid.interval,status:paid.status,analyses:paid.analyses,generations:paid.generations,periodEnd:paid.periodEnd}};
}

export type TrialReservation = { id: string; bypassed: boolean; source?: "trial" | "subscription" };

/** Reserve one slot before invoking Groq. The conditional UPDATE prevents concurrent overspending. */
export async function reserveAnalysisTrial(userId: string, mode: "automatic" | "consultant" = "automatic"): Promise<TrialReservation> {
  const paidReservation = await reserveSubscriptionAnalysis(userId, mode);
  if (paidReservation) return { id: paidReservation.id, bypassed: false, source: "subscription" };
  const client = await pool.connect();
  const reservationId = randomUUID();
  try {
    await client.query("BEGIN");
    // Release abandoned paid reservations and restore their billing-period counters.
    await client.query("WITH stale AS (UPDATE entitlement_reservations SET status='released',completed_at=NOW() WHERE status='reserved' AND source='subscription' AND created_at<NOW()-INTERVAL '20 minutes' RETURNING user_id,feature,usage_period_start) UPDATE billing_usage_periods b SET analyses_reserved=CASE WHEN stale.feature='analysis' THEN GREATEST(0,b.analyses_reserved-1) ELSE b.analyses_reserved END,generations_reserved=CASE WHEN stale.feature='cv_generation' THEN GREATEST(0,b.generations_reserved-1) ELSE b.generations_reserved END,updated_at=NOW() FROM stale WHERE b.user_id=stale.user_id AND b.period_start=stale.usage_period_start");
    // Release abandoned free-trial reservations left by a crashed request.
    await client.query(
      `WITH stale AS (
         UPDATE analysis_usage SET status = 'released', failure_code = 'RESERVATION_TIMEOUT'
          WHERE status = 'reserved' AND created_at < NOW() - INTERVAL '20 minutes' AND NOT EXISTS (SELECT 1 FROM entitlement_reservations er WHERE er.id=analysis_usage.id AND er.source='subscription')
          RETURNING user_id
       ), grouped AS (
         SELECT user_id, COUNT(*)::integer AS released_count FROM stale GROUP BY user_id
       )
       UPDATE "user" AS u
          SET analysis_trials_reserved = GREATEST(0, u.analysis_trials_reserved - grouped.released_count)
         FROM grouped WHERE u.id = grouped.user_id`
    );
    const userResult = await client.query(
      `SELECT is_admin, is_unrestricted FROM "user" WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    if (!userResult.rowCount) throw new Error("Account not found.");
    const userRow = userResult.rows[0];
    if (userRow.is_admin || userRow.is_unrestricted) {
      await client.query("COMMIT");
      return { id: "", bypassed: true };
    }

    const update = await client.query(
      `UPDATE "user"
          SET analysis_trials_reserved = analysis_trials_reserved + 1,
              updated_at = NOW()
        WHERE id = $1
          AND analysis_trial_expires_at > NOW()
          AND analysis_trials_used + analysis_trials_reserved < analysis_trials_granted
        RETURNING id`,
      [userId]
    );
    if (!update.rowCount) {
      await client.query("ROLLBACK");
      const entitlements = await getEntitlements(userId);
      const error = new Error(entitlements?.expired
        ? "The free launch offer expired on 31 December 2026. Upgrade to continue."
        : "You have used all 3 free analyses. Upgrade now for more!");
      Object.assign(error, { status: 402, code: "TRIAL_EXHAUSTED" });
      throw error;
    }
    await client.query(
      `INSERT INTO analysis_usage (id, user_id, status, mode) VALUES ($1, $2, 'reserved', $3)`,
      [reservationId, userId, mode]
    );
    await client.query("COMMIT");
    return { id: reservationId, bypassed: false, source: "trial" };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function completeAnalysisTrial(
  userId: string,
  reservation: TrialReservation,
  record: { id: string; targetTitle: string | null; matchScore: number; result: Record<string, unknown>; mode?: "automatic" | "consultant" }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (!reservation.bypassed) {
      const usage = await client.query(
        `UPDATE analysis_usage SET status = 'consumed', completed_at = NOW()
          WHERE id = $1 AND user_id = $2 AND status = 'reserved' RETURNING id`,
        [reservation.id, userId]
      );
      if (!usage.rowCount) throw new Error("Trial reservation is no longer valid.");
      const entitlement = await client.query("SELECT source,usage_period_start FROM entitlement_reservations WHERE id=$1 AND user_id=$2 FOR UPDATE",[reservation.id,userId]);
      if (entitlement.rowCount && entitlement.rows[0].source === "subscription") {
        const counters = await client.query(`UPDATE billing_usage_periods SET analyses_reserved=GREATEST(0,analyses_reserved-1),analyses_used=analyses_used+1,updated_at=NOW() WHERE user_id=$1 AND period_start=$2`,[userId,entitlement.rows[0].usage_period_start]);
        if (!counters.rowCount) throw new Error("Subscription usage period not found.");
        await client.query("UPDATE entitlement_reservations SET status='consumed',completed_at=NOW() WHERE id=$1 AND status='reserved'",[reservation.id]);
      } else {
        const update = await client.query(
          `UPDATE "user" SET analysis_trials_reserved=GREATEST(0,analysis_trials_reserved-1),analysis_trials_used=analysis_trials_used+1,updated_at=NOW() WHERE id=$1 RETURNING id`,
          [userId]
        );
        if (!update.rowCount) throw new Error("Account not found while completing trial.");
      }
    }
    await client.query(
      `INSERT INTO analysis_records (id, user_id, mode, target_title, match_score, result)
       VALUES ($1, $2, $6, $3, $4, $5::jsonb)`,
      [record.id, userId, record.targetTitle, record.matchScore, JSON.stringify(record.result), record.mode || "automatic"]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseAnalysisTrial(userId: string, reservation: TrialReservation, failureCode: string): Promise<void> {
  if (reservation.bypassed || !reservation.id) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const usage = await client.query(
      `UPDATE analysis_usage SET status = 'released', failure_code = $3
        WHERE id = $1 AND user_id = $2 AND status = 'reserved' RETURNING id`,
      [reservation.id, userId, failureCode.slice(0, 80)]
    );
    if (usage.rowCount) {
      const entitlement = await client.query("SELECT source,usage_period_start FROM entitlement_reservations WHERE id=$1 AND user_id=$2 FOR UPDATE",[reservation.id,userId]);
      if (entitlement.rowCount && entitlement.rows[0].source === "subscription") {
        await client.query("UPDATE entitlement_reservations SET status='released',completed_at=NOW() WHERE id=$1 AND status='reserved'",[reservation.id]);
        await client.query(`UPDATE billing_usage_periods SET analyses_reserved=GREATEST(0,analyses_reserved-1),updated_at=NOW() WHERE user_id=$1 AND period_start=$2`,[userId,entitlement.rows[0].usage_period_start]);
      } else {
        await client.query(`UPDATE "user" SET analysis_trials_reserved=GREATEST(0,analysis_trials_reserved-1),updated_at=NOW() WHERE id=$1`,[userId]);
      }
    }
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
    // A stale reservation is harmless to the used counter. A scheduled cleanup can release it.
  } finally {
    client.release();
  }
}
