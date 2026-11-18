"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

type Props = { providers: { google: boolean; microsoft: boolean }; initialMode?: "signin" | "signup" };
const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128)
});
type FormValues = z.infer<typeof schema>;

export function AuthPanel({ providers, initialMode = "signup" }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setMessage("");
    startTransition(async () => {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name: values.name?.trim() || values.email.split("@")[0], email: values.email, password: values.password, callbackURL: "/dashboard" })
        : await authClient.signIn.email({ email: values.email, password: values.password, callbackURL: "/dashboard" });
      if (result.error) {
        setMessage(result.error.message || "Authentication failed. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  });

  const socialSignIn = (provider: "google" | "microsoft") => {
    startTransition(async () => {
      const result = await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
      if (result.error) setMessage(result.error.message || `Could not start ${provider} sign-in.`);
    });
  };

  return (
    <section className="auth-card">
      <div className="auth-heading"><p className="eyebrow">YOUR CAREER WORKSPACE</p><h2>{mode === "signup" ? "Create your account" : "Welcome back."}</h2><p className="muted">{mode === "signup" ? "Start with three free AI analyses." : "Sign in to continue your CV strategy."}</p></div>
      <div className="social-stack">
        <button className="social-button" type="button" disabled={!providers.google || pending} onClick={() => socialSignIn("google")}><span className="google-g">G</span>Continue with Google</button>
        <button className="social-button" type="button" disabled={!providers.microsoft || pending} onClick={() => socialSignIn("microsoft")}><span className="microsoft-mark"><i /><i /><i /><i /></span>Continue with Microsoft</button>
      </div>
      {(!providers.google || !providers.microsoft) && <p className="provider-note">Social sign-in buttons activate after OAuth credentials are configured.</p>}
      <div className="auth-divider"><span>OR USE YOUR EMAIL</span></div>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        {mode === "signup" && <label>Full name<input autoComplete="name" placeholder="Your name" {...form.register("name")} /></label>}
        <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...form.register("email")} />{form.formState.errors.email && <small className="field-error">{form.formState.errors.email.message}</small>}</label>
        <label>Password<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder={mode === "signup" ? "At least 10 characters" : "Your password"} {...form.register("password")} />{form.formState.errors.password && <small className="field-error">{form.formState.errors.password.message}</small>}</label>
        {message && <p className="form-message" role="alert">{message}</p>}
        <button className="button-primary full-width" type="submit" disabled={pending}>{pending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}<span aria-hidden="true">→</span></button>
      </form>
      <p className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to CV Strategist AI?"} <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); }}> {mode === "signup" ? "Sign in" : "Create an account"}</button></p>
      <p className="auth-legal">By continuing, you agree to use evidence-based CV content. Never submit information you are not authorized to share.</p>
    </section>
  );
}
