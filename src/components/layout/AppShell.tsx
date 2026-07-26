"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AlsosLogo } from "@/components/brand/AlsosLogo";
import { PixelIcon, type PixelIconName } from "@/components/brand/PixelIcon";

import styles from "./AppShell.module.css";

const NAV: { href: string; label: string; icon: PixelIconName }[] = [
  { href: "/dashboard", label: "대시보드", icon: "grid" },
  { href: "/roadmap", label: "로드맵", icon: "roots" },
  { href: "/labs", label: "실습 Lab", icon: "clearing" },
  { href: "/garden", label: "정원", icon: "garden" },
  { href: "/profile/alsos", label: "프로필", icon: "tree" },
];

/**
 * Product chrome. Visual intensity 4/10 (§1): the world-building recedes to a
 * background here and information comes first. No hero art, no particles, no
 * ambient motion — just a quiet rail and a content column.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link href="/" className={styles.brand} aria-label="ALSOS 홈">
          <AlsosLogo variant="symbol" title={null} width={22} height={22} />
        </Link>

        <nav aria-label="제품 메뉴">
          <ul className={styles.navList}>
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={styles.navLink}
                    data-active={active ? "true" : undefined}
                    aria-current={active ? "page" : undefined}
                  >
                    <PixelIcon name={item.icon} size={16} selected={active} />
                    <span className={styles.navLabel}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <main className={styles.main} id="main">
        {children}
      </main>
    </div>
  );
}
