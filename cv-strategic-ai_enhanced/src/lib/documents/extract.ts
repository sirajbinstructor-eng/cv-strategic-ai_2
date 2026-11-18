import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export function cleanText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/[\t ]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractCvText(file: File): Promise<string> {
  if (file.size > 12 * 1024 * 1024) {
    const error = new Error("The CV exceeds the 12 MB upload limit.");
    Object.assign(error, { status: 413 });
    throw error;
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase();
  let extracted = "";
  if (extension === "docx") {
    extracted = (await mammoth.extractRawText({ buffer })).value;
  } else if (extension === "pdf") {
    extracted = (await pdfParse(buffer)).text;
  } else {
    const error = new Error("Unsupported file. Upload a DOCX or text-based PDF.");
    Object.assign(error, { status: 415 });
    throw error;
  }
  const text = cleanText(extracted);
  if (text.length < 80) {
    const error = new Error("Very little text was extracted. The PDF may be scanned; OCR is not included yet.");
    Object.assign(error, { status: 422 });
    throw error;
  }
  return text.slice(0, 60_000);
}
