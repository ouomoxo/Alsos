import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/sections/SectionPlaceholder";

export const metadata: Metadata = { title: "Roadmap" };

export default function RoadmapPage() {
  return (
    <SectionPlaceholder
      title="Roadmap"
      titleKo="학습 경로"
      summary="기초에서 전문 분야로 갈라지는 사이버보안 학습 영역을 뿌리 구조로 설명합니다."
    />
  );
}
