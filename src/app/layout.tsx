import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getAppSettings } from "@/lib/app-settings";
import { appVersion, appVersionLabel } from "@/lib/version";
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
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 pt-2 text-center text-xs text-ink/58 sm:px-6 lg:px-8">
          <a
            className="inline-flex items-center justify-center rounded-full border border-line bg-white/78 px-3 py-1 font-medium transition hover:border-moss hover:text-moss"
            href={`https://github.com/qtrcipher/open-lottery-manager/releases/tag/v${appVersion}`}
            rel="noreferrer"
            target="_blank"
          >
            {appVersionLabel()}
          </a>
        </footer>
      </body>
    </html>
  );
}
