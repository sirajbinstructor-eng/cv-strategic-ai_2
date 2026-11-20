"use client";

import { getTrialOfferCopy } from "@/lib/entitlements/trial-copy";

type Entitlements = {
  isAdmin: boolean; isUnrestricted: boolean; consultantEntitled: boolean;
  granted: number; used: number; reserved: number; remaining: number | null; expired: boolean;
  unlimited: boolean; workspaceLocked: boolean; expiresAt: string;
  subscription?: { plan:string; interval:string; status:string; analyses:{limit:number;used:number;reserved:number;remaining:number}; generations:{limit:number;used:number;reserved:number;remaining:number}; periodEnd:string };
};

export function TrialStatus({ entitlements, onUpgrade }: { entitlements: Entitlements; onUpgrade: () => void }) {
  const content = entitlements.subscription
    ? {
        title: `${entitlements.subscription.plan === "pro" ? "Pro" : "Gold"} subscription active`,
        body: `${entitlements.subscription.analyses.remaining} analyses and ${entitlements.subscription.generations.remaining} CV generations remain in this billing period. Your quotas renew on ${new Date(entitlements.subscription.periodEnd).toLocaleDateString()}.`,
        tone: "success"
      }
    : entitlements.unlimited
      ? { title: "Unrestricted access", body: "Your account is exempt from the free-trial limit.", tone: "success" }
      : getTrialOfferCopy({
          granted: entitlements.granted,
          used: entitlements.used,
          reserved: entitlements.reserved,
          expired: entitlements.expired
        });

  const canUpgrade = !entitlements.unlimited
    && !entitlements.subscription
    && (entitlements.expired || (entitlements.workspaceLocked && entitlements.reserved === 0));

  return (
    <section className={`trial-status tone-${content.tone}`} aria-live="polite">
      <div className="trial-copy"><span className="trial-kicker">{entitlements.subscription ? "YOUR SUBSCRIPTION" : entitlements.unlimited ? "ACCOUNT ACCESS" : "YOUR LAUNCH OFFER"}</span><h2>{content.title}</h2><p>{content.body}</p></div>
      <div className="trial-action">
        {!entitlements.unlimited && !entitlements.subscription && !entitlements.expired && <span className="trial-count">{entitlements.remaining ?? 0} of {entitlements.granted} left</span>}
        {canUpgrade && <button className="button-primary" type="button" onClick={onUpgrade}>Upgrade now for more! <span aria-hidden="true">→</span></button>}
        {entitlements.subscription && <span className="access-pill">{entitlements.subscription.plan === "consultant" ? "GOLD" : "PRO"}</span>}
        {entitlements.unlimited && <span className="access-pill">Unlimited</span>}
      </div>
    </section>
  );
}
