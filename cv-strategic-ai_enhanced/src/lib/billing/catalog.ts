export type BillingCurrency = "USD" | "EUR" | "TND";
export type BillingInterval = "monthly" | "annual";
export type BillingPlan = "pro" | "consultant";
export const PLAN_DISPLAY_NAMES: Record<BillingPlan,string> = { pro: "Pro", consultant: "Gold" };
export type FeatureQuota = { analyses: number; generations: number };
export type Price = { amountMinor: number; currency: BillingCurrency; exponent: 2 | 3 };
export const PLAN_CATALOG: Record<BillingPlan, Record<BillingInterval, Record<BillingCurrency, Price>>> = {
 pro: {
  monthly: { USD:{amountMinor:1800,currency:"USD",exponent:2}, EUR:{amountMinor:1700,currency:"EUR",exponent:2}, TND:{amountMinor:60000,currency:"TND",exponent:3} },
  annual: { USD:{amountMinor:17900,currency:"USD",exponent:2}, EUR:{amountMinor:17000,currency:"EUR",exponent:2}, TND:{amountMinor:595000,currency:"TND",exponent:3} }
 },
 consultant: {
  monthly: { USD:{amountMinor:4500,currency:"USD",exponent:2}, EUR:{amountMinor:4300,currency:"EUR",exponent:2}, TND:{amountMinor:150000,currency:"TND",exponent:3} },
  annual: { USD:{amountMinor:44900,currency:"USD",exponent:2}, EUR:{amountMinor:42700,currency:"EUR",exponent:2}, TND:{amountMinor:1493000,currency:"TND",exponent:3} }
 }
};
export const PLAN_QUOTAS: Record<BillingPlan, Record<BillingInterval, FeatureQuota>> = {
 pro:{monthly:{analyses:20,generations:20},annual:{analyses:300,generations:250}},
 consultant:{monthly:{analyses:100,generations:100},annual:{analyses:1300,generations:1300}}
};
export function getPrice(plan:BillingPlan,interval:BillingInterval,currency:BillingCurrency){return PLAN_CATALOG[plan][interval][currency];}
export function discountedAmount(amountMinor:number,percent:number){if(!Number.isInteger(percent)||percent<0||percent>100)throw new Error("Invalid discount percentage.");return Math.round(amountMinor*(100-percent)/100);}
export function formatPrice(price:Price){return new Intl.NumberFormat("en",{style:"currency",currency:price.currency,minimumFractionDigits:price.exponent,maximumFractionDigits:price.exponent}).format(price.amountMinor/10**price.exponent);}
