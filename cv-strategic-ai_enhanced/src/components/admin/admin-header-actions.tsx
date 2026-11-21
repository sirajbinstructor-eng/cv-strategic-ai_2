"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AdminHeaderActions() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Unable to sign out.");
      router.replace("/");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <div className="header-actions">
      <Link href="/pricing" className="header-link">Upgrade</Link>
      <button type="button" className="button-quiet" onClick={signOut} disabled={signingOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
