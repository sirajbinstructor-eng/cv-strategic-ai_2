import { NextRequest, NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = toNextJsHandler(auth);

async function runAuthHandler(
  handler: (request: NextRequest) => Promise<Response>,
  request: NextRequest
): Promise<Response> {
  try {
    // Ensure the PostgreSQL auth tables exist before Better Auth queries them.
    await ensureAuthSchema();
    return await handler(request);
  } catch (error) {
    console.error("[auth-route] Authentication request failed:", error);
    return NextResponse.json(
      {
        message: "Authentication service is temporarily unavailable. Check the server logs for the underlying database or configuration error.",
        code: "AUTH_SERVICE_UNAVAILABLE"
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const GET = (request: NextRequest) => runAuthHandler(handlers.GET, request);
export const POST = (request: NextRequest) => runAuthHandler(handlers.POST, request);
