import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Space_Grotesk, Syne } from "next/font/google";

const sansFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

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
      <html lang="en" suppressHydrationWarning>
        <body className={`${sansFont.variable} ${displayFont.variable} min-h-screen text-lg antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
