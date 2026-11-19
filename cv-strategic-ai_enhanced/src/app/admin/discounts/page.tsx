import { DiscountReviewClient } from "@/components/admin/discount-review-client";
export const dynamic="force-dynamic";
export default function DiscountReviewPage(){return <div className="dashboard-main"><section className="dashboard-welcome"><div><p className="eyebrow">MANUAL VERIFICATION</p><h1>Discount applications.</h1><p className="muted">Review eligibility declarations and record decisions.</p></div></section><DiscountReviewClient/></div>;}
