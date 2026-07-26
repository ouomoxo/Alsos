import { makeRng, gaussian, lerp, clamp01 } from "./rng.mjs";

/**
 * Recursive branch generator producing a skeleton with baked path distance.
 *
 * The path distance is the whole point (§10.1): every segment knows how far it
 * sits from the root *along the wood*, normalised to 0..1. The shader reveals
 * particles by comparing that value to uGrowth, so the tree grows outward
 * through its own branches instead of being wiped upward by a mask.
 */

const DEFAULTS = {
  seed: "alsos-hero-v1",
  /** Trunk length in normalised units (1 = full tree height). */
  trunkLength: 0.42,
  trunkWidth: 0.038,
  depth: 8,
  /** Child count per node, biased so the silhouette stays legible. */
  branchSplit: [3, 3, 3, 2, 2, 2, 2, 2],
  lengthDecay: 0.76,
  widthDecay: 0.68,
  /** Spread half-angle in radians, widening as we climb. */
  spread: 0.4,
  /** Upward bias keeps the canopy from drooping into a bush. */
  phototropism: 0.34,
  curve: 0.2,
  /**
   * Apical dominance: the first child continues the parent's line and stays
   * longer. Without it every fork is symmetric and the tree reads as a
   * fractal diagram rather than as wood.
   */
  leaderBias: 0.3,
  leaderLength: 1.12,
  /** Fraction of higher-order branches dropped, so the silhouette is uneven. */
  pruneChance: 0.1,
};

/**
 * @returns {{
 *   segments: Array<object>,
 *   clusters: Array<object>,
 *   maxPathLength: number,
 *   bounds: {minX:number,maxX:number,minY:number,maxY:number},
 * }}
 */
