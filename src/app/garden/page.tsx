import type { Metadata } from "next";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { DOMAINS } from "@/lib/content/curriculum";
import { SAMPLE_SNAPSHOT } from "@/lib/content/sample-learner";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "정원" };

/**
 * Garden — presentation only, by direction.
 *
 * The plot, the legend and the inventory are laid out so the 2.5D plan (§8.4)
 * is legible, but no editing is wired up: no drag, no rotate, no undo stack,
 * no persistence. The controls below are shown as a disabled toolbar rather
 * than as buttons that silently do nothing when pressed.
 */
export default function GardenPage() {
  const unlocked = new Set(SAMPLE_SNAPSHOT.unlockedGardenItemIds);

  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.heading}>정원</h1>
        <p className={styles.lede}>
          정원은 배경 장식이 아니라 학습 이력을 공간으로 읽는 인터페이스입니다. 무엇이 자랐는지가
          무엇을 할 수 있는지를 나타냅니다.
        </p>
        <p className={styles.notice}>
          <PixelIcon name="boundary" size={16} />
          화면 구성 미리보기입니다. 배치 편집은 아직 동작하지 않습니다.
        </p>
      </header>

      {/* A 2.5D plot, drawn as an isometric grid. Static. */}
      <div className={styles.plot}>
        <svg viewBox="0 0 900 460" className={styles.plotSvg} aria-hidden="true">
          <g className={styles.grid}>
            {Array.from({ length: 11 }, (_, i) => {
              const t = i / 10;
              return (
                <g key={i}>
                  <line x1={450 - t * 420} y1={90 + t * 210} x2={450 + (1 - t) * 420} y2={300 - (1 - t) * 210} />
                  <line x1={450 - (1 - t) * 420} y1={300 - (1 - t) * 210} x2={450 + t * 420} y2={90 + t * 210} />
                </g>
              );
            })}
          </g>
          <g className={styles.plantings}>
            <rect x={446} y={186} width={8} height={8} />
            <rect x={330} y={230} width={4} height={4} />
            <rect x={560} y={214} width={4} height={4} />
            <rect x={392} y={150} width={4} height={4} />
          </g>
        </svg>

        <div className={styles.toolbar} role="group" aria-label="정원 편집 도구 (비활성)">
          {["배치", "회전", "정렬 그리드", "되돌리기", "다시 실행"].map((tool) => (
            <button key={tool} type="button" className={styles.tool} disabled>
              {tool}
            </button>
          ))}
          <span className={styles.toolNote}>편집 기능 준비 중</span>
        </div>
      </div>

      <section aria-labelledby="inventory-heading">
        <h2 className={styles.sectionHeading} id="inventory-heading">
          해금 현황
        </h2>
        <ul className={styles.inventory}>
          {DOMAINS.map((domain) => {
            const progress = SAMPLE_SNAPSHOT.domainProgress[domain.id] ?? 0;
            const isUnlocked = progress > 0;
            return (
              <li key={domain.id} className={styles.inventoryItem} data-unlocked={isUnlocked}>
                <PixelIcon name={isUnlocked ? "spore" : "locked"} size={16} selected={isUnlocked} />
                <span className={styles.inventoryName}>{domain.nameKo}</span>
                <span className={styles.inventoryExpression}>{domain.gardenExpressionKo}</span>
                <span className={styles.inventoryState}>{isUnlocked ? "성장 중" : "미해금"}</span>
              </li>
            );
          })}
        </ul>
        <p className={styles.inventoryNote}>
          해금된 장식 {unlocked.size}종 · 판정은 서버 상태를 기준으로 합니다.
        </p>
      </section>
    </div>
  );
}
