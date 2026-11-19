
import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { emailOTP } from "better-auth/plugins";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendOtpEmail } from "@/lib/email";

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const microsoftConfigured = Boolean(
  process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
);

if (
  process.env.NODE_ENV === "production" &&
  (
    !process.env.BETTER_AUTH_SECRET ||
    !process.env.BETTER_AUTH_URL ||
    !process.env.GOOGLE_SCRIPT_URL ||
    !process.env.GOOGLE_SCRIPT_SECRET
  )
) {
  throw new Error(
    "BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET are required in production."
  );
}

const baseURL =
  process.env.BETTER_AUTH_URL || "http://localhost:3000";

export const auth = betterAuth({
  appName: "CV Strategist AI",
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "development-only-change-this-secret-before-deploying",

  trustedOrigins: [baseURL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),

  account: {
    accountLinking: {
      enabled: false
    }
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      resendStrategy: "rotate",
      overrideDefaultEmailVerification: true,

      async sendVerificationOTP({ email, otp, type }) {
        await sendOtpEmail({
          to: email,
          otp,
          type
        });
      }
    })
  ],

  socialProviders: {
    ...(googleConfigured
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account",
            requireEmailVerification: true
          }
        }
      : {}),

    ...(microsoftConfigured
      ? {
          microsoft: {
            clientId: process.env.MICROSOFT_CLIENT_ID!,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
            tenantId: process.env.MICROSOFT_TENANT_ID || "common",
            prompt: "select_account"
          }
        }
      : {})
  },

  user: {
    additionalFields: {
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      },
      isUnrestricted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      },
      consultantEntitled: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false
      },
      analysisTrialsGranted: {
        type: "number",
        required: false,
        defaultValue: 3,
        input: false
      },
      analysisTrialsUsed: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      analysisTrialsReserved: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false
      },
      analysisTrialExpiresAt: {
        type: "date",
        required: false,
        defaultValue: new Date("2026-12-31T23:00:00.000Z"),
        input: false
      }
    }
  },

  advanced: {
    database: {
      // Generate the UUID in the application, not PostgreSQL.
      generateId: () => randomUUID()
    },
    useSecureCookies: process.env.NODE_ENV === "production"
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100
  }
});
