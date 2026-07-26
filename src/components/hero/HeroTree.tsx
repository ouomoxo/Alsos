import { compositionById } from "@/lib/hero/manifest";

import styles from "./Hero.module.css";

/**
 * The growing tree.
 *
 * A pre-rendered sprite sheet played with a CSS steps() timing function — no
 * WebGL, no animation library, no runtime particle system. The growth order is
 * baked into the frames from the skeleton's along-the-wood distances, so the
 * tree still grows root-to-tip through its own branches rather than being
 * wiped upward.
 *
 * Under reduced motion the animation is dropped and the last frame is pinned,
 * which is exactly the "final grown state, held still" requirement (§19).
 */
export function HeroTree() {
  // PR1 desktop frame; the responsive art lands with the other breakpoints.
  const composition = compositionById("desktop");
  const growth = composition.growth;

  return (
    <div
      className={styles.tree}
      aria-hidden="true"
      style={{
        left: `${growth.rect.x * 100}%`,
        top: `${growth.rect.y * 100}%`,
        width: `${growth.rect.width * 100}%`,
        height: `${growth.rect.height * 100}%`,
        backgroundImage: `url(${growth.src})`,
        // One frame tall per step, stacked vertically.
        backgroundSize: `100% ${growth.frames * 100}%`,
        // `jump-none` yields exactly `frames` positions including first and
        // last; plain steps() would never land on the finished tree.
        animationTimingFunction: `steps(${growth.frames}, jump-none)`,
      }}
    />
  );
}
