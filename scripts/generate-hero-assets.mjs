#!/usr/bin/env node
/**
 * ALSOS hero asset pipeline.
 *
 * Produces every file listed in §13 from a single seed:
 *   - the composed poster (AVIF + WebP + a tiny LQIP) per aspect ratio
 *   - tree / hand / glow / spore / foreground / background / occlusion masks
 *   - a 16-bit depth map
 *   - the tree skeleton the WebGL layer expands into a point cloud
 *   - a manifest binding it all together, including the sampled palette
 *
 * The poster and the particle layer are drawn from the *same* skeleton, so when
 * the canvas cross-fades in (§10.5) nothing shifts. Replacing this with painted
 * artwork later means matching the manifest contract, not rewriting components.
 *
 *   npm run assets:hero
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { makeRng, makeFbm2D, lerp, clamp01, smoothstep, gaussian } from "./lib/rng.mjs";
import { generateTree, serializeTree } from "./lib/tree.mjs";
import {
  Raster,
  drawCapsule,
  splat,
  ditherQuantise,
  toRGBA8,
  maskToGray8,
  depthToGray16,
} from "./lib/raster.mjs";
import { drawHand, handSporeField } from "./lib/hand.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "hero");
/**
 * Masks and the depth map are §13.1 deliverables and the input to any future
 * re-composition, but nothing at runtime fetches them. They live outside
 * public/ so ~8 MB of PNG never reaches the CDN or a deploy bundle.
 */
const ART_OUT = path.join(ROOT, "art", "hero");
const SEED = "alsos-hero-v1";

/* ------------------------------------------------------------- palette --- */

const hexToLinear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return srgb.map((v) => Math.pow(v, 2.2));
};

const PALETTE = {
  void: hexToLinear("#070908"),
  night: hexToLinear("#0b0f0c"),
  canopy: hexToLinear("#111811"),
  mossDeep: hexToLinear("#26301f"),
  moss: hexToLinear("#68743c"),
  lichen: hexToLinear("#aeb760"),
  spore: hexToLinear("#d9dd7a"),
  sporeBright: hexToLinear("#e5e98d"),
};

/* -------------------------------------------------------- compositions --- */

/**
 * Each aspect ratio is composed independently (§13.2). The mobile frame is not
 * a crop of the desktop frame: the tree sits high, the copy safe area moves to
 * the bottom, and the right-hand metrics rail disappears entirely.
 */
const COMPOSITIONS = [
  {
    id: "desktop-ultrawide",
    width: 3200,
    height: 1400,
    media: "(min-width: 1600px)",
    light: { x: 0.552, y: -0.06 },
    palm: { x: 0.575, y: 0.735 },
    treeHeight: 0.62,
    handScale: 0.3,
    handRotation: -0.06,
    trunks: 150,
    atmosphere: 1,
    /** Regions kept dark and low-noise for DOM text. */
    safe: [
      { edge: "left", extent: 0.47, strength: 0.93 },
      { edge: "right", extent: 0.15, strength: 0.6 },
    ],
  },
  {
    id: "desktop-standard",
    width: 2560,
    height: 1600,
    media: "(min-width: 768px)",
    light: { x: 0.565, y: -0.05 },
    palm: { x: 0.588, y: 0.755 },
    treeHeight: 0.56,
    handScale: 0.3,
    handRotation: -0.05,
    trunks: 132,
    atmosphere: 0.95,
    safe: [
      { edge: "left", extent: 0.5, strength: 0.92 },
      { edge: "right", extent: 0.14, strength: 0.55 },
    ],
  },
  {
    id: "mobile-portrait",
    width: 1600,
    height: 2000,
    media: "(max-width: 767px)",
    light: { x: 0.5, y: -0.03 },
    // Tree sits in the upper third; the copy owns the bottom of the frame.
    palm: { x: 0.5, y: 0.535 },
    treeHeight: 0.42,
    handScale: 0.24,
    handRotation: 0,
    trunks: 95,
    atmosphere: 0.72,
    safe: [{ edge: "bottom", extent: 0.58, strength: 0.9 }],
  },
];

