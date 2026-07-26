import type { Metadata } from "next";

import { AccessibleRoadmapList } from "@/components/roadmap/AccessibleRoadmapList";
import { RootMap } from "@/components/roadmap/RootMap";
import { SAMPLE_ROADMAP_STATE } from "@/lib/content/sample-learner";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "로드맵" };

/**
 * §8.2: the roadmap is offered as two simultaneous representations — a root
 * network for comprehension and an accessible hierarchical list for
 * navigation. Both are always present; neither is a fallback for the other.
 */
export default function RoadmapPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>로드맵</h1>
        <p className={styles.lede}>
          기초에서 시작해 전문 분야로 갈라집니다. 각 경로의 상태는 아이콘, 텍스트, 선 패턴으로 함께
          표시됩니다.
        </p>
      </header>

      <div className={styles.diagram}>
        <RootMap />
      </div>

      <AccessibleRoadmapList states={SAMPLE_ROADMAP_STATE} headingLevel="h2" />
    </div>
  );
}
