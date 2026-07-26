import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { AccessibleRoadmapList } from "@/components/roadmap/AccessibleRoadmapList";
import { RootMap } from "@/components/roadmap/RootMap";

import styles from "./RoadmapPreview.module.css";

/**
 * Section 03 — Roadmap: Paths Become Roots.
 *
 * Two representations of the same thing, deliberately: the root diagram for
 * comprehension, the list for navigation. §8.2 requires both to exist, and §20
 * forbids the diagram from being the only way in.
 */
export function RoadmapPreview() {
  return (
    <section className={styles.section} aria-labelledby="roadmap-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="roadmap-heading">
            Paths
            <br />
            Become Roots.
          </h2>
          <p className={styles.lede}>
            학습 경로는 계단이 아니라 뿌리망입니다. 기초에서 갈라지고, 서로를 지탱하며, 깊이
            내려갈수록 넓어집니다.
          </p>
        </header>

        <div className={styles.diagram}>
          <RootMap />
        </div>

        <AccessibleRoadmapList headingLevel="h3" />

        <Link href="/roadmap" className={styles.link}>
          <PixelIcon name="arrowRight" size={16} />
          전체 로드맵 보기
        </Link>
      </div>
    </section>
  );
}
