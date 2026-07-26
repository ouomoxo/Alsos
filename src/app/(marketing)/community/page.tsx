import type { Metadata } from "next";

import { SectionPlaceholder } from "@/components/sections/SectionPlaceholder";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <SectionPlaceholder
      title="Community"
      titleKo="커뮤니티"
      summary="시즌 이벤트와 CTF가 숲의 계절 변화로 표현되는 방식을 소개합니다."
    />
  );
}