/* ------------------------------------------------------------ safe area --- */

/**
 * Text safe areas are edge gradients, never rectangles.
 *
 * Full strength sits hard against the frame edge and falls to zero across
 * `extent`, so the artwork keeps a continuous surface — a boxed region would
 * put a visible seam through the middle of the forest, which is exactly the
 * "colour plate over the image" §3.2 forbids.
 */
function safeMultiplier(comp, x, y) {
  const u = x / comp.width;
  const v = y / comp.height;
  let darkest = 0;
  for (const s of comp.safe) {
    const along =
      s.edge === "left" ? u : s.edge === "right" ? 1 - u : s.edge === "bottom" ? 1 - v : v;
    if (along >= s.extent) continue;
    // Ease so the falloff has no visible terminating edge.
    const t = 1 - smoothstep(0, s.extent, along);
    darkest = Math.max(darkest, s.strength * Math.pow(t, 1.05));
  }
  return darkest;
}

/* --------------------------------------------------------------- forest --- */

function drawForest(raster, comp, rng, fbm) {
  const { width: W, height: H } = comp;
  const lightPx = { x: comp.light.x * W, y: comp.light.y * H };
  const trunks = [];

  for (let i = 0; i < comp.trunks; i++) {
    // Depth 0 = far haze, 1 = near silhouette at the frame edge.
    const d = Math.pow(rng(), 0.85);
    let u = rng();
    // Near trunks push to the edges so they frame the composition instead of
    // walking through the middle of the tree.
    if (d > 0.62) u = u < 0.5 ? u * 0.34 : 1 - (1 - u) * 0.34;
    else {
      // Everything else avoids the light corridor a little.
      const pull = (u - comp.light.x) * 0.28;
      u = clamp01(u + pull);
    }
    trunks.push({ d, u });
  }
  trunks.sort((a, b) => a.d - b.d);

  for (const { d, u } of trunks) {
    const x = u * W;
    // Far trees stand further up the frame and are shorter on screen; near
    // trees run off the top and bottom edges. That parallax is what turns a row
    // of verticals into depth.
    const baseY = H * lerp(0.70, 1.16, d) + gaussian(rng, 0, H * 0.015);
    const topY = baseY - H * lerp(0.5, 2.0, Math.pow(d, 0.8));
    const width = W * lerp(0.0012, 0.013, Math.pow(d, 2.1));
    const lean = gaussian(rng, 0, 0.035);

    // Atmospheric perspective: distance lifts the wood toward the lit air
    // instead of toward grey, so the forest never picks up a blue cast.
    const haze = Math.pow(1 - d, 1.5);
    const towardLight = Math.pow(clamp01(1 - Math.abs(u - comp.light.x) * 1.9), 1.6);
    // A backlit forest is a field of silhouettes: the *air* is what glows, the
    // wood is dark at every distance. Depth reads through opacity, not through
    // brightness — far trunks half-dissolve into the haze behind them.
    const wood = [
      lerp(PALETTE.void[0], PALETTE.mossDeep[0], 0.35),
      lerp(PALETTE.void[1], PALETTE.mossDeep[1], 0.4),
      lerp(PALETTE.void[2], PALETTE.mossDeep[2], 0.25),
    ];
    const opacity = lerp(0.22, 1, Math.pow(d, 0.65));
    const rimGain = lerp(0.14, 0.62, haze) * lerp(0.3, 1.3, towardLight);
    const layerDepth = 0.08 + d * 0.6;
    const layerMask = d > 0.72 ? "foreground" : "background";

    const steps = 10;
    let px = x;
    let py = baseY;
    const span = baseY - topY;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      // Sway is proportional to height climbed, so trunks bend rather than kink.
      const nx = x + lean * span * t1 + Math.sin(t1 * 2.4 + u * 17) * width * 1.6;
      const ny = lerp(baseY, topY, t1);
      // Strong taper — a tree is a cone, a slab is a building.
      const w0 = width * lerp(1, 0.22, Math.pow(t0, 0.75));
      const w1 = width * lerp(1, 0.22, Math.pow(t1, 0.75));
      drawCapsule(
        raster,
        px,
        py,
        nx,
        ny,
        w0,
        w1,
        (t, edge, dist, sx, sy) => {
          const bark = 0.7 + 0.3 * fbm(sx * 0.05, sy * 0.008);
          // Edge light only on the side actually turned toward the source.
          const facing = sx < lightPx.x ? 0.3 : 1;
          // Rim measured in *pixels* inward from the silhouette. Normalised
          // edge would make every thin far trunk 100% rim, turning the forest
          // into a field of glowing wires.
          const w = w0 + (w1 - w0) * t;
          const into = Math.max(0, w - dist);
          const rimPx = Math.max(1.1, w * 0.3);
          const rim = Math.exp(-into / rimPx) * facing * rimGain;
          return [
            wood[0] * bark + PALETTE.lichen[0] * rim * 0.5,
            wood[1] * bark + PALETTE.lichen[1] * rim * 0.5,
            wood[2] * bark + PALETTE.lichen[2] * rim * 0.35,
            opacity,
          ];
        },
        { depth: layerDepth, mask: layerMask },
      );
      px = nx;
      py = ny;
    }

    // Limbs, only on the near half and only thin ones — they break the
    // verticals without reading as scaffolding.
    if (d > 0.35) {
      const limbs = 1 + Math.floor(rng() * 3);
      for (let l = 0; l < limbs; l++) {
        const at = lerp(0.45, 0.92, rng());
        const ox = lerp(x, px, at) + lean * span * at;
        const oy = lerp(baseY, topY, at);
        const dir = rng() < 0.5 ? -1 : 1;
        const len = width * lerp(3, 8, rng());
        const rise = len * lerp(0.5, 1.1, rng());
        drawCapsule(
          raster,
          ox,
          oy,
          ox + dir * len,
          oy - rise,
          width * 0.22,
          width * 0.05,
          (t, edge, dist) => {
            const w = Math.max(0.5, width * (0.22 - 0.17 * t));
            const rim = Math.exp(-Math.max(0, w - dist) / Math.max(0.9, w * 0.4)) * rimGain;
            return [
              wood[0] + PALETTE.lichen[0] * rim * 0.4,
              wood[1] + PALETTE.lichen[1] * rim * 0.4,
              wood[2] + PALETTE.lichen[2] * rim * 0.28,
              opacity * 0.9,
            ];
          },
          { depth: layerDepth, mask: layerMask, feather: 0.9 },
        );
      }
    }
  }
}

