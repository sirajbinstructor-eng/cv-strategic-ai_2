"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

type Job={id:string;title:string;department:string|null;location:string|null;employment_type:string|null;status:string;created_at:string};
type Candidate={id:string;original_filename:string;content_type:string;text_length:number;created_at:string;retention_expires_at:string};
type PairResult={id:string;cvId:string;jobDescriptionId:string;status:string;result?:{analysis?:{match?:{score:number;explanation:string};strengths?:string[];gaps?:Array<{item:string;status:string}>};jobTitle?:string;error?:string}};
type Batch={id:string;status:string;cv_count:number;job_description_count:number;evaluation_count:number;successful_evaluations:number;created_at:string;pairs:PairResult[]};
type Workspace={workspace:{id:string;name:string;slug:string;role:string};permissions:{canManage:boolean;isAdmin:boolean;unrestricted:boolean;premiumBatchMatchingEnabled:boolean};credits:{included:number;purchased:number;reserved:number;available:number};subscription:Record<string,unknown>|null;metrics:{jobs:{total:number;open:number};candidates:{total:number};batches:{total:number;completed:number}}};

async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const response=await fetch(url,{...init,cache:"no-store"});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.error||"The request could not be completed.");
 return payload as T;
}

export function RecruiterWorkspaceClient(){
 const [workspace,setWorkspace]=useState<Workspace|null>(null);
 const [jobs,setJobs]=useState<Job[]>([]);
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [batches,setBatches]=useState<Batch[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [tab,setTab]=useState<"overview"|"jobs"|"candidates"|"matching"|"history">("overview");
 const [jobTitle,setJobTitle]=useState("");
 const [department,setDepartment]=useState("");
 const [location,setLocation]=useState("");
 const [employmentType,setEmploymentType]=useState("Full-time");
 const [description,setDescription]=useState("");
 const [files,setFiles]=useState<File[]>([]);
 const [privacyConfirmed,setPrivacyConfirmed]=useState(false);
 const [selectedCVs,setSelectedCVs]=useState<string[]>([]);
 const [selectedJobs,setSelectedJobs]=useState<string[]>([]);
 const [expandedBatch,setExpandedBatch]=useState<string|null>(null);

 const refresh=useCallback(async()=>{
  const [w,j,c,b]=await Promise.all([
   api<Workspace>("/api/recruiter/workspace"),
   api<{jobs:Job[]}>("/api/recruiter/jobs"),
   api<{candidates:Candidate[]}>("/api/recruiter/candidates"),
   api<{batches:Batch[]}>("/api/recruiter/batches")
  ]);
  setWorkspace(w);setJobs(j.jobs);setCandidates(c.candidates);setBatches(b.batches);
  setSelectedCVs(current=>current.filter(id=>c.candidates.some(item=>item.id===id)));
  setSelectedJobs(current=>current.filter(id=>j.jobs.some(item=>item.id===id&&item.status==="open")));
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[refresh]);

 const pairs=useMemo(()=>selectedCVs.flatMap(cvId=>selectedJobs.map(jobDescriptionId=>({cvId,jobDescriptionId}))),[selectedCVs,selectedJobs]);
 const premiumRequired=selectedCVs.length>1||selectedJobs.length>1;
 const creditsAvailable=workspace?.permissions.isAdmin||workspace?.permissions.unrestricted?true:(workspace?.credits.available??0)>=pairs.length;
 const premiumAvailable=Boolean(workspace?.permissions.premiumBatchMatchingEnabled);
 const canRun=pairs.length>0&&pairs.length<=50&&creditsAvailable&&(!premiumRequired||premiumAvailable)&&!busy;

 async function createJob(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy("job");setError("");setNotice("");
  try{await api("/api/recruiter/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:jobTitle,department,location,employmentType,description,status:"open"})});
   setJobTitle("");setDepartment("");setLocation("");setDescription("");setNotice("Job description published.");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save job.");}finally{setBusy("");}
 }
 async function uploadCVs(){
  if(!files.length)return;setBusy("upload");setError("");setNotice("");
  try{const data=new FormData();files.forEach(file=>data.append("files",file));data.set("authorizationConfirmed",String(privacyConfirmed));const result=await api<{uploaded:Candidate[]}>("/api/recruiter/candidates",{method:"POST",body:data});
   setFiles([]);setPrivacyConfirmed(false);setNotice(`${result.uploaded.length} CV(s) added to your private candidate library.`);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to upload CVs.");}finally{setBusy("");}
 }
 async function deleteCandidate(id:string){
  if(!window.confirm("Delete this CV from the workspace? Its encrypted text will be erased."))return;
  setBusy("delete");setError("");
  try{await api(`/api/recruiter/candidates/${id}`,{method:"DELETE"});setNotice("CV deleted.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Unable to delete CV.");}finally{setBusy("");}
 }
 async function archiveJob(id:string){
  setBusy("job");setError("");
  try{await api(`/api/recruiter/jobs/${id}`,{method:"DELETE"});setNotice("Job archived.");await refresh();}
  catch(e){setError(e instanceof Error?e.message:"Unable to archive job.");}finally{setBusy("");}
 }
 async function runBatch(){
  if(!canRun)return;setBusy("evaluation");setError("");setNotice("");
  try{const result=await api<{batch:Batch;credits:{required:number;consumed:number;released:number};notice:string}>("/api/recruiter/batches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pairs,idempotencyKey:crypto.randomUUID()})});
   setNotice(`Evaluation completed: ${result.credits.consumed} credit(s) consumed; ${result.credits.released} returned after failed assessments.`);setTab("history");setExpandedBatch(result.batch.id);await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Unable to run evaluation.");}finally{setBusy("");}
 }
 function toggle(setter:Dispatch<SetStateAction<string[]>>,id:string,limit:number,current:string[]){
  if(current.includes(id))setter(current.filter(value=>value!==id));
  else if(current.length<limit)setter([...current,id]);
  else setError(`You can select up to ${limit} items.`);
 }

 if(loading)return <section className="workspace-card recruiter-loading"><span className="loading-dot"/> Loading your recruiter workspace…</section>;
 if(!workspace)return <section className="workspace-card"><h2>Recruiter workspace unavailable</h2><p className="form-message">{error||"Your recruiter workspace could not be loaded."}</p></section>;

 return <div className="recruiter-app">
  <section className="recruiter-hero">
   <div><p className="eyebrow">TALENT ACQUISITION · WORKSPACE</p><h1>{workspace.workspace.name}</h1><p>Manage roles, organize candidate CVs and compare evidence against your open positions.</p></div>
   <div className="recruiter-hero-side"><span className="recruiter-live"><i/> WORKSPACE ACTIVE</span><small>{workspace.workspace.role} access</small></div>
  </section>
  <nav className="recruiter-tabs" aria-label="Recruiter workspace sections">
   {([["overview","Overview"],["jobs","Job descriptions"],["candidates","Candidate CVs"],["matching","Batch matching"],["history","Evaluation history"]] as const).map(([id,label])=><button key={id} type="button" className={tab===id?"active":""} onClick={()=>{setTab(id);setError("");}}>{label}</button>)}
  </nav>
  {error&&<div className="recruiter-alert error" role="alert">{error}</div>}
  {notice&&<div className="recruiter-alert success" role="status">{notice}</div>}

  {tab==="overview"&&<>
   <div className="recruiter-metrics">
    <article><span>OPEN POSITIONS</span><strong>{workspace.metrics.jobs.open}</strong><small>{workspace.metrics.jobs.total} total job descriptions</small></article>
    <article><span>CANDIDATE CVs</span><strong>{workspace.metrics.candidates.total}</strong><small>Encrypted private library</small></article>
    <article><span>EVALUATION BATCHES</span><strong>{workspace.metrics.batches.total}</strong><small>{workspace.metrics.batches.completed} completed</small></article>
    <article><span>AVAILABLE CREDITS</span><strong>{workspace.permissions.isAdmin||workspace.permissions.unrestricted?"∞":workspace.credits.available}</strong><small>{workspace.credits.reserved} currently reserved</small></article>
   </div>
   <div className="recruiter-overview-grid">
    <article className="recruiter-panel"><p className="eyebrow">YOUR WORKFLOW</p><h2>From CV intake to a clear shortlist.</h2><ol className="recruiter-steps"><li><b>01</b><span><strong>Create your job descriptions</strong><small>Keep requirements and role details in one workspace.</small></span></li><li><b>02</b><span><strong>Upload candidate CVs</strong><small>PDF and DOCX files are encrypted before storage.</small></span></li><li><b>03</b><span><strong>Build a comparison batch</strong><small>Assess up to 10 CVs against up to 5 positions each.</small></span></li><li><b>04</b><span><strong>Review evidence and gaps</strong><small>Compare explainable results; keep all hiring decisions human-led.</small></span></li></ol>
    </article>
    <article className="recruiter-panel credit-panel"><p className="eyebrow">WORKSPACE PLAN</p><h2>{workspace.subscription?String(workspace.subscription.plan_code||"Recruiter plan"):"No active recruiter subscription"}</h2><div className="credit-total">{workspace.permissions.isAdmin||workspace.permissions.unrestricted?"∞":workspace.credits.available}<small> available evaluation credits</small></div><p>1 credit = 1 CV assessed against 1 job description. Multi-CV or multi-position matching requires the premium batch entitlement.</p><div className="premium-state">{workspace.permissions.premiumBatchMatchingEnabled?"Premium batch matching enabled":"Premium batch matching not enabled"}</div><p className="checkout-note">Recruiter plan pricing and provider checkout are kept disabled until the recruiter catalogue and merchant onboarding are approved. No payment will be initiated from this workspace.</p><button className="button-secondary" type="button" onClick={()=>setTab("matching")}>Start a comparison <span>→</span></button></article>
   </div>
  </>}

  {tab==="jobs"&&<div className="recruiter-content-grid">
   <section className="recruiter-panel"><p className="eyebrow">POSITION SETUP</p><h2>Create a job description</h2><p className="muted">Add the full role requirements so the evaluation can compare candidate evidence accurately.</p>
    <form className="recruiter-form" onSubmit={createJob}>
     <label>Job title<input required minLength={2} maxLength={160} value={jobTitle} onChange={e=>setJobTitle(e.target.value)} placeholder="e.g. Senior Mechanical Engineer"/></label>
     <div className="recruiter-form-row"><label>Department<input value={department} onChange={e=>setDepartment(e.target.value)} maxLength={120} placeholder="Engineering"/></label><label>Location<input value={location} onChange={e=>setLocation(e.target.value)} maxLength={160} placeholder="Tunis / Hybrid"/></label></div>
     <label>Employment type<select value={employmentType} onChange={e=>setEmploymentType(e.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Temporary</option></select></label>
     <label>Complete job description<textarea required minLength={80} maxLength={30000} rows={10} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Responsibilities, mandatory qualifications, skills, tools, experience and desirable criteria…"/></label>
     <small className="recruiter-hint">{description.trim().length.toLocaleString()} / 30,000 characters · Minimum 80</small>
     <button className="button-primary" disabled={busy==="job"||description.trim().length<80}>{busy==="job"?"Saving…":"Publish job description →"}</button>
    </form>
   </section>
   <section className="recruiter-panel"><div className="recruiter-panel-heading"><div><p className="eyebrow">OPENING LIBRARY</p><h2>Your positions <span className="count-chip">{jobs.filter(j=>j.status==="open").length}</span></h2></div></div>
    {jobs.length===0?<div className="recruiter-empty"><strong>No job descriptions yet</strong><p>Create your first role to start matching candidates.</p></div>:<div className="recruiter-list">{jobs.map(job=><article className="recruiter-list-item" key={job.id}><div><strong>{job.title}</strong><small>{[job.department,job.location,job.employment_type].filter(Boolean).join(" · ")||"Role details"} · {job.status}</small></div><span className={job.status==="open"?"status-open":"status-closed"}>{job.status}</span>{job.status==="open"&&<button type="button" className="text-action" onClick={()=>archiveJob(job.id)} disabled={busy==="job"}>Archive</button>}</article>)}</div>}
   </section>
  </div>}

  {tab==="candidates"&&<div className="recruiter-content-grid">
   <section className="recruiter-panel"><p className="eyebrow">PRIVATE CANDIDATE LIBRARY</p><h2>Add CVs securely</h2><p className="muted">Upload up to 10 PDF or DOCX files per batch. Extracted CV text is encrypted at rest with AES-256-GCM; original files are not retained.</p>
    <label className="recruiter-drop"><span>↑</span><strong>{files.length?files.map(f=>f.name).join(", "):"Choose candidate CV files"}</strong><small>PDF or DOCX · Up to 12 MB each · Maximum 10 at a time</small><input type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e=>{setFiles(Array.from(e.target.files||[]).slice(0,10));setError("");}}/></label>
    <label className="recruiter-consent"><input type="checkbox" checked={privacyConfirmed} onChange={e=>setPrivacyConfirmed(e.target.checked)}/><span>I confirm that my organization is authorized to process these candidates’ CVs and that candidates have received the required privacy information.</span></label>
    <p className="recruiter-hint">Candidate data is retained for up to 90 days unless deleted earlier. Original files are discarded after text extraction.</p>
    <button className="button-primary" type="button" onClick={uploadCVs} disabled={!files.length||!privacyConfirmed||busy==="upload"}>{busy==="upload"?"Encrypting and uploading…":`Upload ${files.length||""} CV(s) →`}</button>
   </section>
   <section className="recruiter-panel"><div className="recruiter-panel-heading"><div><p className="eyebrow">CANDIDATE POOL</p><h2>Uploaded CVs <span className="count-chip">{candidates.length}</span></h2></div></div>
    {candidates.length===0?<div className="recruiter-empty"><strong>Your candidate library is empty</strong><p>Uploaded CVs will appear here. The app stores encrypted extracted text, not original files.</p></div>:<div className="recruiter-list">{candidates.map(cv=><article className="recruiter-list-item" key={cv.id}><div><strong>{cv.original_filename}</strong><small>{Math.round(cv.text_length/100)/10}k characters · Added {new Date(cv.created_at).toLocaleDateString()} · Expires {new Date(cv.retention_expires_at).toLocaleDateString()}</small></div><button type="button" className="text-action danger" onClick={()=>deleteCandidate(cv.id)} disabled={busy==="delete"}>Delete</button></article>)}</div>}
   </section>
  </div>}

  {tab==="matching"&&<section className="recruiter-panel">
   <div className="recruiter-panel-heading"><div><p className="eyebrow">BATCH ORCHESTRATION</p><h2>Build your candidate-to-position matrix</h2><p className="muted">Choose up to 10 CVs and 5 open roles. Each selected CV/role pair is one separate evaluation.</p></div><div className="batch-capacity">10 CVs <b>×</b> 5 roles</div></div>
   <div className="recruiter-select-columns">
    <div><h3>1. Select candidate CVs <span>{selectedCVs.length}/10</span></h3>{candidates.length===0?<p className="recruiter-empty">Upload CVs first.</p>:<div className="recruiter-choice-list">{candidates.map(cv=><label key={cv.id}><input type="checkbox" checked={selectedCVs.includes(cv.id)} onChange={()=>toggle(setSelectedCVs,cv.id,10,selectedCVs)}/><span><strong>{cv.original_filename}</strong><small>{Math.round(cv.text_length/100)/10}k characters</small></span></label>)}</div>}</div>
    <div><h3>2. Select open positions <span>{selectedJobs.length}/5</span></h3>{jobs.filter(j=>j.status==="open").length===0?<p className="recruiter-empty">Publish a job description first.</p>:<div className="recruiter-choice-list">{jobs.filter(j=>j.status==="open").map(job=><label key={job.id}><input type="checkbox" checked={selectedJobs.includes(job.id)} onChange={()=>toggle(setSelectedJobs,job.id,5,selectedJobs)}/><span><strong>{job.title}</strong><small>{[job.department,job.location].filter(Boolean).join(" · ")||"Open position"}</small></span></label>)}</div>}</div>
   </div>
   <div className="recruiter-batch-summary"><div><small>CVs selected</small><strong>{selectedCVs.length}</strong></div><div><small>Roles selected</small><strong>{selectedJobs.length}</strong></div><div><small>Evaluations / credits</small><strong>{pairs.length}</strong></div><div><small>Available credits</small><strong>{workspace.permissions.isAdmin||workspace.permissions.unrestricted?"∞":workspace.credits.available}</strong></div></div>
   {premiumRequired&&<p className="recruiter-gate">★ This is a premium batch ({selectedCVs.length} CVs × {selectedJobs.length} roles). {premiumAvailable?"Your workspace has access.":"Premium batch matching is not included in the current workspace entitlement."}</p>}
   {!creditsAvailable&&<p className="recruiter-gate">You need {pairs.length} credits but have {workspace.credits.available}. Recruiter credit packs are not yet available for purchase.</p>}
   <div className="recruiter-action-row"><button type="button" className="button-quiet" onClick={()=>{setSelectedCVs([]);setSelectedJobs([]);}}>Clear selection</button><button type="button" className="button-primary" disabled={!canRun} onClick={runBatch}>{busy==="evaluation"?"Evaluating candidates…":`Run ${pairs.length||0} evaluation(s) →`}</button></div>
   <p className="recruiter-legal">AI results are evidence-based decision support only. They must not be used for automated rejection or hiring. Recruiters remain responsible for fair, human-led decisions.</p>
  </section>}

  {tab==="history"&&<section className="recruiter-panel"><p className="eyebrow">ASSESSMENT ARCHIVE</p><h2>Evaluation history</h2>
   {batches.length===0?<div className="recruiter-empty"><strong>No evaluations yet</strong><p>Once you run a comparison, candidate assessments and evidence summaries will appear here.</p></div>:<div className="recruiter-batch-list">{batches.map(batch=><article className="recruiter-batch" key={batch.id}><button type="button" className="recruiter-batch-head" onClick={()=>setExpandedBatch(expandedBatch===batch.id?null:batch.id)}><span><strong>{batch.cv_count} CVs · {batch.job_description_count} positions</strong><small>{new Date(batch.created_at).toLocaleString()} · {batch.successful_evaluations}/{batch.evaluation_count} completed</small></span><span className={batch.status==="completed"?"status-open":"status-closed"}>{batch.status}</span><b>{expandedBatch===batch.id?"−":"+"}</b></button>
    {expandedBatch===batch.id&&<div className="recruiter-results">{batch.pairs.map(pair=><article className="recruiter-result-row" key={pair.id}><div><strong>{candidates.find(c=>c.id===pair.cvId)?.original_filename||"Candidate CV"}</strong><small>{jobs.find(j=>j.id===pair.jobDescriptionId)?.title||pair.result?.jobTitle||"Position"}</small></div>{pair.status==="completed"&&pair.result?.analysis?.match?<div className="result-score"><strong>{pair.result.analysis.match.score}%</strong><small>Evidence match</small></div>:<span className={pair.status==="failed"?"status-closed":"status-open"}>{pair.status==="failed"?(pair.result?.error||"Failed"):pair.status}</span>}
      {pair.status==="completed"&&pair.result?.analysis&&<div className="result-evidence"><p>{pair.result.analysis.match?.explanation}</p><strong>Evidence strengths</strong><ul>{(pair.result.analysis.strengths||[]).slice(0,4).map((v,i)=><li key={i}>{v}</li>)}</ul><strong>Gaps to clarify</strong><ul>{(pair.result.analysis.gaps||[]).slice(0,4).map((v,i)=><li key={i}>{v.item} — {v.status.replaceAll("_"," ")}</li>)}</ul></div>}
     </article>)}</div>}
   </article>)}</div>}
  </section>}
 </div>;
}
