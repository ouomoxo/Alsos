import styles from "./Hero.module.css";

/**
 * The right rail (§3).
 *
 * The reference puts platform statistics here. ALSOS has no verified learner
 * count, success rate or lab total, and §3 rules out inventing them — so the
 * rail carries the three product principles instead. Same visual weight, same
 * position, nothing claimed that cannot be substantiated.
 */
const PRINCIPLES = [
  { index: "01", label: "STRUCTURED PATHS" },
  { index: "02", label: "HANDS-ON PRACTICE" },
  { index: "03", label: "LIVING PROFILE" },
] as const;

export function HeroProductRail() {
  return (
    <aside className={styles.productRail} aria-label="ALSOS 핵심 개념">
      <ol className={styles.railList}>
        {PRINCIPLES.map((item) => (
          <li key={item.index} className={styles.railItem}>
            <span className={styles.railIndex}>{item.index}</span>
            <span className={styles.railLabel}>{item.label}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
