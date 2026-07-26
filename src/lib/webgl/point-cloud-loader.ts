import { makeRng } from "@/lib/rng";

/**
 * Expands the tree skeleton into GPU buffers.
 *
 * The network only ever carries the skeleton (~3k segments, ~63 KB gzipped);
 * the point cloud itself is built here. Shipping a baked cloud would mean
 * megabytes per tier — this way one small asset serves every tier and the
 * expansion is deterministic from the seed.
 */

export type TreeSkeleton = {
  version: number;
  seed: string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** [x0,y0,x1,y1,w0,w1,p0,p1,level,branchId,isRoot] */
  segments: number[][];
  /** [x,y,r,density,path,branchId] */
  clusters: number[][];
};

export type PointCloud = {
  count: number;
  target: Float32Array;
  scatter: Float32Array;
  birth: Float32Array;
  size: Float32Array;
  brightness: Float32Array;
  seed: Float32Array;
  /** Tree-local height, used to derive the render scale. */
  maxY: number;
};

const SEG = {
  x0: 0, y0: 1, x1: 2, y1: 3, w0: 4, w1: 5, p0: 6, p1: 7, level: 8, branchId: 9, isRoot: 10,
} as const;

const CL = { x: 0, y: 1, r: 2, density: 3, path: 4 } as const;

export async function fetchSkeleton(url: string, signal?: AbortSignal): Promise<TreeSkeleton> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Hero skeleton ${response.status}`);
  return (await response.json()) as TreeSkeleton;
}

/**
 * @param count total points to generate; roughly 45% land on wood and the rest
 *              in foliage, matching the poster's balance.
 */
export function buildPointCloud(skeleton: TreeSkeleton, count: number, seed: string): PointCloud {
  const rng = makeRng(`${seed}:cloud`);

  const target = new Float32Array(count * 2);
  const scatter = new Float32Array(count * 2);
  const birth = new Float32Array(count);
  const size = new Float32Array(count);
  const brightness = new Float32Array(count);
  const seeds = new Float32Array(count);

  const woodCount = Math.floor(count * 0.45);

  // Weighted sampling over segments: dense trunk, sparse twigs. A uniform grid
  // is explicitly ruled out (§10.4).
  const weights = skeleton.segments.map((s) => {
    const len = Math.hypot(s[SEG.x1]! - s[SEG.x0]!, s[SEG.y1]! - s[SEG.y0]!);
    return len * Math.pow((s[SEG.w0]! + s[SEG.w1]!) * 0.5, 0.55);
  });
  const segCdf = buildCdf(weights);

  const clusterWeights = skeleton.clusters.map((c) => c[CL.density]!);
  const clusterCdf = buildCdf(clusterWeights);

  let i = 0;

  for (; i < woodCount; i++) {
    const seg = skeleton.segments[sampleCdf(segCdf, rng())]!;
    const t = rng();
    const lx = lerp(seg[SEG.x0]!, seg[SEG.x1]!, t);
    const ly = lerp(seg[SEG.y0]!, seg[SEG.y1]!, t);
    const w = lerp(seg[SEG.w0]!, seg[SEG.w1]!, t);
    const b = lerp(seg[SEG.p0]!, seg[SEG.p1]!, t);

    // Scatter across the branch thickness grows toward the tips, so the trunk
    // is solid light and the twigs dissolve into spores.
    const spread = lerp(0.55, 2.2, Math.pow(b, 1.5));
    const off = (rng() + rng() + rng() - 1.5) * spread;
    const core = clamp01(1 - Math.abs(off) / 1.4);

    write(i, lx + off * w, ly + (rng() - 0.5) * w * spread * 0.8);
    birth[i] = b;
    size[i] = lerp(1.1, 2.6, core) * (seg[SEG.isRoot] ? 0.9 : 1);
    brightness[i] = lerp(0.18, 1, core * core) * lerp(1, 0.45, b) * lerp(0.7, 1.15, rng());
    seeds[i] = rng();
  }

  for (; i < count; i++) {
    const cluster = skeleton.clusters[sampleCdf(clusterCdf, rng())]!;
    const angle = rng() * Math.PI * 2;
    const radius = Math.pow(rng(), 0.42) * cluster[CL.r]! * lerp(0.85, 1.35, rng());
    const falloff = clamp01(1 - radius / (cluster[CL.r]! * 1.35));

    write(i, cluster[CL.x]! + Math.cos(angle) * radius, cluster[CL.y]! + Math.sin(angle) * radius * 0.8);
    birth[i] = cluster[CL.path]!;
    size[i] = lerp(0.9, 1.9, rng());
    brightness[i] = Math.pow(falloff, 1.1) * lerp(0.2, 0.75, rng()) * cluster[CL.density]!;
    seeds[i] = rng();
  }

  function write(index: number, x: number, y: number) {
    target[index * 2] = x;
    target[index * 2 + 1] = y;
    // Ungrown particles wait scattered outward from where they will land, so
    // growth reads as material condensing rather than as points sliding in.
    const angle = rng() * Math.PI * 2;
    const distance = lerp(0.04, 0.3, rng());
    scatter[index * 2] = x + Math.cos(angle) * distance;
    scatter[index * 2 + 1] = y + Math.sin(angle) * distance;
  }

  // Shuffle so that drawing only the first N points is still a fair sample of
  // the whole tree. This is what lets the frame adaptor change the count with
  // setDrawRange instead of rebuilding buffers.
  shuffle(count, rng, (a, b) => {
    swap2(target, a, b);
    swap2(scatter, a, b);
    swap1(birth, a, b);
    swap1(size, a, b);
    swap1(brightness, a, b);
    swap1(seeds, a, b);
  });

  return {
    count,
    target,
    scatter,
    birth,
    size,
    brightness,
    seed: seeds,
    maxY: skeleton.bounds.maxY,
  };
}

/* ------------------------------------------------------------- helpers --- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function buildCdf(weights: number[]): Float64Array {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const cdf = new Float64Array(weights.length);
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]! / total;
    cdf[i] = acc;
  }
  return cdf;
}

function sampleCdf(cdf: Float64Array, r: number): number {
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid]! < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function shuffle(count: number, rng: () => number, swapAt: (a: number, b: number) => void) {
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    if (i !== j) swapAt(i, j);
  }
}

function swap1(arr: Float32Array, a: number, b: number) {
  const t = arr[a]!;
  arr[a] = arr[b]!;
  arr[b] = t;
}

function swap2(arr: Float32Array, a: number, b: number) {
  const ax = arr[a * 2]!;
  const ay = arr[a * 2 + 1]!;
  arr[a * 2] = arr[b * 2]!;
  arr[a * 2 + 1] = arr[b * 2 + 1]!;
  arr[b * 2] = ax;
  arr[b * 2 + 1] = ay;
}
