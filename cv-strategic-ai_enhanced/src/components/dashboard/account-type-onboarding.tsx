"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type Props = {
  isAdmin?: boolean;
  initialAccountType?: "job_seeker" | "recruiter" | null;
  onComplete?: () => void;
};

export function AccountTypeOnboarding({
  isAdmin = false,
  initialAccountType = null,
  onComplete
}: Props) {
  const [accountType, setAccountType] = useState<"job_seeker" | "recruiter">(
    initialAccountType || "job_seeker"
  );
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountType, workspaceName })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save your selection.");
      return payload;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      onComplete?.();
    },
    onError: cause => setError(
      cause instanceof Error ? cause.message : "Unable to save your selection."
    )
  });

  return (
    <section className="workspace-card account-type-onboarding">
      <p className="eyebrow">{isAdmin ? "ADMIN WORKSPACE ACCESS" : "LET'S SET UP YOUR WORKSPACE"}</p>
      <h1>{isAdmin ? "Choose a workspace to test" : "How will you use CV Strategist AI?"}</h1>
      <p className="muted">
        {isAdmin
          ? "Your administrator privileges remain active in either workspace. Choose the experience you want to inspect; you can switch again at any time."
          : "Choose the workspace that matches your role. This determines which tools and workspace you see."}
      </p>
      <div className="account-type-options">
        <button
          type="button"
          className={accountType === "job_seeker" ? "account-type-option selected" : "account-type-option"}
          aria-pressed={accountType === "job_seeker"}
          onClick={() => { setAccountType("job_seeker"); setError(""); }}
        >
          <span className="account-type-icon" aria-hidden="true">👤</span>
          <strong>Job Seeker</strong>
          <small>Analyze CVs, explore career opportunities and create targeted CVs.</small>
        </button>
        <button
          type="button"
          className={accountType === "recruiter" ? "account-type-option selected" : "account-type-option"}
          aria-pressed={accountType === "recruiter"}
          onClick={() => { setAccountType("recruiter"); setError(""); }}
        >
          <span className="account-type-icon" aria-hidden="true">🏢</span>
          <strong>HR / Recruiter / Company</strong>
          <small>Open a company workspace and explore candidate evaluation workflows.</small>
        </button>
      </div>
      {accountType === "recruiter" && (
        <label className="admin-field">
          Company or agency name
          <input
            value={workspaceName}
            onChange={event => setWorkspaceName(event.target.value)}
            maxLength={120}
            placeholder="e.g. Acme Talent or Your Company"
          />
          <small className="muted">If you already own a recruiter workspace, it will be reused.</small>
        </label>
      )}
      {error && <p className="form-message" role="alert">{error}</p>}
      <button
        type="button"
        className="button-primary"
        disabled={save.isPending || (accountType === "recruiter" && workspaceName.trim().length < 2 && !isAdmin)}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Opening your workspace…" : isAdmin ? "Continue to selected workspace →" : "Continue to my workspace →"}
      </button>
    </section>
  );
}
