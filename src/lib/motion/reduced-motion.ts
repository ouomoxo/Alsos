"use client";

import { useEffect, useState } from "react";

/**
 * Reduced motion is treated as a hard product requirement, not a nicety: at
 * `reduce` the hero shows the tree's *final* grown state as a still (§15), the
 * particle layer never starts, and no ambient loop runs.
 */
export function usePrefersReducedMotion(): boolean {
  // Start pessimistic so nothing animates during hydration on a machine that
  // has the preference set.
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

/** True when the tab is hidden — animation must stop entirely (§16). */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return visible;
}
