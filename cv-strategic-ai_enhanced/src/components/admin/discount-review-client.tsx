"use client";
import { useEffect, useState } from "react";
type Item={id:string;category:string;nationality:string;nationality_evidence_type:string|null;student_evidence_type:string|null;graduation_date:string|null;no_work_since_graduation:boolean|null;professional_experience_months:number|null;discount_percent:number;status:string;created_at:string;applicant_name:string;applicant_email:string;review_notes:string|null};
export function DiscountReviewClient(){
 const [items,setItems]=useState<Item[]>([]),[status,setStatus]=useState("pending"),[notes,setNotes]=useState<Record<string,string>>({}),[message,setMessage]=useState(""),[busy,setBusy]=useState("");
 async function load(){const r=await fetch("/api/admin/discount-applications?status="+status,{cache:"no-store"});const d=await r.json();if(r.ok)setItems(d.applications||[]);else setMessage(d.error||"Unable to load applications.");}
 useEffect(()=>{void load();},[status]);
 async function decide(id:string,decision:"approved"|"rejected"|"revoked"){setBusy(id);setMessage("");try{const r=await fetch("/api/admin/discount-applications/"+id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,reviewNotes:notes[id]||""})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Review failed.");setMessage("Decision saved.");await load();}catch(e){setMessage(e instanceof Error?e.message:"Review failed.");}finally{setBusy("");}}
 return <div className="workspace-card"><div className="form-row"><label>Application status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="revoked">Revoked</option><option value="expired">Expired</option></select></label></div>
 {items.length===0?<p className="muted">No applications in this status.</p>:items.map(x=><article key={x.id} className="workspace-card">
 <h2>{x.applicant_name} · {x.discount_percent}%</h2><p>{x.applicant_email}</p><p><strong>Category:</strong> {x.category} · <strong>Nationality:</strong> {x.nationality}</p>
 <p><strong>Nationality evidence declared:</strong> {x.nationality_evidence_type||"Not provided"} · <strong>Student evidence:</strong> {x.student_evidence_type||"Not provided"}</p>
 {x.graduation_date&&<p><strong>Graduation:</strong> {new Date(x.graduation_date).toLocaleDateString()} · <strong>No work since graduation:</strong> {x.no_work_since_graduation?"Yes":"No"}</p>}
 {x.professional_experience_months!==null&&<p><strong>Experience:</strong> {x.professional_experience_months} months</p>}
 <label>Review notes<textarea value={notes[x.id]??x.review_notes??""} onChange={e=>setNotes(v=>({...v,[x.id]:e.target.value}))} maxLength={1000}/></label>
 {x.status==="pending"&&<div className="header-actions"><button className="button-primary" disabled={busy===x.id} onClick={()=>decide(x.id,"approved")}>Approve</button><button className="button-quiet" disabled={busy===x.id} onClick={()=>decide(x.id,"rejected")}>Reject</button></div>}
 {x.status==="approved"&&<button className="button-quiet" disabled={busy===x.id} onClick={()=>decide(x.id,"revoked")}>Revoke approval</button>}
 </article>)}
 {message&&<p role="status">{message}</p>}
 <p className="muted">Approval is a manual administrative decision. Confirm supporting evidence through an authorized secure process before approving; evidence files are not collected by this application yet.</p>
 </div>;
}
