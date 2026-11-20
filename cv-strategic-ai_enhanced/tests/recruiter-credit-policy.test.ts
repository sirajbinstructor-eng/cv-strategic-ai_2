import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRecruiterBatchPlan,
  calculateRecruiterEvaluationCredits,
  RecruiterBatchValidationError
} from "../src/lib/billing/recruiter-credit-policy";

test("one CV assessed against one job description costs one credit", () => {
  const plan = createRecruiterBatchPlan([{ cvId: "cv-1", jobDescriptionId: "jd-1" }], { premiumBatchMatchingEnabled: false });
  assert.equal(plan.creditsRequired, 1);
  assert.equal(plan.premiumBatchMatchingRequired, false);
});

test("one CV assessed against five jobs costs five credits and requires premium batch matching", () => {
  const pairs = Array.from({ length: 5 }, (_, i) => ({ cvId: "cv-1", jobDescriptionId: `jd-${i + 1}` }));
  const plan = createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true });
  assert.equal(plan.creditsRequired, 5);
  assert.equal(plan.jobDescriptionCount, 5);
  assert.equal(plan.premiumBatchMatchingRequired, true);
});

test("ten CVs assessed against one job cost ten credits", () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({ cvId: `cv-${i + 1}`, jobDescriptionId: "jd-1" }));
  const plan = createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true });
  assert.equal(plan.cvCount, 10);
  assert.equal(plan.creditsRequired, 10);
});

test("ten CVs assessed against five jobs cost fifty credits", () => {
  const pairs = Array.from({ length: 10 }, (_, cv) =>
    Array.from({ length: 5 }, (_, jd) => ({ cvId: `cv-${cv + 1}`, jobDescriptionId: `jd-${jd + 1}` }))
  ).flat();
  const plan = createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true });
  assert.equal(plan.cvCount, 10);
  assert.equal(plan.jobDescriptionCount, 5);
  assert.equal(plan.evaluationCount, 50);
  assert.equal(plan.creditsRequired, 50);
});

test("credits do not unlock premium batch matching", () => {
  const pairs = [{ cvId: "cv-1", jobDescriptionId: "jd-1" }, { cvId: "cv-2", jobDescriptionId: "jd-1" }];
  assert.throws(() => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: false }), RecruiterBatchValidationError);
});

test("rejects more than five job descriptions for one CV", () => {
  const pairs = Array.from({ length: 6 }, (_, i) => ({ cvId: "cv-1", jobDescriptionId: `jd-${i + 1}` }));
  assert.throws(() => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true }));
});

test("rejects more than ten CVs and duplicate pairs", () => {
  const tooMany = Array.from({ length: 11 }, (_, i) => ({ cvId: `cv-${i + 1}`, jobDescriptionId: "jd-1" }));
  assert.throws(() => createRecruiterBatchPlan(tooMany, { premiumBatchMatchingEnabled: true }));
  assert.throws(() => createRecruiterBatchPlan([{ cvId: "cv-1", jobDescriptionId: "jd-1" }, { cvId: "cv-1", jobDescriptionId: "jd-1" }], { premiumBatchMatchingEnabled: true }));
});

test("credit helper validates the requested evaluation count", () => {
  assert.equal(calculateRecruiterEvaluationCredits(50), 50);
  assert.throws(() => calculateRecruiterEvaluationCredits(51));
});
