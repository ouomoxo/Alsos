import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/sections/SectionPlaceholder";

export const metadata: Metadata = { title: "Experience" };

export default function ExperiencePage() {
  return (
    <SectionPlaceholder
      title="Experience"
      titleKo="학습 경험"
      summary="배우고, 실전에서 증명하고, 그 결과가 숲으로 남는 과정을 화면 단위로 소개합니다."
    />
  );
}
