import { DOMAINS } from "@/lib/content/curriculum";

import styles from "./GardenMapping.module.css";

/**
 * Section 06 — Your Garden.
 *
 * The point of this section is the *mapping*, not the picture: what a learner
 * grew tells you what they can do. So it is laid out as a legend keyed to the
 * curriculum — read a garden, read a skill set. Ornament that decodes to
 * nothing would make the garden a wallpaper, which §7 rejects.
 */
export function GardenMapping() {
  return (
    <section className={styles.section} aria-labelledby="garden-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="garden-heading">
            Your Garden.
          </h2>
          <p className={styles.lede}>
            정원은 프로필 배경이 아니라 읽을 수 있는 인터페이스입니다. 무엇이 자랐는지 보면 무엇을
            할 수 있는지 알 수 있습니다.
          </p>
        </header>

        <dl className={styles.legend}>
          {DOMAINS.map((domain) => (
            <div key={domain.id} className={styles.row}>
              <dt className={styles.term}>
                <span className={styles.termKo}>{domain.nameKo}</span>
                <span className={styles.termEn}>{domain.name}</span>
              </dt>
              <dd className={styles.definition}>
                <span className={styles.expression}>{domain.gardenExpressionKo}</span>
                <span className={styles.expressionEn}>{domain.gardenExpression}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
