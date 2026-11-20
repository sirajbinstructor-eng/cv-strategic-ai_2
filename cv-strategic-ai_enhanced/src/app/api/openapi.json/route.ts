import {NextResponse} from "next/server";
export const dynamic="force-static";
const spec={
 openapi:"3.1.0",info:{title:"CV Strategist AI Admin API",version:"1.1.0",description:"Administrator-only account management. All endpoints require a signed-in administrator session cookie."},
 servers:[{url:"/"}],
 components:{securitySchemes:{betterAuthCookie:{type:"apiKey",in:"cookie",name:"better-auth.session_token",description:"Use the session cookie issued by Better Auth after signing in. Production may use a __Secure- prefixed cookie."}}},
 security:[{betterAuthCookie:[]}],
 paths:{
  "/api/admin/users":{
   get:{summary:"List and search users",parameters:[{name:"q",in:"query",schema:{type:"string"}},{name:"role",in:"query",schema:{type:"string",enum:["all","admin","user"],default:"all"}},{name:"limit",in:"query",schema:{type:"integer",minimum:1,maximum:100,default:50}},{name:"offset",in:"query",schema:{type:"integer",minimum:0,default:0}}],responses:{"200":{description:"Paginated user list"},"401":{description:"Authentication required"},"403":{description:"Administrator required"}}},
   post:{summary:"Invite a user",description:"Sends a sign-in OTP to the supplied email. The response contains an inviteUrl to share with the recipient. The recipient enters the emailed OTP at /invite; the account is created only after successful verification. OTP expires after 300 seconds.",requestBody:{required:true,content:{"application/json":{schema:{type:"object",required:["name","email"],properties:{name:{type:"string",minLength:1,maxLength:120},email:{type:"string",format:"email"}}}}}},responses:{"202":{description:"OTP sent; invitation URL returned"},"400":{description:"Invalid payload"},"409":{description:"Account already exists"}}}
  },
  "/api/admin/users/{id}":{
   parameters:[{name:"id",in:"path",required:true,schema:{type:"string",format:"uuid"}}],
   get:{summary:"Get user details",responses:{"200":{description:"User details"},"404":{description:"Not found"}}},
   patch:{summary:"Update user profile and entitlements",requestBody:{required:true,content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"},email:{type:"string",format:"email"},emailVerified:{type:"boolean"},isAdmin:{type:"boolean"},isUnrestricted:{type:"boolean"},consultantEntitled:{type:"boolean"},analysisTrialsGranted:{type:"integer",minimum:0,maximum:10000}}}}}},responses:{"200":{description:"Updated user"},"400":{description:"Invalid payload"},"409":{description:"Protected operation"}}},
   delete:{summary:"Delete user and cascading account data",responses:{"204":{description:"Deleted"},"404":{description:"Not found"},"409":{description:"Self-delete, reserved identity or last administrator"}}}
  },
  "/api/admin/recruiter-workspaces/{id}/credits":{
   parameters:[{name:"id",in:"path",required:true,schema:{type:"string"}}],
   post:{summary:"Grant recruiter workspace evaluation credits",description:"Administrator-only audited adjustment. Use this for support/testing; production credits should be granted by verified billing events.",requestBody:{required:true,content:{"application/json":{schema:{type:"object",required:["amount","reason"],properties:{amount:{type:"integer",minimum:1,maximum:100000},bucket:{type:"string",enum:["included","purchased"],default:"included"},reason:{type:"string",minLength:5,maxLength:300},idempotencyKey:{type:"string"}}}}}},responses:{"201":{description:"Credit adjustment applied"},"400":{description:"Invalid request"},"403":{description:"Administrator required"},"404":{description:"Workspace not found"},"409":{description:"Idempotency conflict"}}}
  }
 }
};
export async function GET(){return NextResponse.json(spec,{headers:{"Cache-Control":"public,max-age=300"}});}
