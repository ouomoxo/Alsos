import { STRUCTURE_MAP } from "@/lib/content/curriculum";

import styles from "./RootStructure.module.css";

/**
 * Section 02 — Knowledge Takes Root.
 *
 * §7 rules out the three-column feature grid here: this has to be one thick
 * root structure with the explanation arranged around it. So the section is a
 * single continuous SVG spine, and the six meanings are anchored to points on
 * it — the diagram *is* the layout, not an illustration beside it.
 */
export function RootStructure() {
  return (
    <section className={styles.section} aria-labelledby="structure-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="structure-heading">
            Knowledge
            <br />
            Takes Root.
          </h2>
          <p className={styles.lede}>
            ALSOS의 학습 구조는 목록이 아니라 하나의 나무입니다. 기초가 뿌리를 만들고, 뿌리가 줄기를
            지탱하며, 줄기에서 전문 분야가 갈라집니다.
          </p>
        </header>

        <div className={styles.diagram}>
          <svg
            className={styles.spine}
            viewBox="0 0 100 620"
            preserveAspectRatio="xMidYMin meet"
            aria-hidden="true"
          >
            {/* One continuous trunk from the hero's roots up into the canopy. */}
            <path
              className={styles.trunk}
              d="M50 620 L50 470 M50 470 L50 300 M50 300 L50 140 M50 140 L50 0"
            />
            {/* Roots fanning out at the bottom, continuing the hero's root line. */}
            <path className={styles.root} d="M50 620 L18 700 M50 620 L50 712 M50 620 L82 700" />
            {/* Limbs at each anchor point. */}
            <path className={styles.limb} d="M50 470 L14 430 M50 470 L86 436" />
            <path className={styles.limb} d="M50 300 L18 258 M50 300 L82 264" />
            <path className={styles.limb} d="M50 140 L22 104 M50 140 L78 110" />
            <g className={styles.nodes}>
              {[620, 470, 300, 140].map((y) => (
                <rect key={y} x={46} y={y - 4} width={8} height={8} />
              ))}
            </g>
          </svg>

          <ol className={styles.map}>
            {STRUCTURE_MAP.map((entry) => (
              <li key={entry.partEn} className={styles.mapItem}>
                <span className={styles.mapPart}>{entry.part}</span>
                <span className={styles.mapPartEn}>{entry.partEn}</span>
                <span className={styles.mapMeaning}>{entry.meaningKo}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
