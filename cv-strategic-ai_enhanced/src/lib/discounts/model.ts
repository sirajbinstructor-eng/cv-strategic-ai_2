import { z } from "zod";

export const discountCategorySchema = z.enum(["student", "recent_graduate", "early_career"]);
export const nationalitySchema = z.enum(["tunisian", "non_tunisian"]);
export const nationalityEvidenceSchema = z.enum(["cin", "passport", "tunisian_driving_licence", "other_official"]);
export const statusSchema = z.enum(["pending", "approved", "rejected", "revoked", "expired"]);

export const applyDiscountSchema = z.object({
  category: discountCategorySchema,
  nationality: nationalitySchema,
  nationalityEvidenceType: nationalityEvidenceSchema.optional(),
  studentEvidenceType: z.string().trim().max(100).optional(),
  graduationDate: z.coerce.date().optional(),
  noWorkSinceGraduation: z.boolean().optional(),
  professionalExperienceMonths: z.number().int().min(0).max(600).optional(),
  declarationAccepted: z.literal(true)
}).superRefine((value, ctx) => {
  if (value.nationality === "tunisian" && !value.nationalityEvidenceType) {
    ctx.addIssue({ code: "custom", path: ["nationalityEvidenceType"], message: "Select your Tunisian nationality evidence." });
  }
  if (value.category === "student" && !value.studentEvidenceType) {
    ctx.addIssue({ code: "custom", path: ["studentEvidenceType"], message: "Provide the type of current student evidence." });
  }
  if (value.category === "recent_graduate") {
    if (!value.graduationDate) ctx.addIssue({ code: "custom", path: ["graduationDate"], message: "Graduation date is required." });
    if (value.noWorkSinceGraduation === undefined) ctx.addIssue({ code: "custom", path: ["noWorkSinceGraduation"], message: "Confirm your work history since graduation." });
  }
  if (value.category === "early_career" && value.professionalExperienceMonths === undefined) {
    ctx.addIssue({ code: "custom", path: ["professionalExperienceMonths"], message: "Professional experience in months is required." });
  }
});

export const reviewDiscountSchema = z.object({
  decision: z.enum(["approved", "rejected", "revoked"]),
  reviewNotes: z.string().trim().max(1000).optional()
});

export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type ReviewDiscountInput = z.infer<typeof reviewDiscountSchema>;

export function calculateDiscount(input: Pick<ApplyDiscountInput, "category" | "nationality" | "graduationDate" | "noWorkSinceGraduation" | "professionalExperienceMonths">, now = new Date()) {
  if (input.category === "student") return { percent: input.nationality === "tunisian" ? 40 : 20, reason: "student" as const };
  if (input.category === "recent_graduate") {
    if (!input.graduationDate) throw Object.assign(new Error("Graduation date is required."), { status: 400 });
    const maxMonths = input.noWorkSinceGraduation ? 24 : 12;
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - maxMonths);
    if (input.graduationDate.getTime() > now.getTime() || input.graduationDate.getTime() < cutoff.getTime()) {
      throw Object.assign(new Error(`Recent graduates must have graduated within ${maxMonths} months.`), { status: 400 });
    }
    return { percent: input.nationality === "tunisian" ? 40 : 20, reason: "recent_graduate" as const };
  }
  if (input.category === "early_career") {
    if (input.professionalExperienceMonths === undefined || input.professionalExperienceMonths >= 24) {
      throw Object.assign(new Error("The early-career discount requires less than 24 months of professional experience."), { status: 400 });
    }
    return { percent: 10, reason: "early_career" as const };
  }
  return { percent: 0, reason: "none" as const };
}
