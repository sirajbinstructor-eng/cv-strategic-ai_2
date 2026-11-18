import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "CV Strategist AI — Evidence-based CV positioning",
  description: "Analyze your experience against a target opportunity and build an ATS-friendly CV without inventing facts.",
  applicationName: "CV Strategist AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Providers>{children}</Providers></body></html>;
}
