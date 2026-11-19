import {
  pgTable, text, boolean, timestamp, integer, jsonb, index, uniqueIndex, check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable("user", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false), image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  isAdmin: boolean("is_admin").notNull().default(false), isUnrestricted: boolean("is_unrestricted").notNull().default(false),
  consultantEntitled: boolean("consultant_entitled").notNull().default(false),
  analysisTrialsGranted: integer("analysis_trials_granted").notNull().default(3),
  analysisTrialsUsed: integer("analysis_trials_used").notNull().default(0),
  analysisTrialsReserved: integer("analysis_trials_reserved").notNull().default(0),
  analysisTrialExpiresAt: timestamp("analysis_trial_expires_at", { withTimezone: true }).notNull().default(new Date("2026-12-31T23:00:00.000Z"))
}, (table) => ({
  emailUnique: uniqueIndex("user_email_unique").on(table.email), adminIndex: index("user_admin_idx").on(table.isAdmin),
  trialCountersNonnegative: check("user_trial_counters_nonnegative", sql`${table.analysisTrialsGranted} >= 0 AND ${table.analysisTrialsUsed} >= 0 AND ${table.analysisTrialsReserved} >= 0`),
  trialReservationCap: check("user_trial_reservation_cap", sql`${table.analysisTrialsUsed} + ${table.analysisTrialsReserved} <= ${table.analysisTrialsGranted}`)
}));

export const session = pgTable("session", {
  id: text("id").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(), ipAddress: text("ip_address"), userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" })
}, (table) => ({ userIndex: index("session_user_idx").on(table.userId) }));

export const account = pgTable("account", {
  id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }), accessToken: text("access_token"),
  refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }), scope: text("scope"), password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({ userIndex: index("account_user_idx").on(table.userId), providerAccountUnique: uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId) }));

export const verification = pgTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
}, (table) => ({ identifierIndex: index("verification_identifier_idx").on(table.identifier) }));

export const analysisUsage = pgTable("analysis_usage", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["reserved", "consumed", "released"] }).notNull(), mode: text("mode").notNull().default("automatic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), completedAt: timestamp("completed_at", { withTimezone: true }), failureCode: text("failure_code")
}, (table) => ({ userCreatedIndex: index("analysis_usage_user_created_idx").on(table.userId, table.createdAt), statusIndex: index("analysis_usage_status_idx").on(table.status), statusCheck: check("analysis_usage_status_check", sql`${table.status} IN ('reserved', 'consumed', 'released')`) }));

export const analysisRecords = pgTable("analysis_records", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("automatic"), targetTitle: text("target_title"), matchScore: integer("match_score"),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({ userCreatedIndex: index("analysis_records_user_created_idx").on(table.userId, table.createdAt), scoreRange: check("analysis_records_score_range", sql`${table.matchScore} IS NULL OR (${table.matchScore} >= 0 AND ${table.matchScore} <= 100)`) }));

export const discountApplications = pgTable("discount_applications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  category: text("category", { enum: ["student", "recent_graduate", "early_career"] }).notNull(),
  nationality: text("nationality", { enum: ["tunisian", "non_tunisian"] }).notNull(),
  nationalityEvidenceType: text("nationality_evidence_type"), studentEvidenceType: text("student_evidence_type"),
  graduationDate: timestamp("graduation_date", { withTimezone: true }), noWorkSinceGraduation: boolean("no_work_since_graduation"),
  professionalExperienceMonths: integer("professional_experience_months"), discountPercent: integer("discount_percent").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "revoked", "expired"] }).notNull().default("pending"),
  reviewNotes: text("review_notes"), reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  userStatusIndex: index("discount_applications_user_status_idx").on(table.userId, table.status),
  statusCreatedIndex: index("discount_applications_status_created_idx").on(table.status, table.createdAt),
  percentCheck: check("discount_applications_percent_check", sql`${table.discountPercent} IN (10, 20, 40)`),
  categoryCheck: check("discount_applications_category_check", sql`(${table.category} = 'student' AND ${table.discountPercent} IN (20,40)) OR (${table.category} = 'recent_graduate' AND ${table.discountPercent} IN (20,40)) OR (${table.category} = 'early_career' AND ${table.discountPercent} = 10)`)
}));

export type UserRecord = typeof user.$inferSelect;
export type AnalysisRecord = typeof analysisRecords.$inferSelect;
export type DiscountApplicationRecord = typeof discountApplications.$inferSelect;

