import type { Metadata } from "next";
import Link from "next/link";

import { PixelIcon } from "@/components/brand/PixelIcon";
import { domainById } from "@/lib/content/curriculum";
import { LABS } from "@/lib/content/labs";

import styles from "./page.module.css";

export const metadata: Metadata = { title: "실습 Lab" };

/**
 * Lab catalogue.
 *
 * Presentation only, by direction: this lists what a Lab is and how it is
 * framed, but no execution environment is wired up behind it.
 */
export default function LabsPage() {
  return (
    <div className={styles.page}>
      <header>
        <h1 className={styles.heading}>실습 Lab</h1>
        <p className={styles.lede}>
          Lab은 숲속의 빈 공간입니다. 읽고, 시도하고, 결과로 증명합니다.
        </p>
        <p className={styles.notice}>
          <PixelIcon name="boundary" size={16} />
          현재는 화면 구성만 제공됩니다. 실행 환경은 연결되어 있지 않습니다.
        </p>
      </header>

      <ul className={styles.list}>
        {LABS.map((lab) => (
          <li key={lab.id} className={styles.item}>
            <Link href={`/labs/${lab.id}`} className={styles.link}>
              <span className={styles.number}>{String(lab.number).padStart(3, "0")}</span>
              <span className={styles.body}>
                <span className={styles.title}>{lab.title}</span>
                <span className={styles.objective}>{lab.objectiveKo}</span>
              </span>
              <span className={styles.meta}>
                <span className={styles.domain}>{domainById(lab.domain).nameKo}</span>
                <span className={styles.difficulty} aria-label={`난이도 ${lab.difficulty} / 3`}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <span key={i} className={styles.pip} data-on={i < lab.difficulty} />
                  ))}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
