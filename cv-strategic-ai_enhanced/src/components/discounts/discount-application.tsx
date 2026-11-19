"use client";
import { useState } from "react";

type Application = { id:string; category:string; nationality:string; discount_percent:number; status:string; created_at:string } | null;
export function DiscountApplication() {
  const [category,setCategory]=useState("student");
  const [nationality,setNationality]=useState("tunisian");
  const [evidence,setEvidence]=useState("cin");
  const [studentEvidence,setStudentEvidence]=useState("student_card");
  const [graduationDate,setGraduationDate]=useState("");
  const [noWork,setNoWork]=useState(false);
  const [experience,setExperience]=useState("0");
  const [accepted,setAccepted]=useState(false);
  const [application,setApplication]=useState<Application>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function load(){const r=await fetch("/api/discounts",{cache:"no-store"});if(r.ok){const d=await r.json();setApplication(d.application);}}
  useState(()=>{void load();});
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");try{
    const body:any={category,nationality,declarationAccepted:accepted};
    if(nationality==="tunisian")body.nationalityEvidenceType=evidence;
    if(category==="student")body.studentEvidenceType=studentEvidence;
    if(category==="recent_graduate"){body.graduationDate=graduationDate;body.noWorkSinceGraduation=noWork;}
    if(category==="early_career")body.professionalExperienceMonths=Number(experience);
    const r=await fetch("/api/discounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to submit application.");setApplication(d.application);setMessage("Application submitted. An administrator will review your eligibility.");
  }catch(err){setMessage(err instanceof Error?err.message:"Submission failed.");}finally{setBusy(false);}}
  return <section className="workspace-card"><h2>Discount eligibility</h2><p className="muted">Discounts are mutually exclusive. Students and recent graduates receive priority over the early-career discount. Verification is manual.</p>
    {application?<><p><strong>Status:</strong> {application.status}</p><p><strong>Requested category:</strong> {application.category.replace("_"," ")}</p><p><strong>Discount:</strong> {application.discount_percent}% (subject to manual approval)</p></>:<form onSubmit={submit} className="auth-form">
      <label>Eligibility category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="student">Current student</option><option value="recent_graduate">Recent graduate</option><option value="early_career">Professional experience under 2 years</option></select></label>
      <label>Nationality<select value={nationality} onChange={e=>setNationality(e.target.value)}><option value="tunisian">Tunisian</option><option value="non_tunisian">Non-Tunisian</option></select></label>
      {nationality==="tunisian"&&<label>Tunisian nationality evidence<select value={evidence} onChange={e=>setEvidence(e.target.value)}><option value="cin">CIN</option><option value="passport">Tunisian passport</option><option value="tunisian_driving_licence">Tunisian driving licence</option></select></label>}
      {category==="student"&&<label>Student evidence type<input value={studentEvidence} onChange={e=>setStudentEvidence(e.target.value)} required /></label>}
      {category==="recent_graduate"&&<><label>Graduation date<input type="date" value={graduationDate} onChange={e=>setGraduationDate(e.target.value)} required /></label><label className="checkbox-row"><input type="checkbox" checked={noWork} onChange={e=>setNoWork(e.target.checked)}/> I have not had any job or professional work since graduation (may extend eligibility to 24 months).</label></>}
      {category==="early_career"&&<label>Professional experience (months)<input type="number" min="0" max="23" value={experience} onChange={e=>setExperience(e.target.value)} required /></label>}
      <label className="checkbox-row"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/> I confirm that the information provided is accurate and agree to manual eligibility review.</label>
      <button className="button-primary" type="submit" disabled={busy||!accepted}>{busy?"Submitting…":"Submit discount application"}</button>
    </form>}
    {message&&<p role="status" className="muted">{message}</p>}
    <p className="muted">Do not upload or email identity documents through this form. The secure document-review channel and retention process must be established before collecting document images.</p>
  </section>;
}
