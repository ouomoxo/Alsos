/**
 * The hero timeline from §10.5, in one place.
 *
 * These are read by both the CSS reveal and the WebGL growth driver so the two
 * layers cannot drift apart. Content is never gated on any of them — the copy
 * and CTA are readable at 0ms and every value here only affects decoration.
 */
export const HERO_TIMELINE = {
  /** Poster and DOM text are painted. Nothing waits on JS. */
  posterVisible: 0,
  /** Headline settles in with a 12px rise. */
  headlineIn: 200,
  /** Earliest the canvas may cross-fade — only once it has a real frame. */
  canvasCrossfade: 400,
  /** Root glow ignites at the palm. */
  rootGlow: 500,
  /** uGrowth starts climbing from 0. */
  growthStart: 700,
  /** Main growth complete. */
  growthEnd: 2300,
  /** Ambient spores settle. */
  sporesSettled: 2600,
} as const;

export const HERO_GROWTH_DURATION = HERO_TIMELINE.growthEnd - HERO_TIMELINE.growthStart;

/** Ambient breathing cycle — 16-24s, deliberately near the edge of perception. */
export const AMBIENT_PERIOD_MS = 19000;

/** Mirrors --motion-* in tokens.css. Keep in sync. */
export const MOTION = {
  instant: 100,
  control: 180,
  reveal: 620,
  scene: 1400,
  ambient: 18000,
} as const;

export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  organic: [0.33, 0, 0.2, 1] as const,
};

/** cubic-bezier evaluation for driving non-CSS animation on the same curves. */
export function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Newton-Raphson; the curves here are well behaved so a few passes suffice.
    let t = x;
    for (let i = 0; i < 5; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-5) break;
      const d = sampleDerivativeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    return sampleY(t);
  };
}

export const easeOut = cubicBezier(...EASE.out);
export const easeOrganic = cubicBezier(...EASE.organic);