export function generateTree(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const rng = makeRng(cfg.seed);

  const segments = [];
  const clusters = [];
  let maxPathLength = 0;
  let nextBranchId = 0;

  const bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  const track = (x, y) => {
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  };

  /**
   * Grow one branch as a chain of short segments so it can curve, then recurse.
   * `angle` is measured from +Y (up); `pathLength` accumulates along the wood.
   */
  function grow(x, y, angle, length, width, level, pathLength, parentId) {
    const branchId = nextBranchId++;
    const steps = Math.max(2, 6 - level);
    const stepLen = length / steps;
    // Curvature is constant per branch, so a branch bends like a branch rather
    // than wobbling randomly (§2.5 bans random jitter).
    const curl = gaussian(rng, 0, cfg.curve) / steps;

    let cx = x;
    let cy = y;
    let ca = angle;
    let cw = width;
    let cPath = pathLength;

    for (let s = 0; s < steps; s++) {
      // Branches drift toward vertical as they thin out — real phototropism.
      ca += curl - ca * cfg.phototropism * (1 / steps) * (level / cfg.depth);
      const nx = cx + Math.sin(ca) * stepLen;
      const ny = cy + Math.cos(ca) * stepLen;
      const nw = cw * lerp(1, cfg.widthDecay, 1 / steps);
      const nPath = cPath + stepLen;

      segments.push({
        x0: cx,
        y0: cy,
        x1: nx,
        y1: ny,
        w0: cw,
        w1: nw,
        // Filled in as normalised values once the full tree is known.
        p0: cPath,
        p1: nPath,
        level,
        branchId,
        parentId,
      });

      track(nx, ny);
      cx = nx;
      cy = ny;
      ca = ca;
      cw = nw;
      cPath = nPath;
    }

    if (cPath > maxPathLength) maxPathLength = cPath;

    if (level >= cfg.depth) {
      // Tip: a foliage cluster, the source of leaf particles and spores.
      clusters.push({
        x: cx,
        y: cy,
        r: length * lerp(0.9, 1.6, rng()),
        density: lerp(0.55, 1, rng()),
        path: cPath,
        branchId,
        level,
      });
      return;
    }

    const splits = cfg.branchSplit[Math.min(level, cfg.branchSplit.length - 1)];
    // Spread widens with height so the canopy opens instead of staying a spike.
    const spread = cfg.spread * lerp(0.7, 1.4, level / cfg.depth);

    for (let i = 0; i < splits; i++) {
      const isLeader = i === 0;
      // Pruning is skipped for leaders, so a branch never terminates mid-air.
      // A pruned fork still puts out foliage — otherwise every prune punches a
      // bald patch in the crown.
      if (!isLeader && level > 2 && rng() < cfg.pruneChance) {
        clusters.push({
          x: cx,
          y: cy,
          r: length * lerp(0.9, 1.6, rng()),
          density: lerp(0.4, 0.8, rng()),
          path: cPath,
          branchId,
          level,
        });
        continue;
      }

      // The leader continues the parent's line, so the remaining children must
      // be spread across the *full* fan on their own. Indexing them by `i`
      // would hand the leader the -spread slot and push every real branch to
      // one side, which quietly makes the whole crown lean.
      const others = splits - 1;
      const j = i - 1;
      const offset = isLeader
        ? gaussian(rng, 0, spread * cfg.leaderBias)
        : (others === 1
            ? (rng() < 0.5 ? -1 : 1) * spread * lerp(0.65, 1, rng())
            : lerp(-spread, spread, j / (others - 1))) + gaussian(rng, 0, spread * 0.26);
      const childLen =
        length * cfg.lengthDecay * (isLeader ? cfg.leaderLength : 1) * lerp(0.8, 1.15, rng());
      const childWidth = cw * (isLeader ? lerp(0.82, 0.94, rng()) : lerp(0.55, 0.75, rng()));
      grow(cx, cy, ca + offset, childLen, childWidth, level + 1, cPath, branchId);
    }
  }

  // Roots first: they share the path-distance origin with the trunk so the glow
  // starts at the palm and travels both down into the roots and up the trunk.
  const rootCount = 7;
  for (let i = 0; i < rootCount; i++) {
    const a = lerp(Math.PI * 0.62, Math.PI * 1.38, i / (rootCount - 1));
    const jitter = gaussian(rng, 0, 0.1);
    growRoot(0, 0, a + jitter, cfg.trunkLength * lerp(0.3, 0.52, rng()), cfg.trunkWidth * 0.5, 0, 0);
  }

  function growRoot(x, y, angle, length, width, level, pathLength) {
    const branchId = nextBranchId++;
    const steps = 4;
    const stepLen = length / steps;
    const curl = gaussian(rng, 0, 0.22) / steps;
    let cx = x;
    let cy = y;
    let ca = angle;
    let cw = width;
    let cPath = pathLength;

    for (let s = 0; s < steps; s++) {
      ca += curl;
      const nx = cx + Math.sin(ca) * stepLen;
      const ny = cy + Math.cos(ca) * stepLen;
      const nw = cw * 0.72;
      const nPath = cPath + stepLen;
      segments.push({
        x0: cx,
        y0: cy,
        x1: nx,
        y1: ny,
        w0: cw,
        w1: nw,
        p0: cPath,
        p1: nPath,
        level,
        branchId,
        parentId: -1,
        isRoot: true,
      });
      track(nx, ny);
      cx = nx;
      cy = ny;
      cw = nw;
      cPath = nPath;
    }
    if (cPath > maxPathLength) maxPathLength = cPath;
    if (level < 1) {
      for (let i = 0; i < 2; i++) {
        growRoot(cx, cy, ca + gaussian(rng, 0, 0.34), length * 0.6, cw, level + 1, cPath);
      }
    }
  }

  grow(0, 0, 0, cfg.trunkLength, cfg.trunkWidth, 0, 0, -1);

  // Normalise path distance to 0..1 — this becomes aBirth.
  for (const s of segments) {
    s.p0 = clamp01(s.p0 / maxPathLength);
    s.p1 = clamp01(s.p1 / maxPathLength);
  }
  for (const c of clusters) {
    c.path = clamp01(c.path / maxPathLength);
  }

  return { segments, clusters, maxPathLength, bounds, config: cfg };
}

/**
 * Serialise to the compact form the browser downloads.
 *
 * Shipping the skeleton (~1500 segments) instead of a baked point cloud keeps
 * the deferred asset in the tens of KB; the client expands it to 18k–96k points
 * per capability tier at runtime. Numbers are rounded to 4 decimals because
 * beyond that we are paying bytes for sub-pixel noise.
 */
export function serializeTree(tree) {
  const r = (n) => Math.round(n * 1e4) / 1e4;
  return {
    version: 1,
    seed: tree.config.seed,
    bounds: {
      minX: r(tree.bounds.minX),
      maxX: r(tree.bounds.maxX),
      minY: r(tree.bounds.minY),
      maxY: r(tree.bounds.maxY),
    },
    // [x0,y0,x1,y1,w0,w1,p0,p1,level,branchId,isRoot]
    segments: tree.segments.map((s) => [
      r(s.x0),
      r(s.y0),
      r(s.x1),
      r(s.y1),
      r(s.w0),
      r(s.w1),
      r(s.p0),
      r(s.p1),
      s.level,
      s.branchId,
      s.isRoot ? 1 : 0,
    ]),
    // [x,y,r,density,path,branchId]
    clusters: tree.clusters.map((c) => [
      r(c.x),
      r(c.y),
      r(c.r),
      r(c.density),
      r(c.path),
      c.branchId,
    ]),
  };
}