/** Canopy foliage: fbm-driven leaf mass, lit only where it faces the source. */
function drawCanopy(raster, comp, rng, fbm) {
  const { width: W, height: H } = comp;
  const count = Math.round((W * H) / 5200);
  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = Math.pow(rng(), 1.6) * 0.68;
    const x = u * W;
    const y = v * H;
    const density = fbm(x * 0.0022, y * 0.0032);
    if (density < 0.46) continue;

    const dx = (u - comp.light.x) * 1.6;
    const dy = v - comp.light.y;
    const distLight = Math.hypot(dx, dy);
    const lit = Math.pow(clamp01(1 - distLight * 1.15), 2.4);
    if (lit < 0.02 && density < 0.6) continue;

    const size = lerp(1.2, 4.2, rng()) * (W / 3200);
    const glow = lit * lerp(0.35, 1, density);
    const c = lit > 0.35 ? PALETTE.lichen : PALETTE.mossDeep;
    splat(
      raster,
      x,
      y,
      Math.max(1, size),
      c[0],
      c[1],
      c[2],
      glow * 0.5 + density * 0.035,
      "background",
    );
  }
}

/** Volumetric shaft falling from the canopy break. */
function drawLightShaft(raster, comp, fbm) {
  const { width: W, height: H } = comp;
  const lx = comp.light.x * W;
  const ly = comp.light.y * H;
  const reach = H * 1.15;

  raster.forEach((x, y) => {
    const dy = y - ly;
    if (dy < 0) return;
    const t = dy / reach;
    if (t > 1) return;
    // Cone widens as it falls; fbm carves it into separate beams.
    const halfWidth = W * lerp(0.02, 0.30, Math.pow(t, 0.8));
    const dx = Math.abs(x - lx - dy * 0.06);
    if (dx > halfWidth) return;
    const across = 1 - dx / halfWidth;
    const beams = 0.55 + 0.45 * fbm(x * 0.004 + 11, y * 0.0009 + 3);
    const fall = Math.pow(1 - t, 1.9);
    const amount = Math.pow(across, 2.2) * fall * beams * 0.2;
    raster.add(x, y, PALETTE.spore[0], PALETTE.spore[1], PALETTE.spore[2], amount, "glow");
  });

  // The source itself.
  raster.forEach((x, y) => {
    const d = Math.hypot((x - lx) / (W * 0.32), (y - ly) / (H * 0.5));
    if (d > 1) return;
    const a = Math.pow(1 - d, 2.6) * 0.6;
    raster.add(x, y, PALETTE.sporeBright[0], PALETTE.sporeBright[1], PALETTE.sporeBright[2], a, "glow");
  });
}

