import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    const error = new Error("Please sign in to continue.");
    Object.assign(error, { status: 401 });
    throw error;
  }
  return session.user;
}
