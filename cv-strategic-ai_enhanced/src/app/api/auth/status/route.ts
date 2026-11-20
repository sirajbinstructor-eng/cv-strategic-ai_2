import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Render terminates TLS at its edge proxy. Inside the container, request.nextUrl
 * can therefore contain an internal host/scheme instead of the public URL.
 * Prefer the standard reverse-proxy headers when reconstructing the browser
 * origin, then fall back to the URL Next.js received.
 */
function getPublicRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const protocol = forwardedProto === "https" || forwardedProto === "http"
    ? forwardedProto
    : request.nextUrl.protocol.replace(/:$/, "");

  if (host) {
    try {
      return new URL(`${protocol}://${host}`).origin;
    } catch {
      // Ignore malformed proxy/host headers and use Next.js' parsed URL.
    }
  }

  return request.nextUrl.origin;
}

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

/** Safe diagnostic: reports configuration presence only, never credentials. */
export async function GET(request: NextRequest) {
  const configuredBase = process.env.BETTER_AUTH_URL || "";
  const requestOrigin = getPublicRequestOrigin(request);
  const configuredOrigin = normalizeOrigin(configuredBase);
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const microsoft = Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
  const baseUrlMatches = Boolean(configuredOrigin) && configuredOrigin === requestOrigin;

  let hint: string | null = null;
  if (!configuredBase) {
    hint = "Set BETTER_AUTH_URL to the exact public Render origin.";
  } else if (!baseUrlMatches) {
    hint = "BETTER_AUTH_URL does not match the public request origin reconstructed from proxy headers.";
  } else if (!google && !microsoft) {
    hint = "Configure at least one provider's client ID and secret in Render.";
  }

  return NextResponse.json(
    {
      providers: {
        google: { configured: google, callbackPath: "/api/auth/callback/google" },
        microsoft: { configured: microsoft, callbackPath: "/api/auth/callback/microsoft" }
      },
      baseUrl: {
        configured: Boolean(configuredBase),
        matchesCurrentOrigin: baseUrlMatches,
        requestOrigin
      },
      emailOtp: {
        configured: Boolean(process.env.GOOGLE_SCRIPT_URL && process.env.GOOGLE_SCRIPT_SECRET)
      },
      hint
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