export const billingSubscriptions = pgTable("billing_subscriptions", {
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),
 provider:text("provider").notNull().default("unselected"),providerSubscriptionId:text("provider_subscription_id"),
 plan:text("plan",{enum:["pro","consultant"]}).notNull(),billingInterval:text("billing_interval",{enum:["monthly","annual"]}).notNull(),
 currency:text("currency",{enum:["USD","EUR","TND"]}).notNull(),baseAmountMinor:integer("base_amount_minor").notNull(),
 discountPercent:integer("discount_percent").notNull().default(0),amountMinor:integer("amount_minor").notNull(),
 discountApplicationId:text("discount_application_id").references(()=>discountApplications.id,{onDelete:"set null"}),
 status:text("status",{enum:["pending","active","past_due","canceled_at_period_end","expired","refunded","disputed"]}).notNull().default("pending"),
 currentPeriodStart:timestamp("current_period_start",{withTimezone:true}),currentPeriodEnd:timestamp("current_period_end",{withTimezone:true}),
 cancelAtPeriodEnd:boolean("cancel_at_period_end").notNull().default(false),canceledAt:timestamp("canceled_at",{withTimezone:true}),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>({userStatus:index("billing_subscriptions_user_status_idx").on(t.userId,t.status),providerSubscriptionUnique:uniqueIndex("billing_provider_subscription_unique").on(t.provider,t.providerSubscriptionId),amountCheck:check("billing_subscription_amount_check",sql`${t.baseAmountMinor}>0 AND ${t.amountMinor}>=0 AND ${t.discountPercent} BETWEEN 0 AND 100`)}));
export const billingUsagePeriods=pgTable("billing_usage_periods",{
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),
 periodStart:timestamp("period_start",{withTimezone:true}).notNull(),periodEnd:timestamp("period_end",{withTimezone:true}).notNull(),
 plan:text("plan",{enum:["pro","consultant"]}).notNull(),billingInterval:text("billing_interval",{enum:["monthly","annual"]}).notNull(),
 analysesLimit:integer("analyses_limit").notNull(),analysesUsed:integer("analyses_used").notNull().default(0),analysesReserved:integer("analyses_reserved").notNull().default(0),
 generationsLimit:integer("generations_limit").notNull(),generationsUsed:integer("generations_used").notNull().default(0),generationsReserved:integer("generations_reserved").notNull().default(0),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp("updated_at",{withTimezone:true}).notNull().defaultNow()
},t=>({userPeriodUnique:uniqueIndex("billing_usage_user_period_unique").on(t.userId,t.periodStart),periodCheck:check("billing_usage_period_check",sql`${t.periodEnd}>${t.periodStart}`),counterCheck:check("billing_usage_counter_check",sql`${t.analysesUsed}>=0 AND ${t.analysesReserved}>=0 AND ${t.generationsUsed}>=0 AND ${t.generationsReserved}>=0 AND ${t.analysesUsed}+${t.analysesReserved}<=${t.analysesLimit} AND ${t.generationsUsed}+${t.generationsReserved}<=${t.generationsLimit}`)}));
export const entitlementReservations=pgTable("entitlement_reservations",{
 id:text("id").primaryKey(),userId:text("user_id").notNull().references(()=>user.id,{onDelete:"cascade"}),
 feature:text("feature",{enum:["analysis","cv_generation"]}).notNull(),source:text("source",{enum:["free","subscription"]}).notNull(),
 usagePeriodStart:timestamp("usage_period_start",{withTimezone:true}),status:text("status",{enum:["reserved","consumed","released"]}).notNull(),
 createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),completedAt:timestamp("completed_at",{withTimezone:true})
},t=>({userFeatureStatus:index("entitlement_reservations_user_feature_status_idx").on(t.userId,t.feature,t.source,t.status)}));
export const billingEvents=pgTable("billing_events",{
 id:text("id").primaryKey(),provider:text("provider").notNull(),providerEventId:text("provider_event_id").notNull(),eventType:text("event_type").notNull(),
 processingStatus:text("processing_status",{enum:["received","processed","failed"]}).notNull().default("received"),errorCode:text("error_code"),
 receivedAt:timestamp("received_at",{withTimezone:true}).notNull().defaultNow(),processedAt:timestamp("processed_at",{withTimezone:true})
},t=>({providerEventUnique:uniqueIndex("billing_provider_event_unique").on(t.provider,t.providerEventId)}));
