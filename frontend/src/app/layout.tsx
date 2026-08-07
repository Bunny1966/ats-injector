import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Resume Optimizer — Optimize Your Resume for Any Job",
  description:
    "Upload your resume, paste a job description, and get AI-powered suggestions to improve ATS compatibility while preserving your original formatting.",
  keywords: [
    "resume optimizer",
    "ATS",
    "resume",
    "job application",
    "AI",
    "career",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-[var(--text-primary)]">
        {children}
      </body>
    </html>
  );
}
