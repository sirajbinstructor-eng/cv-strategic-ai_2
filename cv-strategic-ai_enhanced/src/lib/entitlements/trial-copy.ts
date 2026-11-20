export type TrialOfferCopy = {
  title: string;
  body: string;
  tone: "success" | "info" | "warning" | "locked";
};

export type TrialOfferState = {
  granted: number;
  used: number;
  reserved: number;
  expired: boolean;
};

const OFFER_END = "31 December 2026";
const EXHAUSTED_BODY =
  "Your free launch offer has ended. But your CV improvement journey doesn't have to stop here. Upgrade now to unlock more AI-powered CV analyses, access advanced features and get the most out of CV Strategist AI. Your dashboard and account settings remain accessible.";

/** Derive every launch-offer message from the live entitlement counters. */
export function getTrialOfferCopy(state: TrialOfferState): TrialOfferCopy {
  const granted = Math.max(0, Math.floor(Number(state.granted) || 0));
  const used = Math.max(0, Math.floor(Number(state.used) || 0));
  const reserved = Math.max(0, Math.floor(Number(state.reserved) || 0));
  const remaining = Math.max(0, granted - used - reserved);

  if (state.expired) {
    return {
      title: "Your free launch offer has ended.",
      body: `The offer expired on ${OFFER_END}. Upgrade to continue using CV Strategist AI.`,
      tone: "warning"
    };
  }

  if (granted === 0) {
    return {
      title: "No free analyses have been assigned.",
      body: "Your account currently has no free analysis trials available. Please contact your administrator or view the available plans.",
      tone: "locked"
    };
  }

  if (remaining === 0 && reserved > 0 && used < granted) {
    return {
      title: "Your remaining free analyses are being processed.",
      body: `${used} of ${granted} free analyses have been completed and ${reserved} ${reserved === 1 ? "analysis is" : "analyses are"} currently in progress. Your available trial count will refresh when processing finishes.`,
      tone: "warning"
    };
  }

  if (remaining === 0) {
    return {
      title: `You've used all ${granted} free ${granted === 1 ? "analysis" : "analyses"}!`,
      body: EXHAUSTED_BODY,
      tone: "locked"
    };
  }

  const progress = `${used} of ${granted} free analyses used.`;
  const reservationNote = reserved > 0
    ? ` ${reserved} ${reserved === 1 ? "analysis is" : "analyses are"} currently in progress.`
    : "";
  const expiryNote = ` Your free trials are available until ${OFFER_END}.`;

  if (remaining === 1) {
    return {
      title: "Just 1 free analysis left!",
      body: `${progress}${reservationNote} Make the most of your final free trial.${expiryNote}`,
      tone: "warning"
    };
  }

  if (used === 0 && reserved === 0) {
    return {
      title: `Welcome! You have ${remaining} free AI analyses.`,
      body: `Explore CV Strategist AI in Analysis mode. You have ${remaining} free analyses available.${expiryNote}`,
      tone: "success"
    };
  }

  return {
    title: `You have ${remaining} free AI analyses remaining!`,
    body: `${progress}${reservationNote} Keep improving your CV with your remaining free analyses.${expiryNote}`,
    tone: "info"
  };
}
