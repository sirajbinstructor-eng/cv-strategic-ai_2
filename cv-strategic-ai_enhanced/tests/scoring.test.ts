import test from "node:test";
import assert from "node:assert/strict";
import { applyDeterministicScoring } from "../src/lib/ai/scoring";
import type { Analysis } from "../src/lib/ai/analysis";

function fixture(): Analysis {
  const blank = { score: 0, explanation: "model estimate" };
  return {
    language: "en", candidateName: "", targetTitle: "", candidateHeadline: "", professionalSummary: "",
    jobAnalysis: { mandatorySkills: [], desirableSkills: [], responsibilities: [], keywords: [], seniority: "" },
    match: {
      score: 68, explanation: "model estimate",
      breakdown: {
        mandatoryRequirements: { ...blank }, responsibilities: { ...blank }, technicalSkills: { ...blank },
        toolsMethods: { ...blank }, seniorityLeadership: { ...blank }
      },
      evidenceItems: [
        { requirement: "R1", evidence: "CV evidence", status: "verified", category: "mandatoryRequirements", reason: "" },
        { requirement: "R2", evidence: "Partial evidence", status: "partial", category: "mandatoryRequirements", reason: "" }
      ]
    },
    strengths: [], gaps: [], experiences: [], skills: [], openLoops: [], questions: [], tips: [], cautions: []
  };
}

test("evidence categories are recalculated deterministically", () => {
  const first = applyDeterministicScoring(fixture());
  const second = applyDeterministicScoring(fixture());
  assert.equal(first.match.breakdown.mandatoryRequirements.score, 75);
  assert.equal(first.match.score, second.match.score);
  assert.equal(first.match.score, Math.round(75 * 0.35));
});
