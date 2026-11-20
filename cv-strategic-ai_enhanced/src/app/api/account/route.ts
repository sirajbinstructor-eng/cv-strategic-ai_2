import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { getEntitlements } from "@/lib/entitlements/trials";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ authenticated: false }, { status: 401 });
  await ensureAuthSchema();
  const profile = await (await import("@/lib/db")).pool.query('SELECT account_type FROM "user" WHERE id=$1',[session.user.id]);\n  const entitlements = await getEntitlements(session.user.id);
  if (!entitlements) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  return NextResponse.json({
    authenticated: true,
    user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image, accountType: profile.rows[0]?.account_type ?? null },
    entitlements: {
      ...entitlements,
      remaining: Number.isFinite(entitlements.remaining) ? entitlements.remaining : null
    }
  });
}
