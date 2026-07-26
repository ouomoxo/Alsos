import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/sections/SectionPlaceholder";

export const metadata: Metadata = { title: "Growth" };

export default function GrowthPage() {
  return (
    <SectionPlaceholder
      title="Growth"
      titleKo="성장"
      summary="학습 기록이 프로필 나무와 정원의 형태로 어떻게 축적되는지 보여줍니다."
    />
  );
}
