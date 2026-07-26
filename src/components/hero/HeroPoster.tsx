import { compositionById, heroCompositions, srcSet } from "@/lib/hero/manifest";
import styles from "./HeroPoster.module.css";

/**
 * Layer 1 of the hero (§9): the static art.
 *
 * This is the LCP element and the final fallback. It is a plain <picture> with
 * no JavaScript in its path — if the bundle never loads, if WebGL throws, if
 * the device is a low-power phone, this still renders a finished hero.
 *
 * Each aspect ratio gets its own art, not a crop of the desktop frame (§13.2),
 * so the <source> media queries match the compositions the generator produced.
 */
export function HeroPoster() {
  // The desktop frame is the <img> fallback, used when a browser ignores
  // every <source>.
  const fallback = compositionById("desktop");

  return (
    <div className={styles.poster} aria-hidden="true">
      <picture>
        {heroCompositions.map((comp) => (
          <source
            key={comp.id}
            media={comp.media}
            type="image/avif"
            srcSet={srcSet(comp.poster.avif)}
            sizes="100vw"
            width={comp.width}
            height={comp.height}
          />
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={fallback.poster.webp.at(-1)?.src}
          srcSet={srcSet(fallback.poster.webp)}
          sizes="100vw"
          width={fallback.width}
          height={fallback.height}
          alt=""
          // The hero art must never wait its turn — it is the LCP candidate.
          fetchPriority="high"
          decoding="sync"
          style={{ backgroundImage: `url(${fallback.lqip})` }}
        />
      </picture>
    </div>
  );
}
