import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { DOMAIN_COUNT, GROWTH_STAGE_COUNT } from "@/lib/content/curriculum";

import { HeroPoster } from "./HeroPoster";
import { HeroSceneMount } from "./HeroSceneMount";
import styles from "./Hero.module.css";

/**
 * Section 01 — Germination.
 *
 * Three independent layers (§9), composited in this order:
 *   1. HeroPoster    static art, LCP, works with zero JS
 *   2. HeroSceneMount  transparent WebGL particles, lazy, entirely optional
 *   3. this DOM       every word, link and control as real HTML
 *
 * Nothing below the canvas layer depends on it. Delete layer 2 and the hero is
 * still complete — which is the §21.4 acceptance condition.
 */
export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <HeroPoster />
      <HeroSceneMount />

      <div className={styles.content}>
        <div className={styles.copy}>
          {/* One headline, one description, one CTA. No badge, no chip, no
              pretitle — §4 is explicit about this. */}
          <h1 className={styles.headline} id="hero-heading">
            <span className={styles.headlineLine}>LEARN.</span>
            <span className={styles.headlineLine}>GROW.</span>
            <span className={styles.headlineLine}>DEFEND.</span>
          </h1>

          <p className={styles.description}>
            보안을 배우고, 실전 랩에서 증명하며,
            <br />
            당신만의 숲을 키우세요.
          </p>

          <Link href="/roadmap" className={styles.cta}>
            <PixelIcon name="arrowUpRight" size={16} />
            <span>학습 시작</span>
          </Link>
        </div>

        {/*
          The reference puts platform metrics here. We have no learners yet, and
          §3.2 forbids decorative fake numbers — so this rail carries the two
          counts that are actually true, both derived from the curriculum file.
        */}
        <aside className={styles.rail} aria-label="플랫폼 구성">
          <dl className={styles.railList}>
            <div className={styles.railItem}>
              <dt className={styles.railLabel}>
                <PixelIcon name="roots" size={16} />
                학습 경로
              </dt>
              <dd className={styles.railValue}>{String(DOMAIN_COUNT).padStart(2, "0")}</dd>
            </div>
            <div className={styles.railItem}>
              <dt className={styles.railLabel}>
                <PixelIcon name="tree" size={16} />
                성장 단계
              </dt>
              <dd className={styles.railValue}>{String(GROWTH_STAGE_COUNT).padStart(2, "0")}</dd>
            </div>
          </dl>
        </aside>

        <p className={styles.microcopy}>
          <span>Every lesson leaves a ring.</span>
          <span className={styles.microcopyKo}>배움은 나이테로 남습니다.</span>
        </p>
      </div>
    </section>
  );
}
