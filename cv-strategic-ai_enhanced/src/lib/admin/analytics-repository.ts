import { pool } from "@/lib/db";

export type AdminDailyActivity = {
  label: string;
  analyses: number;
  generations: number;
  signups: number;
};

export type AdminPlanBreakdown = {
  plan: "pro" | "consultant";
  total: number;
};

export type AdminSubscriptionStatus = {
  status: string;
  total: number;
};

export class AdminAnalyticsRepository {
  async getOverview() {
    const [users, activity, subscriptions, pendingDiscounts, daily, plans, statuses] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS new_7d
        FROM "user"`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status='consumed')::int AS analyses_all,
        COUNT(*) FILTER (WHERE feature='cv_generation' AND status='consumed')::int AS generations_all
        FROM entitlement_reservations`),
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE status IN ('active','canceled_at_period_end') AND current_period_end > NOW())::int AS active,
        COUNT(*) FILTER (WHERE status='past_due')::int AS past_due,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*)::int AS total
        FROM billing_subscriptions`),
      pool.query(`SELECT COUNT(*)::int AS total FROM discount_applications WHERE status='pending'`),
      pool.query(`WITH days AS (
          SELECT generate_series(
            date_trunc('day', NOW()) - INTERVAL '29 days',
            date_trunc('day', NOW()),
            INTERVAL '1 day'
          ) AS day
        ), analysis_daily AS (
          SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS total
          FROM analysis_usage
          WHERE status='consumed' AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY 1
        ), generation_daily AS (
          SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS total
          FROM entitlement_reservations
          WHERE feature='cv_generation' AND status='consumed' AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY 1
        ), signup_daily AS (
          SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS total
          FROM "user" WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY 1
        )
        SELECT to_char(days.day, 'Mon DD') AS label,
          COALESCE(analysis_daily.total,0)::int AS analyses,
          COALESCE(generation_daily.total,0)::int AS generations,
          COALESCE(signup_daily.total,0)::int AS signups
        FROM days
        LEFT JOIN analysis_daily ON analysis_daily.day=days.day
        LEFT JOIN generation_daily ON generation_daily.day=days.day
        LEFT JOIN signup_daily ON signup_daily.day=days.day
        ORDER BY days.day`),
      pool.query(`SELECT plan, COUNT(*)::int AS total
        FROM billing_subscriptions
        WHERE status IN ('active','canceled_at_period_end') AND current_period_end > NOW()
        GROUP BY plan ORDER BY plan`),
      pool.query(`SELECT status, COUNT(*)::int AS total
        FROM billing_subscriptions GROUP BY status ORDER BY status`)
    ]);

    return {
      users: {
        total: Number(users.rows[0]?.total || 0),
        new30d: Number(users.rows[0]?.new_30d || 0),
        new7d: Number(users.rows[0]?.new_7d || 0)
      },
      activity: {
        analysesAll: Number(activity.rows[0]?.analyses_all || 0),
        generationsAll: Number(activity.rows[0]?.generations_all || 0)
      },
      subscriptions: {
        active: Number(subscriptions.rows[0]?.active || 0),
        pastDue: Number(subscriptions.rows[0]?.past_due || 0),
        pending: Number(subscriptions.rows[0]?.pending || 0),
        total: Number(subscriptions.rows[0]?.total || 0)
      },
      pendingDiscounts: Number(pendingDiscounts.rows[0]?.total || 0),
      daily: daily.rows.map((row): AdminDailyActivity => ({
        label: String(row.label),
        analyses: Number(row.analyses || 0),
        generations: Number(row.generations || 0),
        signups: Number(row.signups || 0)
      })),
      plans: plans.rows.map((row): AdminPlanBreakdown => ({
        plan: row.plan === "consultant" ? "consultant" : "pro",
        total: Number(row.total || 0)
      })),
      statuses: statuses.rows.map((row): AdminSubscriptionStatus => ({
        status: String(row.status),
        total: Number(row.total || 0)
      }))
    };
  }
}
