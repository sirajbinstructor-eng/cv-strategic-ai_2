import { BillingRepository } from "./repository";
import { PLAN_CATALOG,PLAN_QUOTAS,discountedAmount,type BillingPlan,type BillingInterval,type BillingCurrency } from "./catalog";
import type { CheckoutRequest } from "./model";
const repo=new BillingRepository();
export class BillingService {
 async quote(userId:string,input:CheckoutRequest){
  const current=await repo.current(userId);
  if(current&&["pending","active","past_due","canceled_at_period_end"].includes(current.status))throw Object.assign(Error("You already have a pending or active subscription. Manage that subscription before starting another."),{status:409});
  const price=PLAN_CATALOG[input.plan][input.interval][input.currency];
  const discount=await import("@/lib/discounts/repository").then(async m=>new m.DiscountRepository().getCurrent(userId));
  const percent=discount?.status==="approved"?Number(discount.discount_percent):0;
  const amount=discountedAmount(price.amountMinor,percent);
  return {subscription:null,price:{...price,discountPercent:percent,amountMinor:amount},quotas:PLAN_QUOTAS[input.plan][input.interval],paymentProviderStatus:"not_configured"};
 }
 async current(userId:string){return repo.current(userId);}
}
export { repo as billingRepository };
