import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getAppSettings } from "@/lib/app-settings";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();

  return {
    title: settings.operatorName,
    description: settings.publicTagline
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getAppSettings();

  return (
    <html lang="en">
      <body className={inter.variable} style={{ "--brand-color": settings.brandColor } as CSSProperties}>
        {children}
      </body>
    </html>
  );
}
