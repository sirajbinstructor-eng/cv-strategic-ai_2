"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
export function AccountTypeOnboarding() {
  const [accountType,setAccountType]=useState<"job_seeker"|"recruiter">("job_seeker");
  const [workspaceName,setWorkspaceName]=useState("");
  const [error,setError]=useState("");
  const queryClient=useQueryClient(); const router=useRouter();
  const save=useMutation({mutationFn:async()=>{
    const response=await fetch("/api/account/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accountType,workspaceName})});
    const payload=await response.json(); if(!response.ok)throw new Error(payload.error||"Unable to save your selection."); return payload;
  },onSuccess:async()=>{await queryClient.invalidateQueries({queryKey:["account"]});router.refresh();},onError:cause=>setError(cause instanceof Error?cause.message:"Unable to save your selection.")});
  return <section className="workspace-card account-type-onboarding"><p className="eyebrow">LET'S SET UP YOUR WORKSPACE</p><h1>How will you use CV Strategist AI?</h1><p className="muted">Choose the workspace that matches your role. This determines which tools and workspace you see.</p><div className="account-type-options">
    <button type="button" className={accountType==="job_seeker"?"account-type-option selected":"account-type-option"} aria-pressed={accountType==="job_seeker"} onClick={()=>setAccountType("job_seeker")}><span className="account-type-icon" aria-hidden="true">👤</span><strong>I'm looking for a job</strong><small>Job Seeker — analyze my CV, match opportunities and create targeted CVs.</small></button>
    <button type="button" className={accountType==="recruiter"?"account-type-option selected":"account-type-option"} aria-pressed={accountType==="recruiter"} onClick={()=>setAccountType("recruiter")}><span className="account-type-icon" aria-hidden="true">🏢</span><strong>I'm hiring / evaluating candidates</strong><small>HR / Recruiter / Company — organize a team workspace and evaluate CVs against open positions.</small></button>
  </div>{accountType==="recruiter"&&<label className="admin-field">Company or agency name<input value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} maxLength={120} placeholder="e.g. Acme Talent or Your Company"/></label>}{error&&<p className="form-message" role="alert">{error}</p>}<button type="button" className="button-primary" disabled={save.isPending||(accountType==="recruiter"&&workspaceName.trim().length<2)} onClick={()=>save.mutate()}>{save.isPending?"Setting up your workspace…":"Continue to my workspace →"}</button></section>;
}