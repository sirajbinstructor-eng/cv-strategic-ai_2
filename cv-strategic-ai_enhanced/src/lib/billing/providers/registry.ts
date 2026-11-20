import { PAYMENT_PROVIDER_IDS, type PaymentProviderId, type PaymentProviderReadiness, type PaymentPurpose, type BillingProduct } from "./types";
const PROVIDER_METADATA: Record<PaymentProviderId, {name:string;purposes:PaymentPurpose[];products:BillingProduct[];requiredEnvironment:string[];approvalEnvironment:string}> = {
  paddle: {name:"Paddle",purposes:["subscription"],products:["candidate"],requiredEnvironment:["PADDLE_API_KEY","PADDLE_WEBHOOK_SECRET","NEXT_PUBLIC_PADDLE_CLIENT_TOKEN","PADDLE_PRICE_PRO_MONTHLY_USD","PADDLE_PRICE_PRO_ANNUAL_USD","PADDLE_PRICE_PRO_MONTHLY_EUR","PADDLE_PRICE_PRO_ANNUAL_EUR","PADDLE_PRICE_CONSULTANT_MONTHLY_USD","PADDLE_PRICE_CONSULTANT_ANNUAL_USD","PADDLE_PRICE_CONSULTANT_MONTHLY_EUR","PADDLE_PRICE_CONSULTANT_ANNUAL_EUR","PADDLE_DISCOUNT_10_ID","PADDLE_DISCOUNT_20_ID","PADDLE_DISCOUNT_40_ID"],approvalEnvironment:"BILLING_PADDLE_MERCHANT_APPROVED"},
  flouci: {name:"Flouci",purposes:["subscription","one_time"],products:["candidate","recruiter"],requiredEnvironment:["FLOUCI_APP_TOKEN","FLOUCI_APP_SECRET","FLOUCI_WEBHOOK_SECRET"],approvalEnvironment:"BILLING_FLOUCI_MERCHANT_APPROVED"},
  konnect: {name:"Konnect",purposes:["one_time"],products:["candidate","recruiter"],requiredEnvironment:["KONNECT_API_KEY","KONNECT_WEBHOOK_SECRET"],approvalEnvironment:"BILLING_KONNECT_MERCHANT_APPROVED"},
  ipay: {name:"iPay",purposes:["subscription","one_time"],products:["candidate","recruiter"],requiredEnvironment:["IPAY_API_KEY","IPAY_WEBHOOK_SECRET"],approvalEnvironment:"BILLING_IPAY_MERCHANT_APPROVED"},
  paymee: {name:"Paymee",purposes:["one_time"],products:["candidate","recruiter"],requiredEnvironment:["PAYMEE_API_KEY","PAYMEE_WEBHOOK_SECRET"],approvalEnvironment:"BILLING_PAYMEE_MERCHANT_APPROVED"},
  stripe: {name:"Stripe",purposes:["subscription","one_time"],products:["candidate","recruiter"],requiredEnvironment:["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"],approvalEnvironment:"BILLING_STRIPE_MERCHANT_APPROVED"}
};
const IMPLEMENTED_ADAPTERS = new Set<PaymentProviderId>(["paddle"]);
export function getPaymentProviderReadiness(): PaymentProviderReadiness[] {
  return PAYMENT_PROVIDER_IDS.map((id) => {
    const m=PROVIDER_METADATA[id], reasons:string[]=[];
    const enabled=process.env[`BILLING_PROVIDER_${id.toUpperCase()}_ENABLED`]==="true";
    const paddleEnvironment=process.env.PADDLE_ENVIRONMENT==="live"?"live":"sandbox";
    const approved=process.env[m.approvalEnvironment]==="true";
    const missing=m.requiredEnvironment.filter((key)=>!process.env[key]);
    let status:PaymentProviderReadiness["status"];
    if(!enabled){status="disabled";reasons.push("Provider is disabled by default. Explicit enablement is required.");}
    else if(missing.length){status="credentials_missing";reasons.push("Required provider credentials are not completely configured.");}
    else if(!IMPLEMENTED_ADAPTERS.has(id)){status="adapter_not_implemented";reasons.push("The provider adapter has not been implemented and verified.");}
    else if(id==="paddle"&&paddleEnvironment==="sandbox"){status="sandbox_testing";reasons.push("Paddle sandbox checkout is available only for controlled integration tests; customer live checkout is not enabled.");}
    else if(id==="paddle"&&paddleEnvironment==="live"&&!approved){status="merchant_approval_required";reasons.push("Paddle live merchant onboarding must be approved before live checkout.");}
    else if(id==="paddle"&&paddleEnvironment==="live"&&process.env.BILLING_PADDLE_SANDBOX_VERIFIED!=="true"){status="sandbox_verification_required";reasons.push("Complete Paddle sandbox checkout and webhook verification before live checkout.");}
    else {status="ready";}
    return {id,name:m.name,checkoutAvailable:status==="ready",status,supportedPurposes:m.purposes,products:m.products,reasons};
  });
}
export function getPaymentProviderReadinessById(id:PaymentProviderId){return getPaymentProviderReadiness().find((p)=>p.id===id)!;}
export function isPaymentProviderId(value:string):value is PaymentProviderId{return PAYMENT_PROVIDER_IDS.includes(value as PaymentProviderId);}
