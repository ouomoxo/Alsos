"use client";

import { useEffect, useState } from "react";

import styles from "./ReferenceOverlay.module.css";

/**
 * Development-only overlay for matching the canonical reference (§24).
 *
 *   ?referenceOverlay=1   show the reference on top at 50%
 *   R                     toggle the overlay
 *   D                     difference blend — anything non-black is drift
 *   G                     8px grid
 *   M                     freeze motion
 *
 * Difference mode is the one that actually settles arguments: at a correct
 * layout the text and the tree go black, and every mismatched edge lights up.
 */
export function ReferenceOverlay() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"blend" | "difference">("blend");
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVisible(params.get("referenceOverlay") === "1");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Never steal a keystroke from a real input.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      switch (event.key.toLowerCase()) {
        case "r":
          setVisible((v) => !v);
          break;
        case "d":
          setMode((m) => (m === "blend" ? "difference" : "blend"));
          break;
        case "g":
          setGrid((g) => !g);
          break;
        case "m":
          document.documentElement.toggleAttribute("data-visual-test");
          break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {grid && <div className={styles.grid} aria-hidden="true" />}
      {visible && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          className={styles.overlay}
          data-mode={mode}
          src="/assets/reference/hero-1536x605.png"
          alt=""
          aria-hidden="true"
        />
      )}
    </>
  );
}
