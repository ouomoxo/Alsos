import { compositionById } from "@/lib/hero/manifest";

import styles from "./Hero.module.css";

/**
 * Motes drifting in the shafts.
 *
 * The vault is still without them: light with nothing suspended in it reads as
 * a painted gradient rather than as air. Three layers at different scales and
 * speeds give parallax, which is what makes the space feel occupied rather
 * than merely lit.
 *
 * The mask is centred on the plate's break in the canopy, read from the
 * manifest rather than eyeballed — motes outside the light are only noise, and
 * a mask that has drifted off the light is worse than no mask at all.
 *
 * Pure CSS — each layer is a repeating radial-gradient of dots translated on a
 * long loop. No canvas, no JS, no per-frame work, and reduced motion simply
 * stops them.
 */
export function HeroMotes() {
  const { zenith } = compositionById("desktop");

  return (
    <div
      className={styles.motes}
      aria-hidden="true"
      style={{ "--zenith-x": `${zenith.x * 100}%`, "--zenith-y": `${zenith.y * 100}%` } as React.CSSProperties}
    >
      <span className={styles.moteLayer} data-layer="far" />
      <span className={styles.moteLayer} data-layer="mid" />
      <span className={styles.moteLayer} data-layer="near" />
    </div>
  );
}
