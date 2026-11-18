import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { AuthPanel } from "@/components/auth/auth-panel";

export const dynamic = "force-dynamic";
export default async function SignUpPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");
  return <main className="marketing-page"><div className="marketing-content"><div className="auth-wrap"><AuthPanel providers={{ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), microsoft: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) }} /></div></div></main>;
}
