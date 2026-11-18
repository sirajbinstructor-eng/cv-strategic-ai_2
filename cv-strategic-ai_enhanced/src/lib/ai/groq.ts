const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const apiKey = process.env.GROQ_API_KEY;
export const groqConfigured = Boolean(apiKey);

type GroqMessage = { role: "system" | "user"; content: string };
type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; type?: string };
};

function httpError(message: string, status: number): Error {
  const error = new Error(message);
  Object.assign(error, { status });
  return error;
}

async function requestGroq(messages: GroqMessage[]): Promise<GroqResponse> {
  if (!apiKey) throw httpError("AI service is not configured. GROQ_API_KEY is missing.", 503);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature: 0,
        response_format: { type: "json_object" },
        messages
      }),
      signal: controller.signal,
      cache: "no-store"
    });
    const raw = await response.text();
    let payload: GroqResponse;
    try { payload = JSON.parse(raw) as GroqResponse; }
    catch { throw httpError("Groq returned an unreadable response.", response.ok ? 502 : response.status); }
    if (!response.ok) {
      if (response.status === 429) throw httpError("The AI service is busy. Please wait a moment and try again.", 429);
      if (response.status === 401 || response.status === 403) throw httpError("Groq authentication failed. Check GROQ_API_KEY in Render.", 503);
      throw httpError(payload.error?.message || `Groq request failed (${response.status}).`, response.status >= 500 ? 503 : response.status);
    }
    return payload;
  } catch (cause) {
    const error = cause as { name?: string; status?: number };
    if (error.status) throw cause;
    if (error.name === "AbortError") throw httpError("The AI request timed out. Please try again.", 504);
    throw cause;
  } finally { clearTimeout(timeout); }
}

export async function askGroqForJson<T = Record<string, unknown>>(system: string, user: string): Promise<T> {
  const payload = await requestGroq([{ role: "system", content: system }, { role: "user", content: user }]);
  const output = payload.choices?.[0]?.message?.content;
  if (!output) throw httpError("Groq returned an empty response.", 502);
  const json = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(json) as T; }
  catch { throw httpError("Groq returned invalid JSON. Please retry the request.", 502); }
}
