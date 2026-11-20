import test from "node:test";
import assert from "node:assert/strict";
import {ADMIN_EMAILS,inviteSchema,listSchema,updateSchema} from "../src/lib/admin/model";

test("approved administrator allowlist contains only the two designated identities",()=>{assert.deepEqual(ADMIN_EMAILS,["siraj.b.instructor@gmail.com","cvstrategistai@gmail.com"]);});
test("invitation payload normalizes email casing",()=>{const parsed=inviteSchema.parse({name:"Admin User",email:"ADMIN@EXAMPLE.COM"});assert.equal(parsed.email,"admin@example.com");});
test("invitation payload rejects malformed email",()=>{assert.equal(inviteSchema.safeParse({name:"A",email:"not-an-email"}).success,false);});
test("user list defaults pagination and role",()=>{assert.deepEqual(listSchema.parse({}),{role:"all",limit:50,offset:0});});
test("user list rejects an excessive page size",()=>{assert.equal(listSchema.safeParse({limit:101}).success,false);});
test("user update rejects an empty payload",()=>{assert.equal(updateSchema.safeParse({}).success,false);});
test("user update accepts explicit entitlement changes",()=>{assert.equal(updateSchema.safeParse({isAdmin:true,isUnrestricted:false,analysisTrialsGranted:8}).success,true);});
test("user update accepts Job Seeker and Recruiter account types",()=>{assert.equal(updateSchema.safeParse({accountType:"job_seeker"}).success,true);assert.equal(updateSchema.safeParse({accountType:"recruiter"}).success,true);});
test("user update rejects unsupported account types",()=>{assert.equal(updateSchema.safeParse({accountType:"candidate"}).success,false);});
