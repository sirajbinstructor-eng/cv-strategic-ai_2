
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/server-session";
import { extractCvText, cleanText } from "@/lib/documents/extract";
import { askGroqForJson } from "@/lib/ai/groq";
import { ANALYSIS_SYSTEM_PROMPT, normalizeAndValidateAnalysis } from "@/lib/ai/analysis";
import { applyDeterministicScoring } from "@/lib/ai/scoring";
import {
  completeAnalysisTrial,
  getEntitlements,
  releaseAnalysisTrial,
  reserveAnalysisTrial
} from "@/lib/entitlements/trials";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";

export const runtime = "nodejs";
export const maxDuration = 120;

function getContactDetails(cvText: string) {
  const emails = cvText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const phones = cvText.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  const linkedin = cvText.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i);
  const website = cvText.match(/https?:\/\/(?!www\.)[^\s)]+/i);

  return {
    email: emails[0] || "",
    phone: phones[0] || "",
    linkedin: linkedin?.[0] || "",
    website: website?.[0] || ""
  };
}

export async function POST(request: NextRequest) {
  let reservation: Awaited<ReturnType<typeof reserveAnalysisTrial>> | null = null;
  let userId = "";

  try {
    // Ensure required database tables exist before any analysis usage query.
    await ensureAuthSchema();

    const user = await requireUser();
    userId = user.id;

    const form = await request.formData();
    const file = form.get("cv");
    const jobDescription = cleanText(String(form.get("jobDescription") || ""));
    const requestedMode = String(form.get("mode") || "analysis");
    const mode = requestedMode === "automatic" ? "analysis" : requestedMode === "consultant" ? "consulting" : requestedMode;

    if (mode !== "analysis" && mode !== "consulting") {
      return NextResponse.json({ error: "Unsupported analysis mode." }, { status: 400 });
    }
    if (mode === "consulting") {
      const currentEntitlements = await getEntitlements(userId);
      if (!currentEntitlements || (!currentEntitlements.isAdmin && !currentEntitlements.isUnrestricted && !currentEntitlements.consultantEntitled && currentEntitlements.subscription?.plan !== "consultant")) {
        return NextResponse.json({ error: "Consulting mode requires Gold access or administrator privileges." }, { status: 403 });
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Please select a CV file." },
        { status: 400 }
      );
    }

    if (jobDescription.length < 80) {
      return NextResponse.json(
        { error: "Please provide a more complete job description (at least 80 characters)." },
        { status: 400 }
      );
    }

    if (jobDescription.length > 30_000) {
      return NextResponse.json(
        { error: "The job description exceeds 30,000 characters." },
        { status: 400 }
      );
    }

    const cvText = await extractCvText(file);

    // Reserve atomically before spending on the AI request.
    reservation = await reserveAnalysisTrial(userId, mode as "analysis" | "consulting");

    const raw = await askGroqForJson<unknown>(
      ANALYSIS_SYSTEM_PROMPT,
      `JOB DESCRIPTION:\n${jobDescription}\n\nSOURCE CV:\n${cvText}\n\nProduce the complete structured analysis. The assessment must remain evidence-based and must not invent candidate facts. In Consulting mode, provide more detailed coaching explanations and actionable follow-up guidance; in Analysis mode, provide a concise assessment. The selected mode controls the presentation and depth, not the factual scoring.`
    );

    const analysis = applyDeterministicScoring(
      normalizeAndValidateAnalysis(raw)
    );

    const contactDetails = getContactDetails(cvText);
    const analysisId = randomUUID();

    await completeAnalysisTrial(userId, reservation, {
      id: analysisId,
      targetTitle: analysis.targetTitle || null,
      matchScore: analysis.match.score,
      result: analysis as unknown as Record<string, unknown>,
      mode: mode as "analysis" | "consulting"
    });

    let entitlements = null;

    try {
      entitlements = await getEntitlements(userId);
    } catch (entitlementError) {
      console.error("[ENTITLEMENTS_REFRESH]", entitlementError);
    }

    return NextResponse.json(
      {
        analysisId,
        analysis,
        source: {
          filename: file.name,
          extractedCharacters: cvText.length,
          contactDetails
        },
        // Raw CV text stays in browser memory only.
        sourceCvText: cvText,
        jobDescription,
        entitlements: entitlements
          ? {
              remaining: Number.isFinite(entitlements.remaining)
                ? entitlements.remaining
                : null,
              used: entitlements.used,
              granted: entitlements.granted,
              unlimited: entitlements.unlimited,
              workspaceLocked: entitlements.workspaceLocked
            }
          : null
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (cause) {
    if (reservation && userId) {
      await releaseAnalysisTrial(userId, reservation, "ANALYSIS_FAILED");
    }

    const error = cause as {
      message?: string;
      status?: number;
      code?: string;
    };

    const status = Number(
      error.status ||
      (error.message === "Please sign in to continue." ? 401 : 500)
    );

    console.error("[ANALYSIS_ERROR]", cause);

    return NextResponse.json(
      {
        error: error.message || "An unexpected analysis error occurred."
      },
      { status }
    );
  }
}
