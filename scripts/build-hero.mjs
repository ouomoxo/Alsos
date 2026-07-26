#!/usr/bin/env node
/**
 * ALSOS hero compositor.
 *
 * Builds the hero plate from the two source photographs plus a generated tree:
 *
 *   art/source/forest.jpg      the grove — graded down to the ALSOS palette
 *   art/source/hand-dots.jpg   the open palm, already screened into halftone
 *   scripts/lib/tree.mjs       the tree, which must animate and so is drawn
 *
 * The division of labour follows the brief: the forest stays cinematic and
 * photographic, while the hand and the tree carry the dot grammar. The tree is
 * generated rather than photographed because it is the one element that has to
 * grow, and growth needs a known branch order.
 *
 *   npm run assets:hero
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { clamp01, gaussian, lerp, makeRng, smoothstep } from "./lib/rng.mjs";
import { generateTree, serializeTree } from "./lib/tree.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "hero");
const SRC = path.join(ROOT, "art", "source");
const SEED = "alsos-hero-v1";

/** Art pixel, in plate pixels. The hand and tree are drawn on this grid. */
const CELL = 4;
const GROWTH_FRAMES = 30;

/* ------------------------------------------------------------- palette --- */

const hexToLinear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};

/** Every pixel in the finished plate is one of these (§20). */
const RAMP = [
  "#0a0b0c", "#0d100e", "#0f1210", "#151914", "#1a1f18", "#1e2318",
  "#242a1b", "#292f1e", "#313821", "#353c23", "#424928", "#52592f",
  "#636a3c", "#7b813f", "#9ca156", "#c3c572", "#e9e98c", "#f4f4d2",
].map(hexToLinear);

const SPORE = hexToLinear("#c3c572");
const LICHEN = hexToLinear("#9ca156");

/**
 * The tree's own ramp — heartwood to leaf tip.
 *
 * Deliberately inside the plate's green family rather than the near-white it
 * started as: a cream tree on an olive grove reads as two different materials
 * pasted together, however bright the glow behind it.
 */
const TREE_CORE = hexToLinear("#e9e98c");
const TREE_MID = hexToLinear("#c3c572");
const TREE_TIP = hexToLinear("#9ca156");

/* -------------------------------------------------------- compositions --- */

const COMPOSITIONS = [
  {
    id: "desktop-ultrawide",
    width: 3200,
    height: 1260,
    media: "(min-width: 768px)",
    /** Which part of the forest photo lands in frame. */
    forestFocus: { x: 0.42, y: 0.54 },
    /** Canonical focal point (§9): where the tree sits. */
    light: { x: 0.5566, y: 0.02 },
    palm: { x: 0.5566, y: 0.70 },
    treeHeight: 0.55,
    /** Hand: how wide the source frame is drawn, in plate widths. Its palm is
        anchored to comp.palm, not its centre — the hand fills only part of the
        source frame, so centring it puts the palm well off the mark. */
    hand: { width: 0.72, flip: false },
    safe: [
      { edge: "left", extent: 0.44, strength: 0.9 },
      { edge: "right", extent: 0.16, strength: 0.78 },
      { edge: "top", extent: 0.15, strength: 0.6 },
    ],
  },
  {
    id: "mobile-portrait",
    width: 1440,
    height: 1920,
    media: "(max-width: 767px)",
    forestFocus: { x: 0.5, y: 0.45 },
    light: { x: 0.5, y: 0.04 },
    palm: { x: 0.5, y: 0.55 },
    treeHeight: 0.36,
    hand: { width: 1.25, flip: false },
    safe: [
      { edge: "bottom", extent: 0.5, strength: 0.9 },
      { edge: "top", extent: 0.1, strength: 0.55 },
    ],
  },
];

/* ------------------------------------------------------------ safe area --- */

