import type { Analysis } from "@/lib/ai/analysis";

const CATEGORY_WEIGHTS = {
  mandatoryRequirements: 0.35,
  responsibilities: 0.25,
  technicalSkills: 0.20,
  toolsMethods: 0.10,
  seniorityLeadership: 0.10
} as const;

const STATUS_VALUE = {
  verified: 1,
  partial: 0.5,
  needs_confirmation: 0.25,
  not_found: 0
} as const;

/**
 * Recalculates category and overall scores from the structured evidence statuses.
 * Model-generated percentages are retained only as a fallback for categories for
 * which the JD produced no evidence item. The overall score is always a weighted mean.
 */
export function applyDeterministicScoring(analysis: Analysis): Analysis {
  const categories = Object.keys(CATEGORY_WEIGHTS) as Array<keyof typeof CATEGORY_WEIGHTS>;
  for (const category of categories) {
    const items = analysis.match.evidenceItems.filter(item => item.category === category);
    if (!items.length) continue;
    const coverage = items.reduce((sum, item) => sum + STATUS_VALUE[item.status], 0) / items.length;
    const score = Math.round(coverage * 100);
    analysis.match.breakdown[category].score = score;
    analysis.match.breakdown[category].explanation = `${items.filter(item => item.status === "verified").length} of ${items.length} requirements are directly evidenced; partial and unconfirmed evidence is discounted.`;
  }
  const weightedTotal = categories.reduce((sum, category) => sum + analysis.match.breakdown[category].score * CATEGORY_WEIGHTS[category], 0);
  analysis.match.score = Math.round(weightedTotal);
  analysis.match.explanation = `Evidence-weighted estimate: mandatory requirements 35%, responsibilities 25%, technical skills 20%, tools and methods 10%, and seniority/leadership 10%. The calculation discounts partial and unconfirmed evidence.`;
  return analysis;
}
