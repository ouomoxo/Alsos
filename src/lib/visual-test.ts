/**
 * Deterministic render mode for visual regression (§19).
 *
 *   ?visualTest=1   freeze everything time-based
 *   ?seed=42        pin every generated structure
 *   ?motion=0       force the reduced-motion path regardless of OS setting
 *
 * Playwright drives these so two runs of the same screen are byte-comparable.
 */

export type VisualTestConfig = {
  enabled: boolean;
  seed: string;
  /** false => behave as prefers-reduced-motion: reduce */
  motion: boolean;
  /** Frozen uTime value fed to shaders. */
  frozenTime: number;
  /** Frozen growth progress; 1 = fully grown. */
  frozenGrowth: number;
  /** Frozen pointer, in normalised viewport coords. */
  pointer: { x: number; y: number };
};

export const DEFAULT_VISUAL_TEST: VisualTestConfig = {
  enabled: false,
  seed: "alsos-hero-v1",
  motion: true,
  frozenTime: 0,
  frozenGrowth: 1,
  pointer: { x: -1, y: -1 },
};

export function parseVisualTest(search: string): VisualTestConfig {
  const params = new URLSearchParams(search);
  const enabled = params.get("visualTest") === "1";
  const motionParam = params.get("motion");

  return {
    enabled,
    seed: params.get("seed") ?? DEFAULT_VISUAL_TEST.seed,
    motion: motionParam === null ? DEFAULT_VISUAL_TEST.motion : motionParam !== "0",
    frozenTime: Number(params.get("t") ?? 0),
    frozenGrowth: Number(params.get("growth") ?? 1),
    pointer: DEFAULT_VISUAL_TEST.pointer,
  };
}

export function readVisualTest(): VisualTestConfig {
  if (typeof window === "undefined") return DEFAULT_VISUAL_TEST;
  return parseVisualTest(window.location.search);
}
