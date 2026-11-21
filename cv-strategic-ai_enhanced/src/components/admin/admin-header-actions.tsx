"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AdminHeaderActions() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Unable to sign out.");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div className="admin-header-actions">
      {pathname !== "/admin" && (
        <Link href="/admin" className="admin-workspace-link">Admin home</Link>
      )}
      <button type="button" className="button-quiet" onClick={signOut} disabled={signingOut}>
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}
