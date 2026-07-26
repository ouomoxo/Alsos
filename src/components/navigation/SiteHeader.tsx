"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from "react-aria-components";

import { AlsosLogo } from "@/components/brand/AlsosLogo";
import { PixelIcon } from "@/components/brand/PixelIcon";
import { APP_URLS } from "@/lib/urls";

import styles from "./SiteHeader.module.css";

/** §4. The reference's Dashboard button becomes Log in / Start Learning. */
const NAV = [
  { href: "/experience", label: "Experience" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/growth", label: "Growth" },
  { href: "/community", label: "Community" },
  { href: "/about", label: "About" },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className={styles.scrim} aria-hidden="true" />
      <header className={styles.header}>
        <Link href="/" className={styles.logo} aria-label="ALSOS 홈">
          <AlsosLogo variant="horizontal" title={null} height={18} />
        </Link>

        <nav className={styles.nav} aria-label="주요 메뉴">
          <ul className={styles.navList}>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          <a href={APP_URLS.login} className={styles.login}>
            Log in
          </a>
          <a href={APP_URLS.signup} className={styles.start}>
            Start Learning
          </a>

          {/* Mobile keeps only logo, menu and the primary action (§4). */}
          <DialogTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
            <Button className={styles.menuButton} aria-label="메뉴 열기">
              <PixelIcon name="menu" size={16} />
            </Button>
            <ModalOverlay className={styles.overlay} isDismissable>
              <Modal className={styles.modal}>
                <Dialog className={styles.dialog} aria-label="주요 메뉴">
                  {({ close }) => (
                    <>
                      <div className={styles.dialogHeader}>
                        <AlsosLogo variant="horizontal" title={null} height={18} />
                        <Button className={styles.menuButton} onPress={close} aria-label="메뉴 닫기">
                          <PixelIcon name="close" size={16} />
                        </Button>
                      </div>
                      <ul className={styles.dialogList}>
                        {NAV.map((item) => (
                          <li key={item.href}>
                            <Link href={item.href} className={styles.dialogLink} onClick={close}>
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <a href={APP_URLS.login} className={styles.dialogLogin}>
                        Log in
                      </a>
                    </>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </div>
      </header>
    </>
  );
}
