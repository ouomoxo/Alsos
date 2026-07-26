import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

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
  themeColor: "#070908",
  colorScheme: "dark",
  // Zoom is never capped — §15 requires 200% to stay usable.
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="ko">
      <head>
        {/*
          The hero skeleton is fetched by the WebGL layer moments after load.
          Preloading it costs nothing on the critical path and removes a
          round-trip from the growth animation's start.
        */}
        <link rel="preload" href={heroManifest.skeleton} as="fetch" crossOrigin="anonymous" />
        <script
          nonce={nonce}
          // Applies the visual-test flag before first paint so screenshots are
          // not taken mid-transition (§19). It reads only its own URL.
          dangerouslySetInnerHTML={{
            __html: `try{var p=new URLSearchParams(location.search);if(p.get("visualTest")==="1"){document.documentElement.setAttribute("data-visual-test","1")}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
