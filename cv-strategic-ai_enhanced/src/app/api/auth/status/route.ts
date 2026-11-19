import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export const runtime="nodejs";
/** Safe diagnostic: reports configuration presence only, never credentials. */
export async function GET(request:NextRequest){
 const configuredBase=process.env.BETTER_AUTH_URL||"";
 const requestOrigin=request.nextUrl.origin;
 const normalized=(value:string)=>{try{return new URL(value).origin;}catch{return "";}};
 const google=Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
 const microsoft=Boolean(process.env.MICROSOFT_CLIENT_ID&&process.env.MICROSOFT_CLIENT_SECRET);
 return NextResponse.json({
  providers:{google:{configured:google,callbackPath:"/api/auth/callback/google"},microsoft:{configured:microsoft,callbackPath:"/api/auth/callback/microsoft"}},
  baseUrl:{configured:Boolean(configuredBase),matchesCurrentOrigin:normalized(configuredBase)===requestOrigin},
  emailOtp:{configured:Boolean(process.env.GOOGLE_SCRIPT_URL&&process.env.GOOGLE_SCRIPT_SECRET)},
  hint:!configuredBase?"Set BETTER_AUTH_URL to the exact public Render origin.":normalized(configuredBase)!==requestOrigin?"BETTER_AUTH_URL does not match the domain serving this request.":!google&&!microsoft?"Configure at least one provider's client ID and secret in Render.":null
 },{headers:{"Cache-Control":"no-store"}});
}
