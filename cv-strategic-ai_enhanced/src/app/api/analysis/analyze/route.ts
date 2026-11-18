import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/server-session";
import { extractCvText, cleanText } from "@/lib/documents/extract";
import { askGroqForJson } from "@/lib/ai/groq";
import { ANALYSIS_SYSTEM_PROMPT, normalizeAndValidateAnalysis } from "@/lib/ai/analysis";
import { applyDeterministicScoring } from "@/lib/ai/scoring";
import { completeAnalysisTrial, getEntitlements, releaseAnalysisTrial, reserveAnalysisTrial } from "@/lib/entitlements/trials";

export const runtime = "nodejs";
export const maxDuration = 120;

function getContactDetails(cvText: string) {
  const emails = cvText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phones = cvText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const linkedin = cvText.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  const website = cvText.match(/https?:\/\/(?!www\.)[^\s)]+/i);
  return { email: emails[0] || "", phone: phones[0] || "", linkedin: linkedin?.[0] || "", website: website?.[0] || "" };
}

export async function POST(request: NextRequest) {
  let reservation: Awaited<ReturnType<typeof reserveAnalysisTrial>> | null = null;
  let userId = "";
  try {
    const user = await requireUser();
    userId = user.id;
    const form = await request.formData();
    const file = form.get("cv");
    const jobDescription = cleanText(String(form.get("jobDescription") || ""));
    const mode = String(form.get("mode") || "automatic");

    if (mode !== "automatic") {
      return NextResponse.json({ error: "Consultant mode requires a paid Consultant entitlement." }, { status: 403 });
    }
    if (!(file instanceof File)) return NextResponse.json({ error: "Please select a CV file." }, { status: 400 });
    if (jobDescription.length < 80) return NextResponse.json({ error: "Please provide a more complete job description (at least 80 characters)." }, { status: 400 });
    if (jobDescription.length > 30_000) return NextResponse.json({ error: "The job description exceeds 30,000 characters." }, { status: 400 });

    const cvText = await extractCvText(file);
    // Reserve atomically before spending on the AI request. Failed analyses release the reservation.
    reservation = await reserveAnalysisTrial(userId);

    const raw = await askGroqForJson<unknown>(
      ANALYSIS_SYSTEM_PROMPT,
      `JOB DESCRIPTION:\n${jobDescription}\n\nSOURCE CV:\n${cvText}\n\nProduce the complete structured analysis. The analysis must be mode-independent. Prepare questions, tips and cautions, but the Automatic interface will not display consultant-only guidance.`
    );
    const analysis = applyDeterministicScoring(normalizeAndValidateAnalysis(raw));
    const contactDetails = getContactDetails(cvText);
    const analysisId = randomUUID();
    await completeAnalysisTrial(userId, reservation, {
      id: analysisId,
      targetTitle: analysis.targetTitle || null,
      matchScore: analysis.match.score,
      result: analysis as unknown as Record<string, unknown>
    });

    let entitlements = null;
    try { entitlements = await getEntitlements(userId); } catch (entitlementError) {
      console.error("[ENTITLEMENTS_REFRESH]", entitlementError);
    }
    return NextResponse.json({
      analysisId,
      analysis,
      source: { filename: file.name, extractedCharacters: cvText.length, contactDetails },
      // Kept in the browser's in-memory React state only; raw CV text is not persisted in PostgreSQL.
      sourceCvText: cvText,
      jobDescription,
      entitlements: entitlements ? {
        remaining: Number.isFinite(entitlements.remaining) ? entitlements.remaining : null,
        used: entitlements.used,
        granted: entitlements.granted,
        unlimited: entitlements.unlimited,
        workspaceLocked: entitlements.workspaceLocked
      } : null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (reservation && userId) await releaseAnalysisTrial(userId, reservation, "ANALYSIS_FAILED");
    const error = cause as { message?: string; status?: number; code?: string };
    const status = Number(error.status || (error.message === "Please sign in to continue." ? 401 : 500));
    return NextResponse.json({ error: error.message || "An unexpected analysis error occurred." }, { status });
  }
}
