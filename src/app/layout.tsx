import type { Metadata, Viewport } from "next";

import { heroManifest } from "@/lib/hero/manifest";

import "@/styles/fonts.css";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://alsos.dev"),
  title: {
    default: "ALSOS — 사이버보안 학습 생태계",
    template: "%s · ALSOS",
  },
  description:
    "보안을 배우고, 실전 랩에서 증명하며, 당신만의 숲을 키우세요. 학습 활동이 XP가 되고, XP가 나무의 성장으로 남는 사이버보안 학습 플랫폼입니다.",
  applicationName: "ALSOS",
  openGraph: {
    type: "website",
    siteName: "ALSOS",
    title: "ALSOS — 사이버보안 학습 생태계",
    description: "보안을 배우고, 실전 랩에서 증명하며, 당신만의 숲을 키우세요.",
    images: [{ url: heroManifest.og, width: 1200, height: 630 }],
    locale: "ko_KR",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // The plate's darkest corner, so the browser chrome joins the vault.
  themeColor: "#070c16",
  colorScheme: "dark",
  // Zoom is never capped — §15 requires 200% to stay usable.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
