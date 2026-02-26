import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "公交出行助手 - 您的智能语音向导",
  description: "专为老年人设计的智能公交出行助手，支持语音输入、语音播报和实时公交查询。",
  keywords: ["公交", "出行", "语音助手", "老年人", "无障碍", "实时公交"],
  authors: [{ name: "Bus Assistant Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "公交出行助手",
    description: "专为老年人设计的智能公交出行助手",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "公交出行助手",
    description: "专为老年人设计的智能公交出行助手",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
