import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { AuthPanel } from "@/components/auth/auth-panel";

export const dynamic = "force-dynamic";
export default async function SignInPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect((session.user as typeof session.user & { isAdmin?: boolean }).isAdmin ? "/admin" : "/dashboard");
  return <main className="marketing-page"><div className="marketing-content"><div className="auth-wrap"><AuthPanel initialMode="signin" providers={{ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), microsoft: false }} /></div></div></main>;
}
