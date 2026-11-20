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
  assert.equal(plan.workflow, "candidates_for_job");
  assert.equal(plan.premiumBatchMatchingRequired, false);
});

test("one job description can be evaluated against ten CVs (ten credits)", () => {
  const pairs = Array.from({ length: 10 }, (_, i) => ({ cvId: `cv-${i + 1}`, jobDescriptionId: "jd-1" }));
  const plan = createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true });
  assert.equal(plan.workflow, "candidates_for_job");
  assert.equal(plan.cvCount, 10);
  assert.equal(plan.jobDescriptionCount, 1);
  assert.equal(plan.creditsRequired, 10);
});

test("one CV can be evaluated against five job descriptions (five credits)", () => {
  const pairs = Array.from({ length: 5 }, (_, i) => ({ cvId: "cv-1", jobDescriptionId: `jd-${i + 1}` }));
  const plan = createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true });
  assert.equal(plan.workflow, "jobs_for_candidate");
  assert.equal(plan.cvCount, 1);
  assert.equal(plan.jobDescriptionCount, 5);
  assert.equal(plan.creditsRequired, 5);
});

test("rejects a combined multi-CV by multi-job matrix", () => {
  const pairs = [
    { cvId: "cv-1", jobDescriptionId: "jd-1" },
    { cvId: "cv-1", jobDescriptionId: "jd-2" },
    { cvId: "cv-2", jobDescriptionId: "jd-1" },
    { cvId: "cv-2", jobDescriptionId: "jd-2" }
  ];
  assert.throws(
    () => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true }),
    /one workflow|combined multi-CV/i
  );
});

test("rejects more than ten CVs for one job", () => {
  const pairs = Array.from({ length: 11 }, (_, i) => ({ cvId: `cv-${i + 1}`, jobDescriptionId: "jd-1" }));
  assert.throws(() => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true }));
});

test("rejects more than five jobs for one CV", () => {
  const pairs = Array.from({ length: 6 }, (_, i) => ({ cvId: "cv-1", jobDescriptionId: `jd-${i + 1}` }));
  assert.throws(() => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: true }));
});

test("rejects duplicate CV/job pairs", () => {
  assert.throws(() => createRecruiterBatchPlan([
    { cvId: "cv-1", jobDescriptionId: "jd-1" },
    { cvId: "cv-1", jobDescriptionId: "jd-1" }
  ], { premiumBatchMatchingEnabled: true }));
});

test("credits do not unlock premium batch matching", () => {
  const pairs = [{ cvId: "cv-1", jobDescriptionId: "jd-1" }, { cvId: "cv-2", jobDescriptionId: "jd-1" }];
  assert.throws(() => createRecruiterBatchPlan(pairs, { premiumBatchMatchingEnabled: false }), RecruiterBatchValidationError);
});

test("credit helper enforces the maximum of ten evaluations", () => {
  assert.equal(calculateRecruiterEvaluationCredits(10), 10);
  assert.throws(() => calculateRecruiterEvaluationCredits(11));
});
