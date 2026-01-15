import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/lib/translations";
import { UIProvider } from "@/components/ui-provider";
import { PersistentSauna } from "@/components/persistent-sauna";
import { UserHeader } from "@/components/user-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pirtis Interview - Sauna Design Assistant",
  description: "AI-powered voice interview for personalized sauna design recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}
      >
        <LanguageProvider>
          <UIProvider>
            <UserHeader />
            <PersistentSauna />
            {children}
            <Toaster />
          </UIProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
