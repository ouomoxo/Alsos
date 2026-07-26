import Link from "next/link";

import { AlsosLogo } from "@/components/brand/AlsosLogo";

import styles from "./Footer.module.css";

const COLUMNS = [
  {
    title: "학습",
    links: [
      { href: "/roadmap", label: "로드맵" },
      { href: "/labs", label: "실습 Lab" },
      { href: "/dashboard", label: "대시보드" },
    ],
  },
  {
    title: "성장",
    links: [
      { href: "/garden", label: "정원" },
      { href: "/profile/alsos", label: "프로필" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <AlsosLogo variant="horizontal" title={null} />
          <p className={styles.etymology}>
            <span lang="grc">ἄλσος</span> — 숲, 작은 숲, 신성한 숲.
          </p>
        </div>

        <nav className={styles.nav} aria-label="사이트 맵">
          {COLUMNS.map((column) => (
            <div key={column.title} className={styles.column}>
              <h2 className={styles.columnTitle}>{column.title}</h2>
              <ul className={styles.columnList}>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.link}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <p className={styles.microcopy}>Every lesson leaves a ring.</p>
    </footer>
  );
}
