import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/sections/SectionPlaceholder";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <SectionPlaceholder
      title="About"
      titleKo="소개"
      summary="ἄλσος — 숲, 작은 숲, 신성한 숲. 이름과 세계관의 배경입니다."
    />
  );
}
