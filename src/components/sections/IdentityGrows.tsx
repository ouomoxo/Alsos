import { ProfileTree } from "@/components/growth/ProfileTree";
import { GROWTH_STAGES } from "@/lib/content/curriculum";
import { exampleSnapshot } from "@/lib/growth/growth-model";

import styles from "./IdentityGrows.module.css";

/**
 * Section 05 — Identity Grows.
 *
 * The six stages, each drawn from a real snapshot through the same
 * `buildTreeGeometry` the profile page uses. They differ in root count, branch
 * direction and leaf density, not merely in scale — which is the specific thing
 * §7 asks for. Because the geometry is seeded, these illustrations are
 * byte-identical on every render, so they are safe for visual regression.
 */
export function IdentityGrows() {
  return (
    <section className={styles.section} aria-labelledby="identity-heading">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="identity-heading">
            Identity Grows.
          </h2>
          <p className={styles.lede}>
            단계가 오를수록 나무는 커지는 것이 아니라 복잡해집니다. 뿌리가 늘고, 가지가 방향을 갖고,
            나이테가 쌓입니다.
          </p>
        </header>

        <ol className={styles.stages}>
          {GROWTH_STAGES.map((stage, index) => {
            const snapshot = exampleSnapshot(stage.id);
            return (
              <li key={stage.id} className={styles.stage}>
                <div className={styles.figure}>
                  <ProfileTree snapshot={snapshot} size={160} label={null} />
                </div>
                <p className={styles.stageIndex}>{String(index + 1).padStart(2, "0")}</p>
                <h3 className={styles.stageName}>
                  {stage.label}
                  <span className={styles.stageNameKo}>{stage.labelKo}</span>
                </h3>
                <p className={styles.stageBody}>{stage.structureKo}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
