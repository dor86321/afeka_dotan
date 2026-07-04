import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/app-shell";
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
  title: "Mobile AED LoRa Emergency Network",
  description: "פלטפורמת סימולציה לאיתור והתרעת AED ניידים בעזרת LoRa",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${geistSans.variable} ${geistMono.variable} light h-full antialiased`} style={{ colorScheme: "light" }}>
      <body className="min-h-full flex flex-col bg-[#eef2f7] text-black">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
