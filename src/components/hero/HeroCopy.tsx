import { PixelIcon } from "@/components/brand/PixelIcon";
import { APP_URLS } from "@/lib/urls";

import styles from "./Hero.module.css";

/**
 * Hero copy block (§2).
 *
 * One headline, one description, one primary CTA. No badge, no category chip,
 * no secondary action, no scroll-hint arrow — §2 is explicit. The CTA leaves
 * for the product app; this site never runs a lesson itself.
 */
export function HeroCopy() {
  return (
    <div className={styles.copy}>
      <h1 className={styles.title} id="hero-heading">
        <span>LEARN.</span>
        <span>GROW.</span>
        <span>DEFEND.</span>
      </h1>

      <p className={styles.body}>
        보안을 배우고, 실전에서 증명하며,
        <br />
        당신만의 숲을 키우세요.
      </p>

      <a className={styles.primaryAction} href={APP_URLS.signup}>
        <PixelIcon name="arrowUpRight" size={12} />
        <span>학습 시작</span>
      </a>
    </div>
  );
}