function safeMultiplier(comp, x, y) {
  const u = x / comp.width;
  const v = y / comp.height;
  let darkest = 0;
  for (const s of comp.safe) {
    const along =
      s.edge === "left" ? u : s.edge === "right" ? 1 - u : s.edge === "bottom" ? 1 - v : v;
    if (along >= s.extent) continue;
    const t = 1 - smoothstep(0, s.extent, along);
    darkest = Math.max(darkest, s.strength * Math.pow(t, 1.05));
  }
  return darkest;
}

/* -------------------------------------------------------------- sources --- */

/** Cover-fit a source image into the plate, honouring a focal point. */
async function loadCover(file, width, height, focus) {
  const image = sharp(file);
  const meta = await image.metadata();
  const scale = Math.max(width / meta.width, height / meta.height);
  const drawnW = Math.ceil(meta.width * scale);
  const drawnH = Math.ceil(meta.height * scale);
  const left = Math.round(clamp01(focus.x) * (drawnW - width));
  const top = Math.round(clamp01(focus.y) * (drawnH - height));

  const { data } = await image
    .resize(drawnW, drawnH)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/**
 * Load the halftone hand as a coverage mask, resampled to the art grid.
 *
 * The source encodes tone as dot *density*, not as pixel value: its dots are
 * near-binary. Sampling it per pixel therefore lands on a dot or a gap at
 * random and the hand dissolves into noise. Area-averaging it down to one
 * sample per art cell recovers the continuous tone the density represented,
 * and our own dither re-screens it onto our grid at our cell size.
 */
async function loadHandMask(file, cellsWide, cellsHigh, flip) {
  let image = sharp(file).greyscale();
  if (flip) image = image.flop();
  const { data, info } = await image
    .resize(cellsWide, cellsHigh, { fit: "fill", kernel: "cubic" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/* --------------------------------------------------------------- render --- */

async function renderComposition(comp, tree) {
  const t0 = Date.now();
  const { width: W, height: H } = comp;
  const rng = makeRng(`${SEED}:${comp.id}`);

  const forest = await loadCover(path.join(SRC, "forest.jpg"), W, H, comp.forestFocus);

  // The hand is drawn at one sample per art cell.
  const handW = comp.hand.width * W;
  const handAspect = 789 / 1170;
  const handH = handW * handAspect;
  const hand = await loadHandMask(
    path.join(SRC, "hand-dots.jpg"),
    Math.round(handW / CELL),
    Math.round(handH / CELL),
    comp.hand.flip,
  );

  const rgb = new Float32Array(W * H * 3);
  const handCoverage = new Float32Array(W * H);
  const treeMask = new Float32Array(W * H);

  const lightPx = { x: comp.light.x * W, y: comp.light.y * H };
  const palmX = comp.palm.x * W;
  const palmY = comp.palm.y * H;

  /* 1. Grade the forest ------------------------------------------------- */

  // The source is a bright, sunlit, midday grove. The brand is a dark one, so
  // luminance is compressed hard and re-tinted along the palette rather than
  // simply multiplied down — that keeps the canopy separation instead of
  // crushing everything to black.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const r = Math.pow(forest[i] / 255, 2.2);
      const g = Math.pow(forest[i + 1] / 255, 2.2);
      const b = Math.pow(forest[i + 2] / 255, 2.2);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // Strong shoulder: highlights hold, midtones fall away.
      let t = Math.pow(lum, 1.35) * 0.72;

      // The sun in the plate becomes the canopy break the tree grows toward.
      const dl = Math.hypot((x - lightPx.x) / (W * 0.42), (y - lightPx.y) / (H * 0.75));
      t += Math.pow(clamp01(1 - dl), 3.2) * 0.28;

      // The floor falls away into darkness. Without this the source's bright
      // sunlit undergrowth sits directly behind the hand and the silhouette
      // has nothing to separate against.
      t *= 1 - smoothstep(0.42, 1, y / H) * 0.88;

      t = clamp01(t);
      // Sample the ramp continuously; the dither pass snaps it later.
      const f = t * (RAMP.length - 1);
      const lo = RAMP[Math.floor(f)];
      const hi = RAMP[Math.min(RAMP.length - 1, Math.ceil(f))];
      const k = f - Math.floor(f);
      rgb[i] = lerp(lo[0], hi[0], k);
      rgb[i + 1] = lerp(lo[1], hi[1], k);
      rgb[i + 2] = lerp(lo[2], hi[2], k);
    }
  }

  /* 2. The hand ---------------------------------------------------------- */

  // The source is already screened into halftone dots, light-on-black. Those
  // dots are used as coverage, not as light: the hand reads as a dark cut-out
  // of the forest, lit only where the tree's glow lands on it. Compositing it
  // additively would make a glowing white glove.
  // Where the palm sits inside the source frame, measured off the sphere the
  // photograph was shot with — that sphere's centre is the point the tree
  // replaces, so aligning it to comp.palm puts the tree in the hand.
  const SOURCE_PALM = { x: 0.6, y: 0.545 };
  const handLeft = palmX - SOURCE_PALM.x * handW;
  const handTop = palmY - SOURCE_PALM.y * handH;
  const glowRadius = comp.treeHeight * H * 0.42;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // One sample per art cell — the mask is already at that resolution.
      const sx = Math.floor((x - handLeft) / CELL);
      const sy = Math.floor((y - handTop) / CELL);
      if (sx < 0 || sy < 0 || sx >= hand.width || sy >= hand.height) continue;

      const v = hand.data[sy * hand.width + sx] / 255;
      // Drop the source's own bright sphere and its caption plate; the tree
      // replaces the sphere and the caption is another brand's copy.
      const nu = sx / hand.width;
      const nv = sy / hand.height;
      const inCaption = nu < 0.36 && nv > 0.75;
      if (inCaption) continue;

      // The sphere the photograph was shot with, and its bloom. The tree
      // replaces it, so everything above the hand's own tonal range goes.
      if (v > 0.5) continue;

      let coverage = smoothstep(0.04, 0.18, v) * (1 - smoothstep(0.4, 0.5, v));
      if (coverage <= 0.01) continue;

      const p = y * W + x;
      handCoverage[p] = Math.max(handCoverage[p], coverage);

      const i = p * 3;

      // The hand replaces the forest rather than darkening it. Used as a
      // darkening filter it never separates, because the grove behind it is
      // already dark; as its own element it has its own base tone and its own
      // lighting, which is what makes the silhouette read.
      const bd = Math.hypot(x - palmX, (y - palmY) * 1.3) / glowRadius;
      const bounce = bd < 1 ? Math.pow(1 - bd, 2.6) * 0.62 : 0;
      // The screened value is the source's own modelling: brighter dots are
      // the surfaces turned toward the light. Its useful range is roughly
      // 0.10-0.52 once the sphere is out, so it is remapped across that band —
      // read raw it collapses to almost nothing and the hand goes flat.
      const modelling = smoothstep(0.10, 0.52, v);
      const lit = modelling * (0.22 + bounce * 1.1);

      const base = 0.06;
      const hr = RAMP[1][0] * base + LICHEN[0] * lit;
      const hg = RAMP[1][1] * base + LICHEN[1] * lit;
      const hb = RAMP[1][2] * base + LICHEN[2] * lit;

      rgb[i] = lerp(rgb[i], hr, coverage);
      rgb[i + 1] = lerp(rgb[i + 1], hg, coverage);
      rgb[i + 2] = lerp(rgb[i + 2], hb, coverage);
    }
  }

  /* 3. Germination glow -------------------------------------------------- */

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - palmX, (y - palmY) * 1.45) / (comp.treeHeight * H * 0.3);
      if (d > 1) continue;
      const a = Math.pow(1 - d, 2.6) * 0.22;
      const i = (y * W + x) * 3;
      rgb[i] += SPORE[0] * a;
      rgb[i + 1] += SPORE[1] * a;
      rgb[i + 2] += SPORE[2] * a;
    }
  }

  /* 4. Drifting spores --------------------------------------------------- */

  const sporeCount = Math.round((W * H) / 26000);
  for (let s = 0; s < sporeCount; s++) {
    const u = rng();
    const v = Math.pow(rng(), 1.5) * 0.85;
    const toward = Math.pow(clamp01(1 - Math.abs(u - comp.light.x) * 1.7), 2);
    const a = toward * lerp(0.1, 0.55, rng());
    if (a < 0.02) continue;
    const px = Math.floor((u * W) / CELL) * CELL;
    const py = Math.floor((v * H) / CELL) * CELL;
    for (let dy = 0; dy < CELL; dy++) {
      for (let dx = 0; dx < CELL; dx++) {
        const ix = px + dx;
        const iy = py + dy;
        if (ix >= W || iy >= H) continue;
        const i = (iy * W + ix) * 3;
        rgb[i] += SPORE[0] * a;
        rgb[i + 1] += SPORE[1] * a;
        rgb[i + 2] += SPORE[2] * a;
        treeMask[iy * W + ix] = Math.max(treeMask[iy * W + ix], a);
      }
    }
  }

  /* 5. Vignette and copy safe areas -------------------------------------- */

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const vig = 1 - Math.pow(Math.hypot((u - 0.5) * 1.1, (v - 0.5) * 1.05), 2.6) * 1.2;
      const k = clamp01(vig) * (1 - safeMultiplier(comp, x, y));
      const i = (y * W + x) * 3;
      rgb[i] *= k;
      rgb[i + 1] *= k;
      rgb[i + 2] *= k;
    }
  }

  /* 6. Quantise ---------------------------------------------------------- */

  quantise(rgb, W, H, (x, y) => {
    const p = y * W + x;
    // Coarse cells wherever the dot grammar lives, fine everywhere else.
    return handCoverage[p] > 0.02 || treeMask[p] > 0.02 ? CELL : 1;
  }, (x, y) => 1 - safeMultiplier(comp, x, y) * 0.35);

  const rgba = encode(rgb, W, H);
  console.log(`  composed ${comp.id} (${W}x${H}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { rgba, sprite: renderGrowthSprite(comp, tree) };
}

/* ------------------------------------------------------------- quantise --- */

const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

/**
 * Ordered-dither the frame onto the palette.
 *
 * Cell size varies: the photographic forest dithers at one pixel and reads as
 * fine film grain, while the hand and spores dither at CELL and read as the
 * discrete dots the source halftone is made of.
 */
function quantise(rgb, W, H, cellAt, strengthAt) {
  const lum = RAMP.map((c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
  const last = RAMP.length - 1;

  const rampIndex = (l) => {
    if (l <= lum[0]) return 0;
    if (l >= lum[last]) return last;
    let i = 0;
    while (i < last && lum[i + 1] < l) i++;
    const span = lum[i + 1] - lum[i];
    return i + (span > 1e-9 ? (l - lum[i]) / span : 0);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const l = clamp01(0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2]);
      const f = rampIndex(l);
      const cell = cellAt(x, y);
      const bx = cell > 1 ? Math.floor(x / cell) & 7 : x & 7;
      const by = cell > 1 ? Math.floor(y / cell) & 7 : y & 7;
      const threshold = (BAYER8[by][bx] + 0.5) / 64 - 0.5;
      const index = Math.max(0, Math.min(last, Math.floor(f + threshold * strengthAt(x, y) + 0.5)));
      const c = RAMP[index];
      rgb[i] = c[0];
      rgb[i + 1] = c[1];
      rgb[i + 2] = c[2];
    }
  }
}

function encode(rgb, W, H) {
  const out = Buffer.allocUnsafe(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    for (let c = 0; c < 3; c++) {
      out[p * 4 + c] = Math.round(Math.pow(clamp01(rgb[p * 3 + c]), 1 / 2.2) * 255);
    }
    out[p * 4 + 3] = 255;
  }
  return out;
}

/* --------------------------------------------------------- growth sprite --- */

/**
 * The tree's growth, pre-rendered as frames.
 *
 * Each particle carries its distance from the root *along the wood*, so
 * thresholding that value frame by frame makes the tree grow through its own
 * branches. No runtime engine: the browser plays this with CSS steps().
 */
function renderGrowthSprite(comp, tree) {
  const { width: W, height: H } = comp;
  const scale = (comp.treeHeight * H) / tree.bounds.maxY;
  const palmX = comp.palm.x * W;
  const palmY = comp.palm.y * H;

  const margin = scale * 0.12;
  const left = palmX + tree.bounds.minX * scale - margin;
  const right = palmX + tree.bounds.maxX * scale + margin;
  const top = palmY - tree.bounds.maxY * scale - margin;
  const bottom = palmY - tree.bounds.minY * scale + margin;

  const fw = Math.ceil((right - left) / CELL);
  const fh = Math.ceil((bottom - top) / CELL);
  const sheet = Buffer.alloc(fw * fh * GROWTH_FRAMES * 4);
  const particles = sampleTreeParticles(tree, makeRng(`${SEED}:sprite`), Math.round(fw * fh * 1.7));

  for (let f = 0; f < GROWTH_FRAMES; f++) {
    const t = f / (GROWTH_FRAMES - 1);
    const growth = t * t * (3 - 2 * t);
    const base = f * fw * fh * 4;

    for (const p of particles) {
      if (p.birth > growth) continue;
      const age = Math.min(1, (growth - p.birth) * 6);
      const alpha = p.alpha * (0.45 + 0.55 * age);
      const px = Math.floor((palmX + p.x * scale - left) / CELL);
      const py = Math.floor((palmY - p.y * scale - top) / CELL);
      const size = p.big ? 2 : 1;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const ix = px + dx;
          const iy = py + dy;
          if (ix < 0 || iy < 0 || ix >= fw || iy >= fh) continue;
          const o = base + (iy * fw + ix) * 4;
          sheet[o] = Math.min(255, sheet[o] + p.colour[0] * alpha);
          sheet[o + 1] = Math.min(255, sheet[o + 1] + p.colour[1] * alpha);
          sheet[o + 2] = Math.min(255, sheet[o + 2] + p.colour[2] * alpha);
          sheet[o + 3] = Math.min(255, sheet[o + 3] + 255 * alpha);
        }
      }
    }
  }

  return {
    buffer: sheet,
    frameWidth: fw,
    frameHeight: fh,
    frames: GROWTH_FRAMES,
    rect: { x: left / W, y: top / H, width: (right - left) / W, height: (bottom - top) / H },
  };
}

function sampleTreeParticles(tree, rng, count) {
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

  const toByte = (c) => c.map((v) => Math.round(Math.pow(clamp01(v), 1 / 2.2) * 255));
  const colCore = toByte(TREE_CORE);
  const colMid = toByte(TREE_MID);
  const colTip = toByte(TREE_TIP);

  const out = [];
  const wood = Math.round(count * 0.42);

  for (let i = 0; i < wood; i++) {
    const seg = tree.segments[pick(rng())];
    const t = rng();
    const birth = lerp(seg.p0, seg.p1, t);
    const w = lerp(seg.w0, seg.w1, t);
    const spread = lerp(0.55, 2.2, Math.pow(birth, 1.5));
    const off = (rng() + rng() + rng() - 1.5) * spread;
    const core = clamp01(1 - Math.abs(off) / 1.4);
    out.push({
      x: lerp(seg.x0, seg.x1, t) + off * w,
      y: lerp(seg.y0, seg.y1, t) + gaussian(rng, 0, w * 0.4 * spread),
      birth,
      alpha: lerp(0.07, 0.30, core * core) * lerp(1, 0.6, birth),
      big: core > 0.62 && rng() < 0.16,
      colour: birth < 0.35 ? colCore : birth < 0.7 ? colMid : colTip,
    });
  }

  const densityTotal = tree.clusters.reduce((a, c) => a + c.density, 0) || 1;
  for (const cl of tree.clusters) {
    const n = Math.round(((count - wood) * cl.density) / densityTotal);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.42) * cl.r * lerp(0.85, 1.35, rng());
      const falloff = clamp01(1 - rad / (cl.r * 1.35));
      out.push({
        x: cl.x + Math.cos(ang) * rad,
        y: cl.y + Math.sin(ang) * rad * 0.8,
        // Leaves open just after the branch that carries them.
        birth: clamp01(cl.path + rng() * 0.05),
        alpha: Math.pow(falloff, 1.1) * lerp(0.1, 0.34, rng()) * cl.density,
        big: false,
        colour: colTip,
      });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  console.log("ALSOS hero");
  await mkdir(OUT, { recursive: true });

  const tree = generateTree({ seed: SEED });
  await writeFile(path.join(OUT, "tree-skeleton.json"), JSON.stringify(serializeTree(tree)));

  const entries = [];
  for (const comp of COMPOSITIONS) {
    const dir = path.join(OUT, comp.id);
    await mkdir(dir, { recursive: true });
    const { rgba, sprite } = await renderComposition(comp, tree);
    const { width: W, height: H } = comp;
    const base = sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
    const name = `hero-${comp.id}`;

    const widths = [0.4, 0.6, 0.8, 1].map((f) => Math.round((W * f) / 2) * 2);
    const avif = [];
    const webp = [];
    for (const w of widths) {
      const suffix = w === W ? "" : `-${w}`;
      const scaled = w === W ? base.clone() : base.clone().resize(w);
      await scaled.clone().avif({ quality: 70, effort: 4 }).toFile(path.join(dir, `${name}${suffix}.avif`));
      await scaled.clone().webp({ quality: 86, effort: 4 }).toFile(path.join(dir, `${name}${suffix}.webp`));
      avif.push({ w, src: `/assets/hero/${comp.id}/${name}${suffix}.avif` });
      webp.push({ w, src: `/assets/hero/${comp.id}/${name}${suffix}.webp` });
    }

    await sharp(sprite.buffer, {
      raw: { width: sprite.frameWidth, height: sprite.frameHeight * sprite.frames, channels: 4 },
    })
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(dir, `tree-growth-${comp.id}.png`));

    const lqip = await base.clone().resize(16).webp({ quality: 50 }).toBuffer();

    entries.push({
      id: comp.id,
      media: comp.media,
      width: W,
      height: H,
      poster: { avif, webp },
      lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
      growth: {
        src: `/assets/hero/${comp.id}/tree-growth-${comp.id}.png`,
        frames: sprite.frames,
        frameWidth: sprite.frameWidth,
        frameHeight: sprite.frameHeight,
        rect: sprite.rect,
      },
      palm: comp.palm,
      light: comp.light,
      treeHeight: comp.treeHeight,
      safe: comp.safe,
      referenceViewport: { width: 1536, height: 605 },
      focalPoint: { x: 0.5566, y: 0.4463 },
      copySafeArea: { x: 0.0521, y: 0.2727, width: 0.235, height: 0.47 },
      metricsSafeArea: { x: 0.918, y: 0.3355, width: 0.065, height: 0.38 },
    });
  }

  const og = COMPOSITIONS[0];
  await sharp(path.join(OUT, og.id, `hero-${og.id}.webp`))
    .extract({
      left: Math.round(og.width * 0.3),
      top: 0,
      width: Math.round(og.width * 0.48),
      height: og.height,
    })
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 86 })
    .toFile(path.join(OUT, "og-image-1200x630.jpg"));

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        version: 2,
        seed: SEED,
        generatedBy: "scripts/build-hero.mjs",
        sources: {
          forest: "art/source/forest.jpg",
          hand: "art/source/hand-dots.jpg",
        },
        skeleton: "/assets/hero/tree-skeleton.json",
        og: "/assets/hero/og-image-1200x630.jpg",
        compositions: entries,
      },
      null,
      2,
    ),
  );
  console.log("  manifest written");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
