import { HeroCopy } from "./HeroCopy";
import { HeroMotes } from "./HeroMotes";
import { HeroPoster } from "./HeroPoster";
import { HeroProductRail } from "./HeroProductRail";
import { HeroReveal } from "./HeroReveal";
import { HeroTree } from "./HeroTree";
import styles from "./Hero.module.css";

/**
 * Section 01 — Germination.
 *
 * Layers, none of them 3D:
 *   1.  HeroPoster  the canopy and the break in it, as a still
 *   1b. HeroReveal  shade opening from the break outward, pure CSS
 *   2.  HeroTree    the gaps catching light, a sprite played with CSS steps()
 *   2b. HeroMotes   air, as three drifting CSS layers
 *   3.  this DOM    every word, link and control as real HTML
 *
 * Laid out against the 1536x605 canonical reference (§6). Layers 1 and 3 are
 * complete on their own; if neither animated layer loads there is still a
 * finished hero underneath them.
 */
export function Hero({ visualTest = false }: { visualTest?: boolean }) {
  return (
    <section
      className={styles.hero}
      aria-labelledby="hero-heading"
      data-visual-test={visualTest ? "1" : undefined}
    >
      <HeroPoster />
      <HeroReveal />
      <HeroTree />
      <HeroMotes />

      <HeroCopy />
      <HeroProductRail />

      <p className={styles.microcopyLeft}>
        <span>Every lesson leaves a ring.</span>
        <span className={styles.microcopyKo}>배움은 나이테로 남습니다.</span>
      </p>
      <p className={styles.microcopyRight}>Rooted in knowledge.</p>
    </section>
  );
}
