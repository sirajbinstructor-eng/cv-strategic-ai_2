import { NextRequest,NextResponse } from "next/server";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Context={params:Promise<{provider:string}>};
/** Fail closed until a provider-specific signature verifier and merchant account are configured. */
export async function POST(_request:NextRequest,context:Context){const {provider}=await context.params;if(!["paddle","konnect","paymaster"].includes(provider))return NextResponse.json({error:"Unsupported payment provider."},{status:404});return NextResponse.json({error:"Payment webhooks are not enabled for this provider. No subscription entitlements have been changed."},{status:503,headers:{"Cache-Control":"no-store"}});}
