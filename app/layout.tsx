import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Syne, Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const displayFont = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NextFlow",
  description: "LLM workflow builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
        <body className={`${geist.variable} ${displayFont.variable} min-h-screen text-lg antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
