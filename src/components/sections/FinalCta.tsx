import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";

import styles from "./FinalCta.module.css";

/**
 * Section 08 — the screen returns to quiet darkness.
 *
 * A single seed and one destination. §7 allows exactly one CTA here, so there
 * is no secondary link, no newsletter field, no "or explore the docs".
 */
export function FinalCta() {
  return (
    <section className={styles.section} aria-labelledby="final-heading">
      <div className={styles.inner}>
        <span className={styles.seed} aria-hidden="true" />

        <h2 className={styles.heading} id="final-heading">
          Your forest begins
          <br />
          with one lesson.
        </h2>

        <Link href="/roadmap" className={styles.cta}>
          <PixelIcon name="arrowUpRight" size={16} />
          <span>첫 학습 시작</span>
        </Link>
      </div>
    </section>
  );
}
