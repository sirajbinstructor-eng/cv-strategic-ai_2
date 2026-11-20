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
  consultantEntitled: boolean("consultant_entitled").notNull().default(false), accountType: text("account_type"),
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


// Recruiter workspace billing is intentionally separate from candidate subscriptions.
export const recruiterWorkspaces = pgTable("recruiter_workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ownerUserId: text("owner_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  status: text("status", { enum: ["active", "suspended", "closed"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  slugUnique: uniqueIndex("recruiter_workspaces_slug_unique").on(t.slug),
  ownerIndex: index("recruiter_workspaces_owner_idx").on(t.ownerUserId, t.status),
  nameCheck: check("recruiter_workspaces_name_check", sql`length(trim(${t.name})) BETWEEN 2 AND 120`)
}));

export const recruiterWorkspaceMembers = pgTable("recruiter_workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => recruiterWorkspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "recruiter", "viewer"] }).notNull(),
  status: text("status", { enum: ["invited", "active", "suspended", "removed"] }).notNull().default("active"),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  memberPk: uniqueIndex("recruiter_workspace_members_pk").on(t.workspaceId, t.userId),
  userIndex: index("recruiter_workspace_members_user_idx").on(t.userId, t.status)
}));

export const recruiterSubscriptions = pgTable("recruiter_subscriptions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => recruiterWorkspaces.id, { onDelete: "restrict" }),
  provider: text("provider").notNull().default("unselected"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  planCode: text("plan_code").notNull(),
  billingInterval: text("billing_interval", { enum: ["monthly", "annual"] }).notNull(),
  currency: text("currency", { enum: ["USD", "EUR", "TND"] }).notNull(),
  baseAmountMinor: integer("base_amount_minor").notNull().default(0),
  amountMinor: integer("amount_minor").notNull().default(0),
  includedCredits: integer("included_credits").notNull().default(0),
  seatLimit: integer("seat_limit").notNull().default(1),
  premiumBatchMatchingEnabled: boolean("premium_batch_matching_enabled").notNull().default(false),
  status: text("status", { enum: ["pending", "active", "past_due", "canceled_at_period_end", "expired", "refunded", "disputed"] }).notNull().default("pending"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  workspaceStatusIndex: index("recruiter_subscriptions_workspace_status_idx").on(t.workspaceId, t.status),
  providerSubscriptionUnique: uniqueIndex("recruiter_provider_subscription_unique").on(t.provider, t.providerSubscriptionId),
  amountCheck: check("recruiter_subscription_amount_check", sql`${t.baseAmountMinor} >= 0 AND ${t.amountMinor} >= 0 AND ${t.includedCredits} >= 0 AND ${t.seatLimit} >= 1`)
}));

export const recruiterCreditAccounts = pgTable("recruiter_credit_accounts", {
  workspaceId: text("workspace_id").primaryKey().references(() => recruiterWorkspaces.id, { onDelete: "cascade" }),
  includedAvailable: integer("included_available").notNull().default(0),
  purchasedAvailable: integer("purchased_available").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  nonnegative: check("recruiter_credit_accounts_nonnegative", sql`${t.includedAvailable} >= 0 AND ${t.purchasedAvailable} >= 0 AND ${t.reserved} >= 0`)
}));

export const recruiterEvaluationBatches = pgTable("recruiter_evaluation_batches", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => recruiterWorkspaces.id, { onDelete: "restrict" }),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "restrict" }),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed", "canceled"] }).notNull().default("queued"),
  cvCount: integer("cv_count").notNull(),
  jobDescriptionCount: integer("job_description_count").notNull(),
  evaluationCount: integer("evaluation_count").notNull(),
  creditsReserved: integer("credits_reserved").notNull(),
  premiumBatchMatchingRequired: boolean("premium_batch_matching_required").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failureCode: text("failure_code")
}, (t) => ({
  idempotencyUnique: uniqueIndex("recruiter_evaluation_batches_idempotency_unique").on(t.idempotencyKey),
  workspaceCreatedIndex: index("recruiter_batches_workspace_created_idx").on(t.workspaceId, t.createdAt),
  limitsCheck: check("recruiter_batch_limits_check", sql`${t.cvCount} BETWEEN 1 AND 10 AND ${t.jobDescriptionCount} BETWEEN 1 AND 50 AND ${t.evaluationCount} BETWEEN 1 AND 50 AND ${t.creditsReserved} = ${t.evaluationCount}`)
}));

export const recruiterBatchPairs = pgTable("recruiter_batch_pairs", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => recruiterEvaluationBatches.id, { onDelete: "cascade" }),
  cvReference: text("cv_reference").notNull(),
  jobDescriptionReference: text("job_description_reference").notNull(),
  status: text("status", { enum: ["queued", "running", "completed", "failed", "canceled"] }).notNull().default("queued"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true })
}, (t) => ({
  pairUnique: uniqueIndex("recruiter_batch_pairs_unique").on(t.batchId, t.cvReference, t.jobDescriptionReference),
  batchStatusIndex: index("recruiter_batch_pairs_batch_status_idx").on(t.batchId, t.status)
}));

export const recruiterCreditLedger = pgTable("recruiter_credit_ledger", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => recruiterWorkspaces.id, { onDelete: "restrict" }),
  batchId: text("batch_id").references(() => recruiterEvaluationBatches.id, { onDelete: "set null" }),
  creditBucket: text("credit_bucket", { enum: ["included", "purchased"] }).notNull(),
  entryType: text("entry_type", { enum: ["subscription_grant", "credit_pack_purchase", "evaluation_reserve", "evaluation_consume", "evaluation_release", "refund_reversal", "admin_adjustment"] }).notNull(),
  amount: integer("amount").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  referenceId: text("reference_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  idempotencyUnique: uniqueIndex("recruiter_credit_ledger_idempotency_unique").on(t.idempotencyKey),
  workspaceCreatedIndex: index("recruiter_credit_ledger_workspace_created_idx").on(t.workspaceId, t.createdAt),
  amountCheck: check("recruiter_credit_ledger_amount_check", sql`${t.amount} <> 0`)
}));

export const paymentTransactions = pgTable("payment_transactions", {
  id: text("id").primaryKey(),
  product: text("product", { enum: ["candidate", "recruiter"] }).notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "restrict" }),
  workspaceId: text("workspace_id").references(() => recruiterWorkspaces.id, { onDelete: "restrict" }),
  provider: text("provider").notNull(),
  providerCheckoutId: text("provider_checkout_id"),
  providerTransactionId: text("provider_transaction_id"),
  referenceId: text("reference_id").notNull(),
  purpose: text("purpose", { enum: ["subscription", "one_time"] }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency", { enum: ["USD", "EUR", "TND"] }).notNull(),
  status: text("status", { enum: ["pending", "paid", "failed", "refunded", "disputed", "expired"] }).notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  idempotencyUnique: uniqueIndex("payment_transactions_idempotency_unique").on(t.idempotencyKey),
  providerTransactionUnique: uniqueIndex("payment_provider_transaction_unique").on(t.provider, t.providerTransactionId),
  referenceStatusIndex: index("payment_transactions_reference_status_idx").on(t.referenceId, t.status),
  ownerCheck: check("payment_transactions_owner_check", sql`(${t.product} = 'candidate' AND ${t.userId} IS NOT NULL AND ${t.workspaceId} IS NULL) OR (${t.product} = 'recruiter' AND ${t.workspaceId} IS NOT NULL AND ${t.userId} IS NULL)`),
  amountCheck: check("payment_transactions_amount_check", sql`${t.amountMinor} >= 0`)
}));
