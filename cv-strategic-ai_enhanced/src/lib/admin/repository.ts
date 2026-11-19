import {randomUUID} from "node:crypto";
import {pool} from "@/lib/db";
import type {UpdateInput} from "./model";
const cols="id,name,email,email_verified,created_at,updated_at,is_admin,is_unrestricted,consultant_entitled,analysis_trials_granted,analysis_trials_used,analysis_trials_reserved,analysis_trial_expires_at";
export class AdminUserRepository {
 async list(x:{q?:string;role:string;limit:number;offset:number}) {
  const vals:unknown[]=[];const where:string[]=[];
  if(x.q){vals.push("%"+x.q+"%");where.push("(name ILIKE $1 OR email ILIKE $1)");}
  if(x.role==="admin")where.push("is_admin=true");if(x.role==="user")where.push("is_admin=false");
  const clause=where.length?"WHERE "+where.join(" AND "):"";
  const count=await pool.query('SELECT COUNT(*)::int AS total FROM "user" '+clause,vals);
  const rows=await pool.query('SELECT '+cols+' FROM "user" '+clause+' ORDER BY created_at DESC LIMIT $'+(vals.length+1)+' OFFSET $'+(vals.length+2),[...vals,x.limit,x.offset]);
  return {users:rows.rows,total:Number(count.rows[0]?.total||0)};
 }
 async get(id:string){const r=await pool.query('SELECT '+cols+' FROM "user" WHERE id=$1',[id]);return r.rows[0]||null;}
 async byEmail(email:string){const r=await pool.query('SELECT '+cols+' FROM "user" WHERE lower(email)=lower($1)',[email]);return r.rows[0]||null;}
 async update(id:string,x:UpdateInput){
  const map:Record<string,string>={name:"name",email:"email",emailVerified:"email_verified",isAdmin:"is_admin",isUnrestricted:"is_unrestricted",consultantEntitled:"consultant_entitled",analysisTrialsGranted:"analysis_trials_granted"};
  const entries=Object.entries(x).filter(([key])=>map[key]);if(!entries.length)return this.get(id);
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   if(x.isAdmin===false){
    await client.query('LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE');
    const current=await client.query('SELECT is_admin FROM "user" WHERE id=$1 FOR UPDATE',[id]);
    if(!current.rowCount){await client.query("ROLLBACK");return null;}
    if(current.rows[0].is_admin){const admins=await client.query('SELECT COUNT(*)::int AS total FROM "user" WHERE is_admin=true');if(admins.rows[0].total<=1){await client.query("ROLLBACK");throw Object.assign(Error("Cannot demote the last administrator."),{status:409});}}
   }
   const vals:unknown[]=[];const sets=entries.map(([key,value])=>{vals.push(value);return '"'+map[key]+'"=$'+vals.length;});vals.push(id);
   const result=await client.query('UPDATE "user" SET '+sets.join(",")+',updated_at=NOW() WHERE id=$'+vals.length+' RETURNING '+cols,vals);
   await client.query("COMMIT");return result.rows[0]||null;
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}finally{client.release();}
 }
 async remove(id:string,actor:string){
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   await client.query('LOCK TABLE "user" IN SHARE ROW EXCLUSIVE MODE');
   const target=await client.query('SELECT email,is_admin FROM "user" WHERE id=$1 FOR UPDATE',[id]);
   if(!target.rowCount){await client.query("ROLLBACK");return "NOT_FOUND";}
   if(id===actor){await client.query("ROLLBACK");return "SELF_DELETE";}
   if(["siraj.b.instructor@gmail.com","cvstrategistai@gmail.com"].includes(String(target.rows[0].email).toLowerCase())){await client.query("ROLLBACK");return "PROTECTED";}
   if(target.rows[0].is_admin){const admins=await client.query('SELECT COUNT(*)::int AS total FROM "user" WHERE is_admin=true');if(admins.rows[0].total<=1){await client.query("ROLLBACK");return "LAST_ADMIN";}}
   await client.query('DELETE FROM "user" WHERE id=$1',[id]);await client.query("COMMIT");return "DELETED";
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}finally{client.release();}
 }
}