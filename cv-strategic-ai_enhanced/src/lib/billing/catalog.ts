export type BillingPlan = "pro" | "consultant";
export type BillingInterval = "monthly" | "annual";
export type BillingCurrency = "USD" | "EUR" | "TND";
export type PlanPrice = { amountMinor:number; currencyScale:number; analyses:number; generations:number; label:string };
export const BILLING_CATALOG: Record<BillingPlan,Record<BillingInterval,Record<BillingCurrency,PlanPrice>>> = {
 pro:{
  monthly:{
   USD:{amountMinor:1800,currencyScale:2,analyses:20,generations:20,label:"$18"},
   EUR:{amountMinor:1700,currencyScale:2,analyses:20,generations:20,label:"€17"},
   TND:{amountMinor:60000,currencyScale:3,analyses:20,generations:20,label:"60 TND"}
  },
  annual:{
   USD:{amountMinor:17900,currencyScale:2,analyses:300,generations:250,label:"$179"},
   EUR:{amountMinor:17000,currencyScale:2,analyses:300,generations:250,label:"€170"},
   TND:{amountMinor:595000,currencyScale:3,analyses:300,generations:250,label:"595 TND"}
  }
 },
 consultant:{
  monthly:{
   USD:{amountMinor:4500,currencyScale:2,analyses:100,generations:100,label:"$45"},
   EUR:{amountMinor:4300,currencyScale:2,analyses:100,generations:100,label:"€43"},
   TND:{amountMinor:150000,currencyScale:3,analyses:100,generations:100,label:"150 TND"}
  },
  annual:{
   USD:{amountMinor:44900,currencyScale:2,analyses:1300,generations:1300,label:"$449"},
   EUR:{amountMinor:42700,currencyScale:2,analyses:1300,generations:1300,label:"€427"},
   TND:{amountMinor:1493000,currencyScale:3,analyses:1300,generations:1300,label:"1,493 TND"}
  }
 }
};
export function getPlanPrice(plan:BillingPlan,interval:BillingInterval,currency:BillingCurrency){return BILLING_CATALOG[plan][interval][currency];}
export function discountedAmount(amountMinor:number,discountPercent:number){if(!Number.isInteger(amountMinor)||amountMinor<0)throw new Error("Invalid amount.");if(![0,10,20,40].includes(discountPercent))throw new Error("Invalid discount.");return Math.round(amountMinor*(100-discountPercent)/100);}
export function formatMinor(amountMinor:number,currency:BillingCurrency,scale:number){return new Intl.NumberFormat("en",{style:"currency",currency,minimumFractionDigits:scale,maximumFractionDigits:scale}).format(amountMinor/10**scale);}
