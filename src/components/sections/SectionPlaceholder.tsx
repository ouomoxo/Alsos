import { PixelIcon } from "@/components/brand/PixelIcon";
import { APP_URLS } from "@/lib/urls";

import styles from "./SectionPlaceholder.module.css";

/**
 * A navigable page for a section that has not been built yet.
 *
 * §4 fixes the five navigation entries, but their pages land in a later PR.
 * Rather than ship links that 404 — or invent marketing copy to fill them —
 * each route states plainly what it will hold and keeps the one exit that
 * matters available.
 */
export function SectionPlaceholder({
  title,
  titleKo,
  summary,
}: {
  title: string;
  titleKo: string;
  summary: string;
}) {
  return (
    <div className={styles.page}>
      <p className={styles.eyebrow}>{title}</p>
      <h1 className={styles.heading}>{titleKo}</h1>
      <p className={styles.summary}>{summary}</p>
      <p className={styles.note}>이 페이지는 준비 중입니다.</p>
      <a className={styles.action} href={APP_URLS.signup}>
        <PixelIcon name="arrowUpRight" size={12} />
        <span>학습 시작</span>
      </a>
    </div>
  );
}
