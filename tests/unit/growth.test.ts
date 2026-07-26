import { describe, expect, it } from "vitest";

import { GROWTH_STAGES } from "@/lib/content/curriculum";
import {
  exampleSnapshot,
  nextStageXp,
  stageForXp,
  stageProgress,
} from "@/lib/growth/growth-model";
import { buildTreeGeometry } from "@/lib/growth/growth-visualization";

describe("stageForXp", () => {
  it("starts at seed and lands on each stage at its own threshold", () => {
    expect(stageForXp(0)).toBe("seed");
    for (const stage of GROWTH_STAGES) {
      expect(stageForXp(stage.minXp)).toBe(stage.id);
    }
  });

  it("never regresses as XP increases", () => {
    let lastIndex = -1;
    for (let xp = 0; xp <= 60000; xp += 250) {
      const index = GROWTH_STAGES.findIndex((s) => s.id === stageForXp(xp));
      expect(index).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = index;
    }
  });

  it("saturates at the final stage", () => {
    const last = GROWTH_STAGES.at(-1)!;
    expect(stageForXp(last.minXp * 10)).toBe(last.id);
    expect(nextStageXp(last.minXp * 10)).toBeNull();
    expect(stageProgress(last.minXp * 10)).toBe(1);
  });
});

describe("stageProgress", () => {
  it("is 0 at a threshold and approaches 1 before the next one", () => {
    expect(stageProgress(GROWTH_STAGES[1]!.minXp)).toBe(0);
    const justBefore = GROWTH_STAGES[2]!.minXp - 1;
    expect(stageProgress(justBefore)).toBeGreaterThan(0.99);
  });

  it("stays within 0..1 across the whole range", () => {
    for (let xp = 0; xp <= 80000; xp += 137) {
      const p = stageProgress(xp);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

describe("buildTreeGeometry", () => {
  it("is deterministic — the same snapshot always yields the same tree", () => {
    // This is the §8.5 identity guarantee: a learner's tree must not reshuffle
    // between visits, and visual regression depends on it too.
    const snapshot = exampleSnapshot("canopy");
    const a = buildTreeGeometry(snapshot);
    const b = buildTreeGeometry(snapshot);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different structure for different seeds", () => {
    const base = exampleSnapshot("canopy");
    const other = { ...base, visualSeed: "vs_different" };
    expect(JSON.stringify(buildTreeGeometry(base))).not.toBe(
      JSON.stringify(buildTreeGeometry(other)),
    );
  });

  it("grows structurally, not just in scale, across stages", () => {
    const seed = buildTreeGeometry(exampleSnapshot("seed"));
    const grove = buildTreeGeometry(exampleSnapshot("sacred-grove"));
    // More roots, more branches, more leaves — not one tree at two sizes.
    expect(grove.roots.length).toBeGreaterThan(seed.roots.length);
    expect(grove.branches.length).toBeGreaterThan(seed.branches.length);
    expect(grove.leaves.length).toBeGreaterThan(seed.leaves.length);
  });

  it("ties root spread to the Foundations track", () => {
    const base = exampleSnapshot("sapling");
    const weak = buildTreeGeometry({ ...base, domainProgress: { foundations: 0 } });
    const strong = buildTreeGeometry({ ...base, domainProgress: { foundations: 1 } });
    expect(strong.roots.length).toBeGreaterThan(weak.roots.length);
  });

  it("emits one growth ring per five completed labs, capped", () => {
    const base = exampleSnapshot("sapling");
    const make = (n: number) =>
      buildTreeGeometry({
        ...base,
        completedLabIds: Array.from({ length: n }, (_, i) => `l${i}`),
      }).rings;
    expect(make(0)).toBe(0);
    expect(make(4)).toBe(0);
    expect(make(5)).toBe(1);
    expect(make(23)).toBe(4);
    expect(make(1000)).toBe(9);
  });
});
