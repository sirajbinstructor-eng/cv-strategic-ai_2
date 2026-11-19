"use client";

import { useState } from "react";
import type { Analysis } from "@/lib/ai/analysis";

type Props = { analysisId: string; analysis: Analysis; sourceCvText: string; jobDescription: string; contactDetails: { email: string; phone: string; linkedin: string; website: string }; generationAllowed: boolean; onUpgrade: () => void };

export function AnalysisResults({ analysisId, analysis, sourceCvText, jobDescription, contactDetails, generationAllowed, onUpgrade }: Props) {
  const [candidateName, setCandidateName] = useState(analysis.candidateName || "");
  const [contact, setContact] = useState([contactDetails.email, contactDetails.phone, contactDetails.linkedin, contactDetails.website].filter(Boolean).join(" | "));
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [confirmedFacts, setConfirmedFacts] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const breakdown = Object.entries(analysis.match.breakdown);

  async function generate() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/analysis/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, analysis, sourceCvText, jobDescription, candidateName, contact, confirmedFacts, format })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "CV generation failed.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `CV_${(candidateName || "Candidate").replace(/[^a-z0-9_-]/gi, "_")}_targeted.${format}`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage(`Your ATS-friendly ${format.toUpperCase()} is ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CV generation failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="results-card">
      <div className="results-heading"><div><p className="eyebrow">ASSESSMENT RESULTS</p><h2>Your CV analysis</h2><p className="muted">An evidence-based estimate — not an actual ATS score or hiring probability.</p></div><div className="score-orb"><strong>{analysis.match.score}%</strong><span>Match estimate</span></div></div>
      <p className="analysis-explanation">{analysis.match.explanation}</p>
      <div className="breakdown-grid">{breakdown.map(([key, item]) => <article className="breakdown-item" key={key}><div className="breakdown-top"><strong>{key.replace(/([A-Z])/g, " $1").replace(/^./, x => x.toUpperCase())}</strong><b>{item.score}%</b></div><div className="meter"><span style={{ width: `${item.score}%` }} /></div><p>{item.explanation}</p></article>)}</div>
      <div className="result-columns">
        <article><h3>Key strengths</h3><ul>{analysis.strengths.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></article>
        <article><h3>Evidence gaps</h3><ul>{analysis.gaps.map((item, index) => <li key={`${index}-${item.item}`}><strong>{item.item}</strong><span>{item.status === "not_found" ? "Not found in source CV" : "Needs confirmation"}</span></li>)}</ul></article>
      </div>
      <div className="evidence-section"><h3>Evidence assessment</h3><div className="evidence-list">{analysis.match.evidenceItems.map((item, index) => <article className="evidence-item" key={`${index}-${item.requirement}`}><div><strong>{item.requirement}</strong><span className={`evidence-status status-${item.status}`}>{item.status.replaceAll("_", " ")}</span></div>{item.evidence && <p className="evidence-quote">“{item.evidence}”</p>}<p>{item.reason}</p></article>)}</div></div>
      {generationAllowed ? <div className="generate-card"><div><p className="eyebrow">NEXT STEP</p><h3>Generate your targeted CV</h3><p className="muted">Review the details below. Your source chronology is preserved; unsupported facts are not added.</p></div>
        <div className="generate-fields"><label>Output format<select value={format} onChange={event => setFormat(event.target.value as "docx" | "pdf")}><option value="docx">Microsoft Word (.docx)</option><option value="pdf">PDF (.pdf)</option></select></label><label>Candidate name<input value={candidateName} onChange={e => setCandidateName(e.target.value)} maxLength={160} /></label><label>Contact override (optional)<input value={contact} onChange={e => setContact(e.target.value)} maxLength={500} placeholder="Email · Phone · LinkedIn" /></label><label className="field-span">Additional facts explicitly confirmed by you<textarea rows={3} value={confirmedFacts} onChange={e => setConfirmedFacts(e.target.value)} maxLength={8000} placeholder="Only include details you can substantiate..." /></label></div>
        <button className="button-primary" type="button" onClick={generate} disabled={busy}>{busy ? "Generating CV…" : `Generate ${format.toUpperCase()} CV`}<span aria-hidden="true">→</span></button>{message && <p className="inline-message" role="status">{message}</p>}
      </div> : <div className="final-trial-notice"><strong>Your free CV generation has been used.</strong><p>You've reached the free CV-generation limit. Upgrade your plan to generate more targeted CVs and continue tailoring your applications.</p><button className="button-primary" type="button" onClick={onUpgrade}>Upgrade to generate more CVs <span aria-hidden="true">→</span></button></div>}
    </section>
  );
}
