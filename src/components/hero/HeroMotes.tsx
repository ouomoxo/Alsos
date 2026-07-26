import styles from "./Hero.module.css";

/**
 * Motes drifting in the shafts.
 *
 * The grove is still without them: light with nothing suspended in it reads as
 * a painted gradient rather than as air. Three layers at different scales and
 * speeds give parallax, which is what makes the space feel occupied rather
 * than merely lit.
 *
 * Pure CSS — each layer is a repeating radial-gradient of dots translated on a
 * long loop. No canvas, no JS, no per-frame work, and reduced motion simply
 * stops them.
 */
export function HeroMotes() {
  return (
    <div className={styles.motes} aria-hidden="true">
      <span className={styles.moteLayer} data-layer="far" />
      <span className={styles.moteLayer} data-layer="mid" />
      <span className={styles.moteLayer} data-layer="near" />
    </div>
  );
}
