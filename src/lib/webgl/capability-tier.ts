/**
 * Particle budget, decided by measurement.
 *
 * §10.4 is explicit that tiers must come from real frame timing, not from
 * sniffing the device. So we build the buffer once at a ceiling, start
 * conservatively, and then move the draw range up or down based on what the
 * machine actually sustains. Because the point cloud is shuffled, any prefix of
 * it is a uniform sample of the whole tree — scaling the count is a single
 * `setDrawRange` call with no rebuild and no visible restructuring.
 */

export type Tier = "high" | "mid" | "low" | "static";

export type TierBudget = {
  /** Points the buffer is built with — the ceiling for this session. */
  ceiling: number;
  /** Where we start drawing before any measurement exists. */
  initial: number;
  minimum: number;
  maxDpr: number;
};

export const TIER_BUDGETS: Record<Exclude<Tier, "static">, TierBudget> = {
  high: { ceiling: 120_000, initial: 70_000, minimum: 30_000, maxDpr: 1.5 },
  mid: { ceiling: 70_000, initial: 40_000, minimum: 18_000, maxDpr: 1.25 },
  low: { ceiling: 25_000, initial: 12_000, minimum: 6_000, maxDpr: 1 },
};

/**
 * Starting tier. This is a *starting point only* — the adaptor below moves the
 * count within the tier after measuring. Coarse viewport class is used rather
 * than a device name or user-agent string.
 */
export function initialTier(width: number, reducedMotion: boolean): Tier {
  if (reducedMotion) return "static";
  if (typeof window !== "undefined" && !hasWebGL()) return "static";
  if (width < 768) return "low";
  if (width < 1440) return "mid";
  return "high";
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

/** Target frame budgets. Desktop aims at 60fps, phones at a stable 30fps. */
export const FRAME_BUDGET_MS = { desktop: 16.7, mobile: 33.3 } as const;

export type FrameAdaptor = {
  /** Feed every frame's delta. Returns a new count when it decides to change. */
  sample(deltaMs: number): number | null;
  current(): number;
};

/**
 * Rolling frame-time adaptor.
 *
 * Averages a window of frames (the spec's 60–120 frame guidance), then nudges
 * the particle count. It backs off hard and recovers slowly, so a single
 * stutter does not thrash the buffer size.
 */
export function createFrameAdaptor(budget: TierBudget, targetMs: number): FrameAdaptor {
  let count = budget.initial;
  let accumulated = 0;
  let frames = 0;
  // Ignore the first frames entirely: shader compile and buffer upload land
  // there and would mis-measure the steady state.
  let warmup = 20;
  const WINDOW = 90;

  return {
    current: () => count,
    sample(deltaMs: number) {
      if (warmup > 0) {
        warmup -= 1;
        return null;
      }
      accumulated += deltaMs;
      frames += 1;
      if (frames < WINDOW) return null;

      const average = accumulated / frames;
      accumulated = 0;
      frames = 0;

      let next = count;
      if (average > targetMs * 1.25) {
        next = Math.max(budget.minimum, Math.round(count * 0.7));
      } else if (average < targetMs * 0.72 && count < budget.ceiling) {
        next = Math.min(budget.ceiling, Math.round(count * 1.15));
      }

      if (next === count) return null;
      count = next;
      return count;
    },
  };
}
