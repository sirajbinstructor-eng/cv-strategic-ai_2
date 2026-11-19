
type OtpEmailType =
  | "email-verification"
  | "sign-in"
  | "forget-password"
  | "change-email";

type SendOtpEmailInput = {
  to: string;
  otp: string;
  type: OtpEmailType;
};

type AppsScriptResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function sendOtpEmail({
  to,
  otp,
  type
}: SendOtpEmailInput): Promise<void> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;

  if (!url || !secret) {
    throw new Error("The email service is not configured.");
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    throw new Error("GOOGLE_SCRIPT_URL is not a valid Apps Script deployment URL.");
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Invalid verification code format.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        secret,
        to: to.trim().toLowerCase(),
        otp,
        type
      }),
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal
    });

    const responseText = await response.text();

    let result: AppsScriptResponse;

    try {
      result = JSON.parse(responseText) as AppsScriptResponse;
    } catch {
      throw new Error(
        "The email service returned an invalid response. Check the Apps Script deployment and access settings."
      );
    }

    if (!response.ok || result.ok !== true) {
      console.error("[email] Apps Script delivery failed:", {
        status: response.status,
        error: result.error || "Unknown email delivery error"
      });

      throw new Error(
        result.error || "The verification email could not be sent."
      );
    }
  } catch (cause) {
    const error = cause as { name?: string };

    if (error.name === "AbortError") {
      throw new Error("The email service timed out. Please try again.");
    }

    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}
