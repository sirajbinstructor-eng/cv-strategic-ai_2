import { pool } from "@/lib/db";
import { getPlanPrice,discountedAmount,formatMinor,type BillingPlan,type BillingInterval,type BillingCurrency } from "./catalog";
export type BillingQuote={plan:BillingPlan;interval:BillingInterval;currency:BillingCurrency;listAmountMinor:number;discountPercent:number;payableAmountMinor:number;currencyScale:number;formattedListPrice:string;formattedPayablePrice:string;analyses:number;generations:number;discountApplicationId:string|null};
export async function createBillingQuote(userId:string,plan:BillingPlan,interval:BillingInterval,currency:BillingCurrency):Promise<BillingQuote>{
 const price=getPlanPrice(plan,interval,currency);
 const result=await pool.query(`SELECT id,discount_percent FROM discount_applications WHERE user_id=$1 AND status='approved' ORDER BY reviewed_at DESC NULLS LAST LIMIT 1`,[userId]);
 const app=result.rows[0]||null;const percent=app?Number(app.discount_percent):0;
 const payable=discountedAmount(price.amountMinor,percent);
 return {plan,interval,currency,listAmountMinor:price.amountMinor,discountPercent:percent,payableAmountMinor:payable,currencyScale:price.currencyScale,formattedListPrice:formatMinor(price.amountMinor,currency,price.currencyScale),formattedPayablePrice:formatMinor(payable,currency,price.currencyScale),analyses:price.analyses,generations:price.generations,discountApplicationId:app?.id||null};
}
