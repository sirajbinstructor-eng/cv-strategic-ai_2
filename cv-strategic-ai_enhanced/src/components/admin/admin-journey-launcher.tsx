"use client";

import { useState } from "react";

type Journey = "job_seeker" | "recruiter";

export function AdminJourneyLauncher() {
  const [busy, setBusy] = useState<Journey | null>(null);
  const [error, setError] = useState("");

  async function openJourney(accountType: Journey) {
    setBusy(accountType);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          accountType,
          workspaceName: accountType === "recruiter" ? "" : undefined
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to open this product journey.");

      window.location.assign(
        accountType === "job_seeker" ? "/dashboard?adminPreview=job-seeker" : "/recruiter"
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open this product journey.");
      setBusy(null);
    }
  }

  return (
    <div className="admin-journey-launcher">
      <div className="account-type-options">
        <button type="button" className="account-type-option" disabled={busy !== null} onClick={() => openJourney("job_seeker")}>
          <span className="account-type-icon" aria-hidden="true">👤</span>
          <strong>Explore Job Seeker Journey</strong>
          <small>Inspect candidate onboarding, Analysis and Consulting experiences, CV tools and subscriptions.</small>
          <span className="button-primary">{busy === "job_seeker" ? "Opening…" : "Open Job Seeker →"}</span>
        </button>
        <button type="button" className="account-type-option" disabled={busy !== null} onClick={() => openJourney("recruiter")}>
          <span className="account-type-icon" aria-hidden="true">🏢</span>
          <strong>Explore Recruiter / HR Journey</strong>
          <small>Inspect company onboarding, workspace, job descriptions, candidate CVs and evaluations.</small>
          <span className="button-primary">{busy === "recruiter" ? "Opening…" : "Open Recruiter / HR →"}</span>
        </button>
      </div>
      {error && <p className="form-message" role="alert">{error}</p>}
      <p className="muted">Administrator privileges are retained in both journeys. Return to the Admin Dashboard at any time using the header link.</p>
    </div>
  );
}
