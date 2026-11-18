import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { z } from "zod";
import PDFDocument from "pdfkit";
import path from "node:path";
import { requireUser } from "@/lib/server-session";
import { askGroqForJson } from "@/lib/ai/groq";

export const runtime = "nodejs";
export const maxDuration = 120;

const payloadSchema = z.object({
  analysis: z.record(z.string(), z.unknown()),
  sourceCvText: z.string().min(80).max(60_000),
  jobDescription: z.string().min(80).max(30_000),
  candidateName: z.string().max(160).optional(),
  contact: z.string().max(500).optional(),
  confirmedFacts: z.string().max(8_000).optional(),
  format: z.enum(["docx", "pdf"]).default("docx")
});

type GeneratedCv = {
  name?: string; headline?: string; contact?: string; summary?: string;
  skills?: string[];
  experience?: Array<{ role?: string; employer?: string; dates?: string; sourceOrder?: number; bullets?: string[] }>;
  education?: string[]; certifications?: string[]; interests?: string[];
};

function safe(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function list(value: unknown): string[] { return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map(x => x.trim()) : []; }
function paragraph(text: string, options: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) {
  return new Paragraph({ children: [new TextRun({ text, bold: options.bold, italics: options.italics, size: options.size ?? 20, color: options.color ?? "202938", font: "Arial" })], spacing: { after: 90 } });
}
function sectionHeading(text: string) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 100 }, border: { bottom: { color: "AAB7C8", size: 4, style: "single", space: 4 } } });
}
function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 55 } });
}

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "The CV generation request is incomplete." }, { status: 400 });
    const { analysis, sourceCvText, jobDescription, candidateName, contact, confirmedFacts, format } = parsed.data;
    const isFrench = analysis.language === "fr";
    const labels = isFrench
      ? { summary: "PROFIL PROFESSIONNEL", skills: "COMPÉTENCES CLÉS", experience: "EXPÉRIENCE PROFESSIONNELLE", education: "FORMATION", certifications: "CERTIFICATIONS", interests: "CENTRES D’INTÉRÊT" }
      : { summary: "PROFESSIONAL SUMMARY", skills: "CORE SKILLS", experience: "PROFESSIONAL EXPERIENCE", education: "EDUCATION", certifications: "CERTIFICATIONS", interests: "INTERESTS" };

    const generated = await askGroqForJson<GeneratedCv>(
      `Create a final ATS-friendly single-column CV as JSON with fields name, headline, contact, summary, skills[], experience[{role,employer,dates,sourceOrder,bullets[]}], education[], certifications[], interests[]. Use only source CV facts, analysis and explicit candidate confirmations. Never invent achievements, metrics, dates, skills, qualifications or responsibilities. Preserve exact professional experience chronology from the source CV; do not reorder by relevance. Do not invent contact details. Use the job description language for ALL content. No tables, icons, charts, text boxes, skill bars or separate Languages section by default. Unknown information stays empty. Return JSON only.`,
      `ANALYSIS:\n${JSON.stringify(analysis)}\n\nSOURCE CV:\n${sourceCvText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE NAME OVERRIDE:\n${candidateName || ""}\n\nCONTACT OVERRIDE:\n${contact || ""}\n\nCANDIDATE CONFIRMATIONS:\n${confirmedFacts || ""}\n\nGenerate the final CV. Keep experience in original source chronology.`
    );

    const experiences = Array.isArray(generated.experience) ? [...generated.experience] : [];
    experiences.sort((a, b) => Number(a.sourceOrder ?? 0) - Number(b.sourceOrder ?? 0));
    const children: Paragraph[] = [];
    children.push(new Paragraph({ text: safe(generated.name) || candidateName || "Candidate", heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT, spacing: { after: 80 } }));
    if (safe(generated.headline)) children.push(paragraph(safe(generated.headline), { bold: true, size: 24 }));
    if (safe(generated.contact || contact)) children.push(paragraph(safe(generated.contact) || safe(contact), { size: 18, color: "596579" }));
    if (safe(generated.summary)) children.push(sectionHeading(labels.summary), paragraph(safe(generated.summary)));
    const skills = list(generated.skills);
    if (skills.length) children.push(sectionHeading(labels.skills), paragraph(skills.join("  •  ")));
    if (experiences.length) {
      children.push(sectionHeading(labels.experience));
      for (const item of experiences) {
        const roleLine = [safe(item.role), safe(item.employer)].filter(Boolean).join(" | ");
        if (roleLine) children.push(paragraph(roleLine, { bold: true }));
        if (safe(item.dates)) children.push(paragraph(safe(item.dates), { italics: true, size: 18, color: "596579" }));
        for (const line of list(item.bullets)) children.push(bullet(line));
      }
    }
    const optional: Array<[string, string]> = [["education", labels.education], ["certifications", labels.certifications], ["interests", labels.interests]];
    for (const [key, title] of optional) {
      const values = list(generated[key as keyof GeneratedCv]);
      if (values.length) children.push(sectionHeading(title), ...values.map(bullet));
    }

    const safeName = safe(generated.name) || candidateName || "Candidate";
    const safeFileName = `CV_${safeName.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40)}_targeted`;

    if (format === "pdf") {
      const fontDir = path.join(process.cwd(), "assets", "fonts");
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        const pdf = new PDFDocument({ size: "A4", margins: { top: 48, bottom: 48, left: 52, right: 52 }, info: { Title: `Targeted CV - ${safeName}`, Author: "CV Strategist AI" } });
        pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
        pdf.on("end", () => resolve(Buffer.concat(chunks)));
        pdf.on("error", reject);
        pdf.registerFont("Noto", path.join(fontDir, "NotoSans-Regular.ttf"));
        pdf.registerFont("Noto-Bold", path.join(fontDir, "NotoSans-Bold.ttf"));
        pdf.registerFont("Noto-Italic", path.join(fontDir, "NotoSans-Italic.ttf"));
        pdf.font("Noto-Bold").fontSize(22).fillColor("#182338").text(safeName, { lineGap: 2 });
        if (safe(generated.headline)) pdf.moveDown(0.25).font("Noto-Bold").fontSize(11).fillColor("#315fbd").text(safe(generated.headline));
        if (safe(generated.contact || contact)) pdf.moveDown(0.25).font("Noto").fontSize(8.5).fillColor("#596579").text(safe(generated.contact) || safe(contact));
        const pdfSection = (title: string) => { pdf.moveDown(0.8).font("Noto-Bold").fontSize(10).fillColor("#182338").text(title.toUpperCase()); pdf.moveDown(0.12).moveTo(52, pdf.y).lineTo(543, pdf.y).strokeColor("#aab7c8").lineWidth(0.7).stroke(); pdf.moveDown(0.35); };
        const pdfBody = (text: string) => pdf.font("Noto").fontSize(9.3).fillColor("#202938").text(text, { lineGap: 3, paragraphGap: 3 });
        if (safe(generated.summary)) { pdfSection(labels.summary); pdfBody(safe(generated.summary)); }
        if (skills.length) { pdfSection(labels.skills); pdfBody(skills.join("  •  ")); }
        if (experiences.length) {
          pdfSection(labels.experience);
          for (const item of experiences) {
            const roleLine = [safe(item.role), safe(item.employer)].filter(Boolean).join(" | ");
            if (roleLine) pdf.moveDown(0.25).font("Noto-Bold").fontSize(9.5).fillColor("#202938").text(roleLine);
            if (safe(item.dates)) pdf.font("Noto-Italic").fontSize(8.3).fillColor("#596579").text(safe(item.dates));
            for (const line of list(item.bullets)) pdf.font("Noto").fontSize(9).fillColor("#202938").text(`•  ${line}`, { indent: 10, lineGap: 2 });
          }
        }
        for (const [key, title] of optional) {
          const values = list(generated[key as keyof GeneratedCv]);
          if (values.length) { pdfSection(title); for (const value of values) pdf.font("Noto").fontSize(9.2).fillColor("#202938").text(`•  ${value}`, { indent: 10, lineGap: 2 }); }
        }
        pdf.end();
      });
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`, "Cache-Control": "no-store" }
      });
    }

    const doc = new Document({
      creator: "CV Strategist AI",
      title: `Targeted CV - ${safe(generated.name) || candidateName || "Candidate"}`,
      sections: [{ properties: {}, children }],
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } }
    });
    const buffer = await Packer.toBuffer(doc);
    const filename = `${safeFileName}.docx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (cause) {
    const error = cause as { message?: string; status?: number };
    return NextResponse.json({ error: error.message || "CV generation failed." }, { status: Number(error.status || 500) });
  }
}
