"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";

import { AlsosLogo } from "@/components/brand/AlsosLogo";
import { PixelIcon } from "@/components/brand/PixelIcon";

import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/roadmap", label: "로드맵", labelEn: "Roadmap" },
  { href: "/labs", label: "실습 Lab", labelEn: "Labs" },
  { href: "/garden", label: "정원", labelEn: "Garden" },
] as const;

/**
 * Minimal top navigation (§3.1).
 *
 * The mobile menu is a real focus-trapped dialog rather than a slide-out div —
 * §14 asks for an accessible full-screen Dialog, and React Aria gives us the
 * keyboard, focus and screen-reader behaviour without imposing any visual style
 * of its own (§11.1).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="ALSOS 홈">
          <AlsosLogo variant="horizontal" title={null} />
        </Link>

        <nav className={styles.nav} aria-label="주요 메뉴">
          <ul className={styles.navList}>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={styles.navLink}
                  // State is carried by an attribute and an underline, never by
                  // colour alone (§15).
                  data-active={isActive(item.href) ? "true" : undefined}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <Link href="/dashboard" className={styles.dashboardLink}>
            대시보드
          </Link>

          <DialogTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button className={styles.menuButton} aria-label="메뉴 열기">
              <PixelIcon name="menu" size={20} />
            </Button>
            <ModalOverlay className={styles.overlay} isDismissable>
              <Modal className={styles.modal}>
                <Dialog className={styles.dialog} aria-label="주요 메뉴">
                  {({ close }) => (
                    <>
                      <div className={styles.dialogHeader}>
                        <AlsosLogo variant="horizontal" title={null} />
                        <Button className={styles.menuButton} onPress={close} aria-label="메뉴 닫기">
                          <PixelIcon name="close" size={20} />
                        </Button>
                      </div>
                      <ul className={styles.dialogList}>
                        {NAV.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} className={styles.dialogLink} onClick={close}>
                              <span>{item.label}</span>
                              <span className={styles.dialogLinkEn}>{item.labelEn}</span>
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link href="/dashboard" className={styles.dialogLink} onClick={close}>
                            <span>대시보드</span>
                            <span className={styles.dialogLinkEn}>Dashboard</span>
                          </Link>
                        </li>
                      </ul>
                    </>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </div>
      </div>
    </header>
  );
}
