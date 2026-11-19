"use client";

type Entitlements = {
  isAdmin: boolean; isUnrestricted: boolean; consultantEntitled: boolean;
  granted: number; used: number; remaining: number | null; expired: boolean;
  unlimited: boolean; workspaceLocked: boolean; expiresAt: string;
  subscription?: { plan:string; interval:string; status:string; analyses:{limit:number;used:number;reserved:number;remaining:number}; generations:{limit:number;used:number;reserved:number;remaining:number}; periodEnd:string };
};

export function TrialStatus({ entitlements, onUpgrade }: { entitlements: Entitlements; onUpgrade: () => void }) {
  const content = (() => {
    if (entitlements.subscription) return { title: `${entitlements.subscription.plan === "pro" ? "Pro" : "Consultant"} subscription active`, body: `${entitlements.subscription.analyses.remaining} analyses and ${entitlements.subscription.generations.remaining} CV generations remain in this billing period. Your quotas renew on ${new Date(entitlements.subscription.periodEnd).toLocaleDateString()}.`, tone: "success" };
    if (entitlements.unlimited) return { title: "Unrestricted access", body: "Your account is exempt from the free-trial limit.", tone: "success" };
    if (entitlements.expired) return { title: "Your free launch offer has ended.", body: "The offer expired on 31 December 2026. Upgrade to continue using CV Strategist AI.", tone: "warning" };
    if (entitlements.used >= 3) return {
      title: "You've used all 3 free analyses!",
      body: "Your free launch offer has ended. But your CV improvement journey doesn't have to stop here. Upgrade now to unlock more AI-powered CV analyses, access advanced features and get the most out of CV Strategist AI. Your dashboard and account settings remain accessible.",
      tone: "locked"
    };
    if (entitlements.used === 2) return { title: "Just 1 free analysis left!", body: "Make the most of your final free trial before 31 December 2026.", tone: "warning" };
    if (entitlements.used === 1) return { title: "You have 2 free analyses remaining!", body: "Keep improving your CV. Use your remaining free analyses before 31 December 2026.", tone: "info" };
    return { title: "Welcome! You have 3 free AI analyses.", body: "Explore CV Strategist AI in Analysis mode. Your free trials are available until 31 December 2026.", tone: "success" };
  })();

  return (
    <section className={`trial-status tone-${content.tone}`} aria-live="polite">
      <div className="trial-copy"><span className="trial-kicker">{entitlements.subscription ? "YOUR SUBSCRIPTION" : entitlements.unlimited ? "ACCOUNT ACCESS" : "YOUR LAUNCH OFFER"}</span><h2>{content.title}</h2><p>{content.body}</p></div>
      <div className="trial-action">
        {!entitlements.unlimited && !entitlements.subscription && !entitlements.workspaceLocked && <span className="trial-count">{entitlements.remaining} of {entitlements.granted} left</span>}
        {entitlements.workspaceLocked && !entitlements.unlimited && <button className="button-primary" type="button" onClick={onUpgrade}>Upgrade now for more! <span aria-hidden="true">→</span></button>}
        {entitlements.subscription && <span className="access-pill">{entitlements.subscription.plan.toUpperCase()}</span>}
        {entitlements.unlimited && <span className="access-pill">Unlimited</span>}
      </div>
    </section>
  );
}