/** Forest floor: haze band plus scattered glowing motes. */
function drawFloor(raster, comp, rng) {
  const { width: W, height: H } = comp;
  const horizon = H * 0.72;
  raster.forEach((x, y, i, data) => {
    if (y < horizon) return;
    const t = (y - horizon) / (H - horizon);
    const fade = Math.pow(t, 1.4) * 0.85;
    return [
      lerp(data[i], PALETTE.void[0], fade),
      lerp(data[i + 1], PALETTE.void[1], fade),
      lerp(data[i + 2], PALETTE.void[2], fade),
    ];
  });

  const motes = Math.round((W * H) / 26000);
  for (let i = 0; i < motes; i++) {
    const u = rng();
    const v = lerp(0.62, 1.0, Math.pow(rng(), 0.7));
    const x = u * W;
    const y = v * H;
    const towardLight = Math.pow(clamp01(1 - Math.abs(u - comp.light.x) * 1.8), 2);
    const a = towardLight * lerp(0.05, 0.55, rng()) * (1 - Math.pow(v, 3));
    if (a <= 0.01) continue;
    splat(raster, x, y, lerp(1, 2.6, rng()) * (W / 3200), PALETTE.lichen[0], PALETTE.lichen[1], PALETTE.lichen[2], a, "spore");
  }
}

/* ----------------------------------------------------------------- tree --- */

/**
 * Splat the skeleton into the poster.
 *
 * Sample count is deliberately far above what the WebGL layer uses: the poster
 * is a still, so it can afford the density that makes the tree read as solid
 * light at the trunk and dissolve into individual spores at the tips.
 */
