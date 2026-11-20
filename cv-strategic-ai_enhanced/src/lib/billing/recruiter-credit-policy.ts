export const MAX_RECRUITER_BATCH_CVS = 10;
export const MAX_JOB_DESCRIPTIONS_PER_CV = 5;
export const MAX_RECRUITER_BATCH_EVALUATIONS = 10;

export interface RecruiterEvaluationPair {
  cvId: string;
  jobDescriptionId: string;
}

export interface RecruiterBatchPlan {
  cvCount: number;
  jobDescriptionCount: number;
  evaluationCount: number;
  creditsRequired: number;
  maximumJobDescriptionsForOneCv: number;
  workflow: "candidates_for_job" | "jobs_for_candidate";
  premiumBatchMatchingRequired: boolean;
}

export class RecruiterBatchValidationError extends Error {
  readonly code = "INVALID_RECRUITER_BATCH";
  constructor(message: string) {
    super(message);
    this.name = "RecruiterBatchValidationError";
  }
}

/**
 * One credit pays for exactly one distinct CV/job-description assessment.
 * Only one selection axis may contain multiple items:
 * - one job description with 1–10 CVs; OR
 * - one CV with 1–5 job descriptions.
 * A multi-CV × multi-job Cartesian matrix is deliberately unsupported.
 */
export function createRecruiterBatchPlan(
  pairs: RecruiterEvaluationPair[],
  options: { premiumBatchMatchingEnabled: boolean }
): RecruiterBatchPlan {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    throw new RecruiterBatchValidationError("Select at least one CV/job-description pair.");
  }
  if (pairs.length > MAX_RECRUITER_BATCH_EVALUATIONS) {
    throw new RecruiterBatchValidationError(
      "A batch cannot exceed 10 evaluations. Choose one job with 1–10 CVs, or one CV with 1–5 jobs."
    );
  }

  const uniquePairs = new Set<string>();
  const jobsByCv = new Map<string, Set<string>>();
  const allCvs = new Set<string>();
  const allJobs = new Set<string>();

  for (const pair of pairs) {
    if (!pair || typeof pair.cvId !== "string" || !pair.cvId.trim()
      || typeof pair.jobDescriptionId !== "string" || !pair.jobDescriptionId.trim()) {
      throw new RecruiterBatchValidationError("Every evaluation must identify a CV and a job description.");
    }
    const cvId = pair.cvId.trim();
    const jobId = pair.jobDescriptionId.trim();
    const key = JSON.stringify([cvId, jobId]);
    if (uniquePairs.has(key)) {
      throw new RecruiterBatchValidationError("Duplicate CV/job-description pairs are not allowed.");
    }
    uniquePairs.add(key);
    allCvs.add(cvId);
    allJobs.add(jobId);
    const jobs = jobsByCv.get(cvId) ?? new Set<string>();
    jobs.add(jobId);
    jobsByCv.set(cvId, jobs);
    if (jobs.size > MAX_JOB_DESCRIPTIONS_PER_CV) {
      throw new RecruiterBatchValidationError("One CV can be assessed against at most 5 job descriptions.");
    }
  }

  if (allCvs.size > MAX_RECRUITER_BATCH_CVS) {
    throw new RecruiterBatchValidationError("A batch can contain at most 10 CVs.");
  }

  const maximumJobDescriptionsForOneCv = Math.max(...Array.from(jobsByCv.values(), (jobs) => jobs.size));
  const candidatesForOneJob = allJobs.size === 1;
  const oneCandidateForMultipleJobs = allCvs.size === 1 && allJobs.size <= MAX_JOB_DESCRIPTIONS_PER_CV;
  if (!candidatesForOneJob && !oneCandidateForMultipleJobs) {
    throw new RecruiterBatchValidationError(
      "Choose exactly one workflow: evaluate 1–10 CVs against one job description, OR evaluate one CV against 1–5 job descriptions. A combined multi-CV/multi-job matrix is not supported."
    );
  }

  const workflow = candidatesForOneJob ? "candidates_for_job" : "jobs_for_candidate";
  const premiumBatchMatchingRequired = allCvs.size > 1 || maximumJobDescriptionsForOneCv > 1;
  if (premiumBatchMatchingRequired && !options.premiumBatchMatchingEnabled) {
    throw new RecruiterBatchValidationError("This multi-CV or multi-position batch requires the premium batch-matching entitlement.");
  }

  return {
    cvCount: allCvs.size,
    jobDescriptionCount: allJobs.size,
    evaluationCount: uniquePairs.size,
    creditsRequired: uniquePairs.size,
    maximumJobDescriptionsForOneCv,
    workflow,
    premiumBatchMatchingRequired
  };
}

export function calculateRecruiterEvaluationCredits(pairCount: number): number {
  if (!Number.isInteger(pairCount) || pairCount < 1 || pairCount > MAX_RECRUITER_BATCH_EVALUATIONS) {
    throw new RecruiterBatchValidationError("Evaluation count must be between 1 and 10.");
  }
  return pairCount;
}
