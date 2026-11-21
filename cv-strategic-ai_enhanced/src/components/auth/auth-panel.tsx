
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

type Props = {
  providers: {
    google: boolean;
    microsoft: boolean;
  };
  initialMode?: "signin" | "signup";
};

const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(128)
});

type FormValues = z.infer<typeof schema>;

function readableError(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      statusText?: unknown;
      code?: unknown;
    };

    if (
      typeof candidate.message === "string" &&
      candidate.message.trim()
    ) {
      return candidate.message;
    }

    if (
      typeof candidate.statusText === "string" &&
      candidate.statusText.trim()
    ) {
      return candidate.statusText;
    }

    if (
      typeof candidate.code === "string" &&
      candidate.code.trim()
    ) {
      return `Authentication error (${candidate.code}).`;
    }
  }

  return fallback;
}

export function AuthPanel({
  providers,
  initialMode = "signup"
}: Props) {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [stage, setStage] = useState<"credentials" | "verify">(
    "credentials"
  );

  const [message, setMessage] = useState("");
  const [otp, setOtp] = useState("");
  const [otpType, setOtpType] = useState<"email-verification" | "sign-in">("email-verification");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: ""
    }
  });

  const finishSignIn = async (
    userEmail: string,
    userPassword: string
  ) => {
    const result = await authClient.signIn.email({
      email: userEmail,
      password: userPassword,
      callbackURL: "/dashboard"
    });

    if (result.error) {
      setMessage(
        readableError(
          result.error,
          "Email verified, but sign-in failed. Please sign in again."
        )
      );
      setStage("credentials");
      setMode("signin");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  };

  const onSubmit = form.handleSubmit((values) => {
    setMessage("");

    const normalizedEmail = values.email.trim().toLowerCase();
    const normalizedName =
      values.name?.trim() || normalizedEmail.split("@")[0];

    setEmail(normalizedEmail);
    setPassword(values.password);
    setFullName(normalizedName);

    startTransition(async () => {
      try {
        if (mode === "signup") {
          const result = await authClient.signUp.email({
            name: normalizedName,
            email: normalizedEmail,
            password: values.password,
            callbackURL: "/dashboard"
          });

          if (result.error) {
            setMessage(
              readableError(
                result.error,
                "Could not create your account. Please try again."
              )
            );
            return;
          }

          setOtp("");
          setStage("verify");
          setMessage(
            "Your account has been created. Enter the six-digit code sent to your email address."
          );
          return;
        }

        const result = await authClient.signIn.email({
          email: normalizedEmail,
          password: values.password,
          callbackURL: "/dashboard"
        });

        if (result.error) {
          console.error(
            "[auth-client] Email sign-in rejected:",
            result.error
          );

          setMessage(
            readableError(
              result.error,
              "Sign-in failed. Check your email and password."
            )
          );
          return;
        }

        router.replace("/dashboard");
        router.refresh();
      } catch (error) {
        console.error("[auth-client] Authentication request failed:", error);

        setMessage(
          readableError(
            error,
            "Could not reach the authentication service. Please try again."
          )
        );
      }
    });
  });

  const verifyOtp = () => {
    setMessage("");

    if (!/^\d{6}$/.test(otp)) {
      setMessage("Enter the six-digit verification code.");
      return;
    }

    startTransition(async () => {
      try {
        if (otpType === "sign-in") {
          const result = await authClient.signIn.emailOtp({ email, otp });
          if (result.error) {
            setMessage(readableError(result.error, "The code is invalid or expired."));
            return;
          }
          router.replace("/dashboard");
          router.refresh();
          return;
        }

        const result = await authClient.emailOtp.verifyEmail({ email, otp });
        if (result.error) {
          setMessage(readableError(result.error, "The code is invalid or expired. Request a new code and try again."));
          return;
        }
        await finishSignIn(email, password);
      } catch (error) {
        console.error("[auth-client] OTP verification failed:", error);

        setMessage(
          readableError(
            error,
            "Verification failed. Please try again."
          )
        );
      }
    });
  };

  const resendOtp = () => {
    setMessage("");

    startTransition(async () => {
      try {
        const result =
          await authClient.emailOtp.sendVerificationOtp({
            email,
            type: otpType
          });

        if (result.error) {
          setMessage(
            readableError(
              result.error,
              "Could not resend the verification code."
            )
          );
          return;
        }

        setOtp("");
        setMessage("A new verification code has been sent.");
      } catch (error) {
        console.error("[auth-client] OTP resend failed:", error);

        setMessage(
          readableError(
            error,
            "Could not resend the verification code."
          )
        );
      }
    });
  };

  const startOtpSignIn = () => {
    const candidate = form.getValues("email").trim().toLowerCase();
    if (!z.string().email().safeParse(candidate).success) {
      form.setError("email", { message: "Enter a valid email address first." });
      return;
    }
    setEmail(candidate);
    setOtp("");
    setOtpType("sign-in");
    setMessage("");
    startTransition(async () => {
      try {
        const result = await authClient.emailOtp.sendVerificationOtp({ email: candidate, type: "sign-in" });
        if (result.error) {
          setMessage(readableError(result.error, "Could not send a sign-in code."));
          return;
        }
        setStage("verify");
        setMessage("A six-digit sign-in code has been sent to your email.");
      } catch (error) {
        setMessage(readableError(error, "Could not send a sign-in code."));
      }
    });
  };

  const socialSignIn = (provider: "google" | "microsoft") => {
    setMessage("");
    if (pending) return;
    if (!providers[provider]) {
      setMessage(provider === "google" ? "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render, then redeploy." : "Microsoft sign-in is not configured. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in Render, then redeploy.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await authClient.signIn.social({
          provider,
          callbackURL: "/dashboard"
        });

        if (result.error) {
          setMessage(
            readableError(
              result.error,
              `Could not start ${provider} sign-in.`
            )
          );
        }
      } catch (error) {
        console.error(
          `[auth-client] ${provider} OAuth request failed:`,
          error
        );

        setMessage(
          readableError(
            error,
            `Could not start ${provider} sign-in.`
          )
        );
      }
    });
  };

  const changeMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setStage("credentials");
    setMessage("");
    setOtp("");
    setOtpType("email-verification");
    form.clearErrors();
  };

  return (
    <section className="auth-card">
      {stage === "credentials" ? (
        <>
          <div className="auth-heading">
            <p className="eyebrow">YOUR CAREER WORKSPACE</p>
            <h2>
              {mode === "signup"
                ? "Create your account"
                : "Welcome back."}
            </h2>
            <p className="muted">
              {mode === "signup"
                ? "Create your account, then choose a Job Seeker or Recruiter workspace."
                : "Sign in to continue your CV strategy."}
            </p>
          </div>

          <div className="social-stack">
            <button
              className="social-button"
              type="button"
              aria-disabled={!providers.google}
              title={providers.google ? "Continue with Google" : "Google OAuth credentials are not configured in Render"}
              disabled={pending}
              onClick={() => socialSignIn("google")}
            >
              <span className="google-g">G</span>
              Continue with Google{!providers.google ? " · setup required" : ""}
            </button>


          </div>

          {!providers.google && (
            <p className="provider-note">
              Google sign-in is not configured yet. Add its OAuth credentials in Render or use email sign-in. You can inspect the safe server diagnostic at <a href="/api/auth/status" target="_blank" rel="noreferrer">OAuth configuration status</a>.
            </p>
          )}

          <div className="auth-divider">
            <span>OR USE YOUR EMAIL</span>
          </div>

          <form
            className="auth-form"
            onSubmit={onSubmit}
            noValidate
          >
            {mode === "signup" && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  placeholder="Your name"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <small className="field-error">
                    {form.formState.errors.name.message}
                  </small>
                )}
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <small className="field-error">
                  {form.formState.errors.email.message}
                </small>
              )}
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete={
                  mode === "signup"
                    ? "new-password"
                    : "current-password"
                }
                placeholder={
                  mode === "signup"
                    ? "At least 10 characters"
                    : "Your password"
                }
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <small className="field-error">
                  {form.formState.errors.password.message}
                </small>
              )}
            </label>

            {message && (
              <p className="form-message" role="alert">
                {message}
              </p>
            )}

            <button
              className="button-primary full-width"
              type="submit"
              disabled={pending}
            >
              {pending
                ? "Please wait..."
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
            {mode === "signin" && (
              <button className="social-button" type="button" disabled={pending} onClick={startOtpSignIn}>
                Sign in with an email code
              </button>
            )}
          </form>

          <p className="auth-switch">
            {mode === "signup"
              ? "Already have an account?"
              : "New to CV Strategist AI?"}{" "}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                changeMode(
                  mode === "signup" ? "signin" : "signup"
                )
              }
            >
              {mode === "signup"
                ? "Sign in"
                : "Create an account"}
            </button>
          </p>
        </>
      ) : (
        <>
          <div className="auth-heading">
            <p className="eyebrow">{otpType === "sign-in" ? "PASSWORDLESS SIGN-IN" : "EMAIL VERIFICATION"}</p>
            <h2>{otpType === "sign-in" ? "Sign in with your code." : "Check your inbox."}</h2>
            <p className="muted">
              {otpType === "sign-in" ? "Enter the sign-in code sent to:" : "We sent a six-digit verification code to:"}
            </p>
            <strong>{email}</strong>
          </div>

          <div className="auth-form">
            <label>
              Verification code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(event) =>
                  setOtp(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6)
                  )
                }
              />
            </label>

            {message && (
              <p className="form-message" role="alert">
                {message}
              </p>
            )}

            <button
              className="button-primary full-width"
              type="button"
              disabled={pending || otp.length !== 6}
              onClick={verifyOtp}
            >
              {pending ? "Verifying..." : otpType === "sign-in" ? "Verify and sign in" : "Verify email"}
              <span aria-hidden="true">→</span>
            </button>

            <button
              className="social-button"
              type="button"
              disabled={pending}
              onClick={resendOtp}
            >
              Resend verification code
            </button>

            <button
              className="auth-switch"
              type="button"
              disabled={pending}
              onClick={() => {
                setStage("credentials");
                setMessage("");
                setOtp("");
              }}
            >
              Back to sign in
            </button>
          </div>
        </>
      )}

      <p className="auth-legal">
        By continuing, you agree to use evidence-based CV content.
        Never submit information you are not authorized to share.
      </p>
    </section>
  );
}