function drawTree(raster, comp, tree, rng, samples) {
  const { width: W, height: H } = comp;
  const palmX = comp.palm.x * W;
  const palmY = comp.palm.y * H;
  const scale = (comp.treeHeight * H) / tree.bounds.maxY;
  const toPx = (x, y) => ({ x: palmX + x * scale, y: palmY - y * scale });

  // Weight sampling by cross-sectional area so the trunk is dense and the
  // twigs are sparse — never a uniform grid (§10.4).
  const weights = tree.segments.map((s) => {
    const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    return len * Math.pow((s.w0 + s.w1) * 0.5, 0.55);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const cdf = [];
  let acc = 0;
  for (const w of weights) {
    acc += w / total;
    cdf.push(acc);
  }
  const pick = (r) => {
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const dotScale = W / 3200;

  for (let i = 0; i < samples; i++) {
    const seg = tree.segments[pick(rng())];
    const t = rng();
    const lx = lerp(seg.x0, seg.x1, t);
    const ly = lerp(seg.y0, seg.y1, t);
    const w = lerp(seg.w0, seg.w1, t);
    const birth = lerp(seg.p0, seg.p1, t);
    // Scatter grows along the path, so the trunk is solid light and the twigs
    // dissolve into loose spores rather than staying a drawn line.
    const scatter = lerp(0.55, 2.2, Math.pow(birth, 1.5));
    const off = (rng() + rng() + rng() - 1.5) * scatter;
    const p = toPx(lx + off * w, ly + gaussian(rng, 0, w * 0.4 * scatter));

    // Young wood near the root burns brightest; tips fade toward spore.
    const core = Math.pow(clamp01(1 - Math.abs(off) / 1.4), 2);
    const brightness = lerp(0.2, 1.35, core) * lerp(1.0, 0.5, birth) * lerp(0.6, 1.2, rng());
    const c = birth < 0.4 ? PALETTE.sporeBright : PALETTE.spore;
    // Dot grammar: mostly 1-2px spores, occasional 4px node at a junction.
    const isNode = core > 0.8 && rng() < 0.05;
    const radius = (isNode ? 2.0 : lerp(0.55, 1.35, core)) * dotScale * (seg.isRoot ? 0.85 : 1);
    splat(raster, p.x, p.y, Math.max(0.7, radius), c[0], c[1], c[2], brightness * 0.42, "tree");
  }

  // Foliage clusters — leaves and the spores drifting off them. The canopy
  // carries most of the tree's particle budget: branches are the drawing, but
  // the crown is what makes it read as alive rather than as a bare winter twig.
  const foliageBudget = Math.round(samples * 4.5);
  const densityTotal = tree.clusters.reduce((a, c) => a + c.density, 0) || 1;
  for (const cl of tree.clusters) {
    const n = Math.round((foliageBudget * cl.density) / densityTotal);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      // Cube-root-ish radial distribution fills the volume evenly instead of
      // piling everything at the centre of each cluster.
      const rad = Math.pow(rng(), 0.42) * cl.r * lerp(0.85, 1.35, rng());
      const p = toPx(cl.x + Math.cos(ang) * rad, cl.y + Math.sin(ang) * rad * 0.8);
      const falloff = clamp01(1 - rad / (cl.r * 1.35));
      const a = Math.pow(falloff, 1.1) * lerp(0.2, 0.9, rng()) * cl.density;
      splat(
        raster,
        p.x,
        p.y,
        lerp(0.6, 1.5, rng()) * dotScale,
        PALETTE.spore[0],
        PALETTE.spore[1],
        PALETTE.spore[2],
        a * 0.24,
        "tree",
      );
    }
  }

  // The germination point: brightest thing in the frame sits on the palm.
  const glowR = comp.treeHeight * H * 0.3;
  raster.forEach((x, y) => {
    const d = Math.hypot(x - palmX, (y - palmY) * 1.45) / glowR;
    if (d > 1) return;
    const a = Math.pow(1 - d, 2.4) * 0.34;
    raster.add(x, y, PALETTE.spore[0], PALETTE.spore[1], PALETTE.spore[2], a, "glow");
  });

  return { palmX, palmY, scale };
}

/** Ambient spores drifting in the upper frame, as in the reference. */
function drawAmbientSpores(raster, comp, rng) {
  const { width: W, height: H } = comp;
  const clusters = 5;
  for (let c = 0; c < clusters; c++) {
    const cx = lerp(0.12, 0.92, rng()) * W;
    const cy = lerp(0.02, 0.42, rng()) * H;
    const n = 40 + Math.floor(rng() * 90);
    const spread = lerp(0.02, 0.06, rng()) * W;
    for (let i = 0; i < n; i++) {
      const x = cx + gaussian(rng, 0, spread);
      const y = cy + gaussian(rng, 0, spread * 0.8);
      const a = lerp(0.08, 0.6, Math.pow(rng(), 1.8));
      splat(raster, x, y, lerp(0.8, 1.8, rng()) * (W / 3200), PALETTE.spore[0], PALETTE.spore[1], PALETTE.spore[2], a * 0.5, "spore");
    }
  }
}

/* ----------------------------------------------------------------- post --- */

function postProcess(raster, comp, fbm, rng) {
  const { width: W, height: H } = comp;

  // Vignette + text safe-area gradient, both multiplicative on the artwork.
  raster.forEach((x, y, i, data) => {
    const u = x / W;
    const v = y / H;
    const vig = 1 - Math.pow(Math.hypot((u - 0.5) * 1.15, (v - 0.5) * 1.05), 2.4) * 1.15;
    const safe = 1 - safeMultiplier(comp, x, y);
    const k = clamp01(vig) * safe;
    return [data[i] * k, data[i + 1] * k, data[i + 2] * k];
  });

  // Film grain, pulled back over the safe areas so text sits on clean ground.
  raster.forEach((x, y, i, data) => {
    const clean = 1 - safeMultiplier(comp, x, y);
    const g = (fbm(x * 0.9, y * 0.9) - 0.5) * 0.022 * clean;
    return [
      clamp01(data[i] + g),
      clamp01(data[i + 1] + g),
      clamp01(data[i + 2] + g),
    ];
  });

  ditherQuantise(raster, {
    cell: Math.max(2, Math.round(W / 1600)),
    levels: 13,
    strengthAt: (x, y) => 1 - safeMultiplier(comp, x, y) * 0.85,
  });
}

/* ------------------------------------------------------------- occlusion -- */

function buildOcclusion(raster) {
  const { width, height } = raster;
  const fg = raster.mask("foreground");
  const hand = raster.mask("hand");
  const tree = raster.mask("tree");
  const out = new Float32Array(width * height);
  // Dilate the tree mask a little so the occlusion band has some width, then
  // intersect with everything that sits in front of it.
  const radius = 3;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const front = Math.max(fg[p], hand[p]);
      if (front <= 0.01) continue;
      let near = 0;
      for (let dy = -radius; dy <= radius; dy += radius) {
        for (let dx = -radius; dx <= radius; dx += radius) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const t = tree[ny * width + nx];
          if (t > near) near = t;
        }
      }
      out[p] = front * near;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- render -- */

async function renderComposition(comp) {
  const t0 = Date.now();
  const { width: W, height: H } = comp;
  const rng = makeRng(`${SEED}:${comp.id}`);
  const fbm = makeFbm2D(`${SEED}:fbm:${comp.id}`, 5);
  const grainFbm = makeFbm2D(`${SEED}:grain:${comp.id}`, 2);
  const raster = new Raster(W, H);

  // 1. Atmosphere — the dark is layered, never one flat black (§2.1).
  raster.forEach((x, y) => {
    const u = x / W;
    const v = y / H;
    const dl = Math.hypot((u - comp.light.x) * 1.5, v - comp.light.y);
    // Tight falloff: the lit air is a pocket around the source, not an overall
    // olive wash. Everything outside it stays genuinely dark (§2.1).
    const glow = Math.pow(clamp01(1 - dl * 1.15), 3.6);
    const vertical = Math.pow(1 - clamp01(v), 2.2);
    const k = (glow * 0.85 + vertical * 0.08) * 0.72 * (comp.atmosphere ?? 1);
    return [
      lerp(PALETTE.void[0], PALETTE.mossDeep[0], k) + glow * 0.035,
      lerp(PALETTE.void[1], PALETTE.mossDeep[1], k * 1.05) + glow * 0.045,
      lerp(PALETTE.void[2], PALETTE.mossDeep[2], k * 0.7) + glow * 0.02,
    ];
  });

  // 2..7 — forest behind, light through it, floor beneath.
  drawCanopy(raster, comp, rng, fbm);
  drawForest(raster, comp, rng, fbm);
  drawLightShaft(raster, comp, fbm);
  drawFloor(raster, comp, rng);
  drawAmbientSpores(raster, comp, rng);

  // 8. The hand.
  const lightPx = { x: comp.light.x * W, y: comp.light.y * H };
  const handScalePx = comp.handScale * H * 1.6;
  const handOpts = {
    origin: { x: comp.palm.x * W, y: comp.palm.y * H },
    scale: handScalePx,
    rotation: comp.handRotation,
    light: lightPx,
    skin: PALETTE.mossDeep,
    rimColor: [PALETTE.lichen[0] * 0.85, PALETTE.lichen[1] * 0.85, PALETTE.lichen[2] * 0.6],
    bounce: {
      x: comp.palm.x * W,
      y: comp.palm.y * H,
      radius: handScalePx * 0.72,
      color: PALETTE.spore,
      strength: 0.34,
    },
  };
  drawHand(raster, handOpts);
  for (const s of handSporeField(raster, handOpts, rng, Math.round((W * H) / 3400))) {
    splat(
      raster,
      s.x,
      s.y,
      lerp(0.8, 1.9, rng()) * (W / 3200),
      PALETTE.lichen[0],
      PALETTE.lichen[1],
      PALETTE.lichen[2],
      Math.pow(s.falloff, 2) * 0.34,
      "spore",
    );
  }

  // 9. The tree, drawn from the same skeleton the browser will animate.
  const tree = generateTree({ seed: SEED });
  const placement = drawTree(raster, comp, tree, rng, Math.round((W * H) / 11));

  // 10. Post.
  postProcess(raster, comp, grainFbm, rng);

  const rgba = toRGBA8(raster, { exposure: 0.98 });
  const occlusion = buildOcclusion(raster);

  console.log(`  rendered ${comp.id} (${W}×${H}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { raster, rgba, occlusion, tree, placement };
}

/* ----------------------------------------------------------------- write -- */

async function writeComposition(comp, result) {
  const dir = path.join(OUT, comp.id);
  await mkdir(dir, { recursive: true });
  const { width: W, height: H } = comp;
  const base = sharp(result.rgba, { raw: { width: W, height: H, channels: 4 } });

  const posterName = `hero-${comp.id}-base`;

  /**
   * Responsive widths. Serving the native 3200px frame to a 1440px laptop is
   * the fastest way to lose the LCP budget in §16, so every composition ships a
   * ladder and the browser picks off the srcset.
   */
  const widths = [0.4, 0.6, 0.8, 1].map((f) => Math.round((W * f) / 2) * 2);
  const avif = [];
  const webp = [];

  for (const w of widths) {
    const suffix = w === W ? "" : `-${w}`;
    const scaled = w === W ? base.clone() : base.clone().resize(w);
    const avifPath = path.join(dir, `${posterName}${suffix}.avif`);
    const webpPath = path.join(dir, `${posterName}${suffix}.webp`);
    await scaled.clone().avif({ quality: 58, effort: 5, chromaSubsampling: "4:2:0" }).toFile(avifPath);
    await scaled.clone().webp({ quality: 80, effort: 6 }).toFile(webpPath);
    avif.push({ w, src: `/assets/hero/${comp.id}/${posterName}${suffix}.avif` });
    webp.push({ w, src: `/assets/hero/${comp.id}/${posterName}${suffix}.webp` });
  }

  // LQIP: a 24px blur that inlines as a data URI so the frame is never white.
  const lqip = await base
    .clone()
    .resize(24, Math.max(1, Math.round((24 * H) / W)))
    .webp({ quality: 40 })
    .toBuffer();

  const masks = {
    "tree-mask": result.raster.mask("tree"),
    "hand-mask": result.raster.mask("hand"),
    "glow-mask": result.raster.mask("glow"),
    "spore-mask": result.raster.mask("spore"),
    "background-mask": result.raster.mask("background"),
    "foreground-mask": result.raster.mask("foreground"),
    "occlusion-mask": result.occlusion,
  };

  const artDir = path.join(ART_OUT, comp.id);
  await mkdir(artDir, { recursive: true });

  for (const [name, mask] of Object.entries(masks)) {
    await sharp(maskToGray8(mask, W, H), { raw: { width: W, height: H, channels: 1 } })
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(artDir, `${name}.png`));
  }

  await sharp(depthToGray16(result.raster.depth, W, H), {
    raw: { width: W, height: H, channels: 1 },
  })
    .toColourspace("grey16")
    .png({ compressionLevel: 9 })
    .toFile(path.join(artDir, "depth-map-16bit.png"));

  return {
    id: comp.id,
    media: comp.media,
    width: W,
    height: H,
    poster: { avif, webp },
    lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
    /** Normalised anchor the WebGL layer aligns its point cloud to. */
    palm: comp.palm,
    light: comp.light,
    treeHeight: comp.treeHeight,
    safe: comp.safe,
  };
}

/* ------------------------------------------------------------------ main -- */

/**
 * Iteration knobs. `HERO_ONLY` renders a single composition and `HERO_SCALE`
 * shrinks it, which turns an 18s render into a 2s one while art directing.
 * Neither affects the shipped output — full runs use the declared sizes.
 */
function applyEnvOverrides(comps) {
  const only = process.env.HERO_ONLY;
  const scale = Number(process.env.HERO_SCALE ?? 1);
  let list = only ? comps.filter((c) => c.id === only) : comps;
  if (scale !== 1) {
    list = list.map((c) => ({
      ...c,
      width: Math.round(c.width * scale),
      height: Math.round(c.height * scale),
      trunks: Math.round(c.trunks * Math.max(0.35, scale)),
    }));
  }
  return list;
}

async function main() {
  console.log("ALSOS hero assets");
  await mkdir(OUT, { recursive: true });

  const tree = generateTree({ seed: SEED });
  const skeleton = serializeTree(tree);
  await writeFile(path.join(OUT, "tree-skeleton.json"), JSON.stringify(skeleton));
  console.log(
    `  tree skeleton: ${skeleton.segments.length} segments, ${skeleton.clusters.length} clusters`,
  );

  const compositions = applyEnvOverrides(COMPOSITIONS);
  const entries = [];
  for (const comp of compositions) {
    const result = await renderComposition(comp);
    entries.push(await writeComposition(comp, result));
  }

  if (compositions.length !== COMPOSITIONS.length) {
    console.log("  preview run — manifest and og image left untouched");
    return;
  }

  // A small square crop of the ultrawide frame, used for social cards.
  const og = COMPOSITIONS[0];
  await sharp(path.join(OUT, og.id, `hero-${og.id}-base.webp`))
    .extract({
      left: Math.round(og.width * 0.28),
      top: 0,
      width: Math.round(og.width * 0.52),
      height: og.height,
    })
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 84 })
    .toFile(path.join(OUT, "og-image-1200x630.jpg"));

  const manifest = {
    version: 1,
    seed: SEED,
    generatedBy: "scripts/generate-hero-assets.mjs",
    skeleton: "/assets/hero/tree-skeleton.json",
    og: "/assets/hero/og-image-1200x630.jpg",
    compositions: entries,
    /** Palette actually present in the artwork, mirrored by tokens.css. */
    palette: {
      void: "#070908",
      night: "#0b0f0c",
      canopy: "#111811",
      mossDeep: "#26301f",
      moss: "#68743c",
      lichen: "#aeb760",
      spore: "#d9dd7a",
      sporeBright: "#e5e98d",
    },
  };
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`  manifest written -> ${path.relative(ROOT, path.join(OUT, "manifest.json"))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
