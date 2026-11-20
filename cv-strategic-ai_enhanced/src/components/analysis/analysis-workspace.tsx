"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnalysisResults } from "@/components/analysis/analysis-results";
import type { Analysis } from "@/lib/ai/analysis";

type Entitlements = { workspaceLocked: boolean; unlimited: boolean; remaining: number | null; used: number; granted: number; consultantEntitled: boolean };
type AnalysisResponse = { analysisId: string; analysis: Analysis; sourceCvText: string; jobDescription: string; source: { contactDetails: { email: string; phone: string; linkedin: string; website: string } }; entitlements: { remaining: number | null; used: number; granted: number; unlimited: boolean; workspaceLocked: boolean } | null };
const formSchema = z.object({ jobDescription: z.string().trim().min(80, "Please provide at least 80 characters.").max(30_000, "Maximum 30,000 characters.") });
type FormValues = z.infer<typeof formSchema>;

export function AnalysisWorkspace({ entitlements, onUpgrade }: { entitlements: Entitlements; onUpgrade: () => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedMode, setSelectedMode] = useState<"analysis" | "consulting">("analysis");
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { jobDescription: "" } });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!file) throw new Error("Please select your CV (DOCX or PDF).");
      const data = new FormData();
      data.set("cv", file);
      data.set("jobDescription", values.jobDescription);
      data.set("mode", selectedMode);
      const response = await fetch("/api/analysis/analyze", { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analysis failed.");
      return payload as AnalysisResponse;
    },
    onSuccess: async (payload) => {
      setResult(payload);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Analysis failed.")
  });

  const locked = entitlements.workspaceLocked && !result;

  return (
    <section className="workspace-card" id="analysis-workspace">
      <div className="section-title-row"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Build your targeted CV</h2><p className="muted">Start with your current CV and the complete target job description.</p></div><span className="step-label">ANALYSIS · 01</span></div>
      {locked ? (
        <div className="locked-preview"><div className="locked-preview-content" aria-hidden="true"><div className="mode-row"><div className="mode-option active"><strong>Analysis mode</strong></div><div className="mode-option"><strong>Consulting mode</strong></div></div><div className="skeleton-panel"><span /><span /><span /></div><div className="skeleton-panel"><span /><span /><span /><span /></div></div><div className="locked-overlay"><div className="lock-icon">⌑</div><p className="eyebrow">ACCESS RESTRICTED</p><h3>You've used all 3 free analyses.</h3><p>Your dashboard and account settings remain accessible. Upgrade to continue using CV Strategist AI.</p><button className="button-primary" type="button" onClick={onUpgrade}>Upgrade now for more! <span aria-hidden="true">→</span></button></div></div>
      ) : entitlements.workspaceLocked && result ? (
        <div className="final-trial-notice"><strong>You've used all 3 free analyses.</strong><p>Your completed analysis remains available in this session. New analyses are locked. Upgrade now for more!</p><button className="button-secondary" type="button" onClick={onUpgrade}>View upgrade options</button></div>
      ) : (
        <>
          <div className="mode-row"><button type="button" className={selectedMode === "analysis" ? "mode-option active" : "mode-option"} aria-pressed={selectedMode === "analysis"} onClick={() => setSelectedMode("analysis")}><span className="mode-check">{selectedMode === "analysis" ? "✓" : "01"}</span><div><strong>Analysis mode</strong><small>Evidence-based assessment and targeted CV recommendations.</small></div><span className="mode-tag">Included</span></button><button type="button" className={selectedMode === "consulting" ? "mode-option active" : entitlements.consultantEntitled ? "mode-option" : "mode-option mode-locked"} aria-pressed={selectedMode === "consulting"} disabled={!entitlements.consultantEntitled} onClick={() => setSelectedMode("consulting")}><span className="mode-lock">◆</span><div><strong>Consulting mode</strong><small>Deeper coaching, prioritized questions and guided refinement.</small></div><span className="mode-tag paid">{entitlements.consultantEntitled ? "Available" : "Gold / Admin"}</span></button></div>
          <form className="analysis-form" onSubmit={form.handleSubmit(values => mutation.mutate(values))}>
            <label className="upload-box"><span className="upload-symbol">↑</span><strong>{file ? file.name : "Choose your current CV"}</strong><small>DOCX or text-based PDF · Maximum 12 MB</small><input type="file" accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] || null)} /></label>
            <label className="form-label" htmlFor="jobDescription">Target job description</label>
            <p className="field-hint">Paste the full job description for a meaningful assessment. 80–30,000 characters.</p>
            <textarea id="jobDescription" rows={9} placeholder="Paste the complete job description here…" {...form.register("jobDescription")} />
            {form.formState.errors.jobDescription && <small className="field-error">{form.formState.errors.jobDescription.message}</small>}
            {error && <p className="form-message" role="alert">{error}</p>}
            <button className="button-primary analyze-button" type="submit" disabled={mutation.isPending || !file}>{mutation.isPending ? "Analyzing your profile…" : "Analyze my CV"}<span aria-hidden="true">→</span></button>
            <p className="privacy-note">Your CV is processed for this analysis. The raw CV text is held in browser memory for the current session and is not stored in the database.</p>
          </form>
        </>
      )}
      {result && <div className="analysis-result-wrap"><div className="success-strip">Analysis completed. {result.entitlements?.unlimited ? "Your account has unrestricted access." : result.entitlements ? `${result.entitlements.remaining ?? 0} free ${result.entitlements.remaining === 1 ? "analysis" : "analyses"} remaining.` : "Your trial status will refresh when your dashboard reloads."}</div><AnalysisResults analysisId={result.analysisId} analysis={result.analysis} sourceCvText={result.sourceCvText} jobDescription={result.jobDescription} contactDetails={result.source.contactDetails} generationAllowed={Boolean(result.entitlements?.unlimited || result.entitlements?.used === 1)} onUpgrade={onUpgrade} /></div>}
    </section>
  );
}
