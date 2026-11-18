import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { getEntitlements } from "@/lib/entitlements/trials";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ authenticated: false }, { status: 401 });
  const entitlements = await getEntitlements(session.user.id);
  if (!entitlements) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({
    authenticated: true,
    user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image },
    entitlements: {
      ...entitlements,
      remaining: Number.isFinite(entitlements.remaining) ? entitlements.remaining : null
    }
  });
}
