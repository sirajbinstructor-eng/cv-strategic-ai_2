import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { DiscountApplication } from "@/components/discounts/discount-application";
export const dynamic="force-dynamic";
export default async function DiscountsPage(){const session=await getCurrentSession();if(!session?.user?.id)redirect("/");return <main className="dashboard-page"><header className="dashboard-header"><a className="brand" href="/dashboard"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Discount eligibility</small></span></a><nav className="header-actions"><a className="header-link" href="/dashboard">Workspace</a></nav></header><div className="dashboard-main"><section className="dashboard-welcome"><div><p className="eyebrow">DISCOUNT PROGRAM</p><h1>Verify your eligibility.</h1><p className="muted">Submit your application for manual review.</p></div></section><DiscountApplication/></div></main>;}
