import { compositionById } from "@/lib/hero/manifest";

import styles from "./Hero.module.css";

/**
 * The vault opening.
 *
 * A pre-rendered sprite sheet played with a CSS steps() timing function — no
 * WebGL, no animation library, no runtime particle system. The growth order is
 * baked into the frames from the skeleton's along-the-wood distances, so the
 * canopy still opens outward from its trunks rather than being wiped across.
 *
 * The sheet traces the same limbs the plate draws in silhouette, so it cannot
 * simply be stretched to the frame: at any viewport that is not the plate's own
 * aspect the poster is cropped to cover and the sprite would slide off its own
 * wood. The stage reproduces that crop exactly — same aspect, same anchor,
 * sized to cover — using container units so it tracks the hero box rather than
 * the viewport.
 *
 * Under reduced motion the animation is dropped and the last frame is pinned,
 * which is exactly the "final grown state, held still" requirement (§19).
 */
export function HeroTree() {
  const composition = compositionById("desktop");
  const { growth, zenith, width, height } = composition;

  return (
    <div
      className={styles.treeStage}
      aria-hidden="true"
      style={
        {
          "--plate-aspect": `${width / height}`,
          "--anchor-x": `${zenith.x * 100}%`,
          "--anchor-y": `${zenith.y * 100}%`,
        } as React.CSSProperties
      }
    >
      <div
        className={styles.tree}
        data-layer="growth"
        style={{
          backgroundImage: `url(${growth.src})`,
          // One frame tall per step, stacked vertically.
          backgroundSize: `100% ${growth.frames * 100}%`,
          // `jump-none` yields exactly `frames` positions including first and
          // last; plain steps() would never land on the finished canopy.
          animationTimingFunction: `steps(${growth.frames}, jump-none)`,
        }}
      />
    </div>
  );
}
