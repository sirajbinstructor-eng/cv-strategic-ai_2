import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LaunchOfferBanner } from "@/components/dashboard/launch-offer-banner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/dashboard");
  const providers = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    microsoft: false
  };
  return (
    <main className="marketing-page">
      <header className="site-header">
        <a className="brand" href="/"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Intelligent career positioning</small></span></a>
        <a className="header-link" href="#sign-in">Sign in</a>
      </header>
      <div className="marketing-content">
        <LaunchOfferBanner />
        <section className="marketing-hero">
          <div className="hero-copy">
            <p className="eyebrow">CAREER POSITIONING WORKSPACE</p>
            <h1>A CV that tells the right professional story.</h1>
            <p className="hero-description">Analyze your experience against a target opportunity, identify the evidence that matters, and build a more relevant ATS-friendly CV — without inventing facts.</p>
            <div className="hero-points"><span>01&nbsp; Analyze</span><span>02&nbsp; Understand</span><span>03&nbsp; Generate</span></div>
            <div className="trust-points"><span>Evidence-first assessment</span><span>Source chronology preserved</span><span>AI-powered</span></div>
          </div>
          <div className="auth-wrap" id="sign-in"><AuthPanel providers={providers} /></div>
        </section>
        <section className="value-grid" aria-label="Platform principles">
          <article><span className="value-number">01</span><h3>Evidence over invention</h3><p>Every recommendation must be traceable to your CV or explicitly confirmed by you.</p></article>
          <article><span className="value-number">02</span><h3>Built for ATS readability</h3><p>Clear structure, single-column documents and relevant language — without visual gimmicks.</p></article>
          <article><span className="value-number">03</span><h3>You stay in control</h3><p>Review the assessment before generating a targeted version of your CV.</p></article>
        </section>
        <footer className="site-footer"><span>© {new Date().getFullYear()} CV Strategist AI</span><span>Your experience. Your evidence. Your story.</span></footer>
      </div>
    </main>
  );
}
