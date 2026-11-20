"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { TrialStatus } from "@/components/dashboard/trial-status";
import { AnalysisWorkspace } from "@/components/analysis/analysis-workspace";
import { AccountTypeOnboarding } from "@/components/dashboard/account-type-onboarding";

type AccountPayload = {
  authenticated: boolean;
  user: { id: string; name: string; email: string; image?: string | null; accountType: "job_seeker" | "recruiter" | null };
  entitlements: {
    isAdmin: boolean; isUnrestricted: boolean; consultantEntitled: boolean;
    granted: number; used: number; reserved: number; remaining: number | null; expired: boolean;
    unlimited: boolean; workspaceLocked: boolean; expiresAt: string;
    subscription?: { plan:string; interval:string; status:string; analyses:{limit:number;used:number;reserved:number;remaining:number}; generations:{limit:number;used:number;reserved:number;remaining:number}; periodEnd:string };
  };
};

export function DashboardShell() {
  const router = useRouter();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [adminWorkspaceSelected, setAdminWorkspaceSelected] = useState(false);
  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load your account.");
      return response.json() as Promise<AccountPayload>;
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  });

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  if (accountQuery.isLoading) return <main className="dashboard-loading"><div className="spinner" /><p>Loading your workspace…</p></main>;
  if ((!accountQuery.data && accountQuery.isError) || !accountQuery.data?.authenticated) return <main className="dashboard-loading"><p>We couldn't load your account. Please sign in again.</p><Link className="button-primary" href="/">Return to sign in</Link></main>;

  const { user, entitlements } = accountQuery.data;
  const mustChooseWorkspace = entitlements.isAdmin
    ? !adminWorkspaceSelected
    : !user.accountType;

  if (mustChooseWorkspace) {
    return (
      <main className="dashboard-page">
        <header className="dashboard-header">
          <Link className="brand" href="/dashboard"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>{entitlements.isAdmin ? "Administrator access" : "Workspace setup"}</small></span></Link>
          <div className="header-actions"><span className="user-chip">{user.name || user.email}</span><button className="button-quiet" onClick={signOut}>Sign out</button></div>
        </header>
        <div className="dashboard-main">
          <AccountTypeOnboarding
            isAdmin={entitlements.isAdmin}
            initialAccountType={user.accountType}
            onComplete={() => {
              setAdminWorkspaceSelected(true);
              router.refresh();
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="brand" href="/dashboard"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Intelligent career positioning</small></span></Link>
        <div className="header-actions">
          <span className="user-chip">{user.name || user.email}</span>
          {entitlements.isAdmin && <button className="button-quiet" onClick={() => setAdminWorkspaceSelected(false)}>Switch workspace</button>}
          {!entitlements.isAdmin && user.accountType === "job_seeker" && <Link href="/pricing" className="header-link">Plans & pricing</Link>}
          <Link href="/dashboard/discounts" className="header-link">Discount eligibility</Link>
          <Link href="/dashboard/settings" className="header-link">Account settings</Link>
          {entitlements.isAdmin && <Link href="/admin" className="header-link">Admin dashboard</Link>}
          <button className="button-quiet" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <div className="dashboard-main">
        <section className="dashboard-welcome">
          <div><p className="eyebrow">{user.accountType === "recruiter" ? "RECRUITER WORKSPACE" : "JOB SEEKER DASHBOARD"}</p><h1>Welcome{user.name ? `, ${user.name.split(" ")[0]}` : " back"}.</h1><p className="muted">Your CV strategy workspace and account overview.</p></div>
          <div className="dashboard-date">CV STRATEGIST AI <span>YOUR CAREER, BETTER POSITIONED</span></div>
        </section>
        {user.accountType === "recruiter" ? (
          <section className="workspace-card">
            <p className="eyebrow">COMPANY WORKSPACE</p><h2>Your recruiter workspace is ready.</h2>
            <p className="muted">Your company workspace is separate from candidate subscriptions. Recruiter evaluation credits, team seats and batch matching are managed separately.</p>
            <Link className="button-primary" href="/recruiter">Open recruiter workspace →</Link>
          </section>
        ) : (
          <>
            <TrialStatus entitlements={entitlements} onUpgrade={() => setShowUpgrade(true)} />
            <div className="dashboard-summary-grid">
              <article className="summary-tile"><span>ANALYSES USED</span><strong>{entitlements.unlimited ? "∞" : `${entitlements.used} / ${entitlements.granted}`}</strong><small>{entitlements.subscription ? `${(entitlements.subscription.plan === "consultant" ? "GOLD" : entitlements.subscription.plan.toUpperCase())} plan` : entitlements.unlimited ? "Unrestricted account" : "Free launch offer"}</small></article>
              <article className="summary-tile"><span>ANALYSES REMAINING</span><strong>{entitlements.unlimited ? "∞" : entitlements.expired ? "0" : entitlements.remaining}</strong><small>{entitlements.subscription ? `Resets ${new Date(entitlements.subscription.periodEnd).toLocaleDateString()}` : entitlements.unlimited ? "No trial restriction" : "Until 31 Dec 2026"}</small></article>
              <article className="summary-tile"><span>CONSULTING MODE</span><strong>{entitlements.consultantEntitled ? "Available" : "Locked"}</strong><small>{entitlements.consultantEntitled ? "Included with Gold or administrator access" : "Gold access required"}</small></article>
            </div>
            <AnalysisWorkspace entitlements={entitlements} onUpgrade={() => setShowUpgrade(true)} />
          </>
        )}
        {showUpgrade && <div className="modal-backdrop" role="presentation" onClick={() => setShowUpgrade(false)}><section className="upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="upgrade-title" onClick={event => event.stopPropagation()}><button className="modal-close" type="button" onClick={() => setShowUpgrade(false)} aria-label="Close">×</button><p className="eyebrow">UNLOCK YOUR NEXT STEP</p><h2 id="upgrade-title">Upgrade your CV strategy.</h2><p>Compare the Pro and Gold plans and choose the level that fits your goals. Online subscription checkout is not available yet; we will enable purchases once payment-provider onboarding and verification are complete. Your current access and trial balance are not affected.</p><Link className="button-primary full-width" href="/pricing">View plans and pricing</Link><button className="button-quiet full-width" type="button" onClick={() => setShowUpgrade(false)}>Close</button></section></div>}
        <footer className="dashboard-footer"><span>CV Strategist AI</span><span>Evidence-based. ATS-friendly. Candidate-controlled.</span></footer>
      </div>
    </main>
  );
}
