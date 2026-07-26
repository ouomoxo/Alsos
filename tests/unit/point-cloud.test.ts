import { describe, expect, it } from "vitest";

import { buildPointCloud, type TreeSkeleton } from "@/lib/webgl/point-cloud-loader";

/** A tiny hand-built skeleton: one root segment, one branch, two clusters. */
const SKELETON: TreeSkeleton = {
  version: 1,
  seed: "test",
  bounds: { minX: -1, maxX: 1, minY: -0.5, maxY: 2 },
  segments: [
    //x0  y0  x1  y1   w0    w1    p0   p1  lvl id root
    [0, 0, 0, 1, 0.05, 0.04, 0, 0.5, 0, 0, 0],
    [0, 1, 0.5, 2, 0.04, 0.01, 0.5, 1, 1, 1, 0],
    [0, 0, -0.4, -0.5, 0.03, 0.01, 0, 0.2, 0, 2, 1],
  ],
  clusters: [
    [0.5, 2, 0.3, 1, 1, 1],
    [-0.2, 1.6, 0.2, 0.6, 0.9, 3],
  ],
};

describe("buildPointCloud", () => {
  it("fills every attribute buffer to the requested count", () => {
    const cloud = buildPointCloud(SKELETON, 500, "seed-a");
    expect(cloud.count).toBe(500);
    expect(cloud.target).toHaveLength(1000);
    expect(cloud.scatter).toHaveLength(1000);
    expect(cloud.birth).toHaveLength(500);
    expect(cloud.size).toHaveLength(500);
    expect(cloud.brightness).toHaveLength(500);
    expect(cloud.seed).toHaveLength(500);
  });

  it("is deterministic for a given seed", () => {
    const a = buildPointCloud(SKELETON, 300, "same");
    const b = buildPointCloud(SKELETON, 300, "same");
    expect(Array.from(a.target)).toEqual(Array.from(b.target));
    expect(Array.from(a.birth)).toEqual(Array.from(b.birth));
  });

  it("keeps birth within 0..1 so the growth reveal cannot skip particles", () => {
    const cloud = buildPointCloud(SKELETON, 800, "seed-b");
    for (const b of cloud.birth) {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it("produces no NaN coordinates", () => {
    const cloud = buildPointCloud(SKELETON, 400, "seed-c");
    expect(Array.from(cloud.target).some(Number.isNaN)).toBe(false);
    expect(Array.from(cloud.scatter).some(Number.isNaN)).toBe(false);
  });

  it("shuffles so any prefix is a fair sample of the whole tree", () => {
    // The frame adaptor scales quality with setDrawRange, which is only valid
    // if the first N points are spread over the tree rather than being all
    // trunk. Compare the mean birth of a prefix against the full cloud.
    const cloud = buildPointCloud(SKELETON, 4000, "seed-d");
    const mean = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += cloud.birth[i]!;
      return sum / (to - from);
    };
    const prefix = mean(0, 400);
    const all = mean(0, 4000);
    expect(Math.abs(prefix - all)).toBeLessThan(0.08);
  });

  it("scatters particles away from their target so growth condenses inward", () => {
    const cloud = buildPointCloud(SKELETON, 200, "seed-e");
    let moved = 0;
    for (let i = 0; i < cloud.count; i++) {
      const dx = cloud.scatter[i * 2]! - cloud.target[i * 2]!;
      const dy = cloud.scatter[i * 2 + 1]! - cloud.target[i * 2 + 1]!;
      if (Math.hypot(dx, dy) > 0.01) moved++;
    }
    expect(moved).toBe(cloud.count);
  });
});
