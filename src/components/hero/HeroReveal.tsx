import { compositionById } from "@/lib/hero/manifest";

import styles from "./Hero.module.css";

/**
 * The vault coming into light.
 *
 * The plate is the finished state — it is already fully lit — so an additive
 * layer can only ever make the hero *brighter* than its resting image, which
 * reads as a flash rather than as something arriving. The motion has to come
 * from shade being taken away instead.
 *
 * A soft dark disc, clear at the break and solid past its rim, scales outward
 * from the zenith and fades. What the eye sees is the light spreading through
 * the canopy from the gap to the corners, ending at exactly the artwork.
 *
 * The shade never goes fully black: the poster is the LCP element, and blanking
 * it for two seconds would make a fast hero feel slow. It only deepens the
 * outer field, so the plate is legible from the first frame.
 *
 * Its resting state is `opacity: 0`, and only the animation lifts it. That is
 * deliberate — if animations do not run at all, the failure is an invisible
 * element rather than a hero smothered in black.
 */
export function HeroReveal() {
  const { zenith } = compositionById("desktop");

  return (
    <div
      className={styles.reveal}
      aria-hidden="true"
      style={
        {
          "--zenith-x": `${zenith.x * 100}%`,
          "--zenith-y": `${zenith.y * 100}%`,
        } as React.CSSProperties
      }
    />
  );
}
