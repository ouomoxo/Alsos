#!/usr/bin/env node
/**
 * ALSOS — the grove.
 *
 * The hero is not a photograph and not a grid of pixels. It is a stipple: some
 * six hundred thousand individual points, placed off-grid, whose density and
 * size carry the image the way ink does in an engraving. Nothing snaps to a
 * cell, so the forms keep their curves.
 *
 * Three ideas hold it together:
 *
 *   Colour is a harmony, not a tint. Shadows fall toward deep cold teal and
 *   light rises toward warm gold — complementaries at the two ends of one
 *   ramp. A single-hue image can be moody but it cannot be luminous, because
 *   luminosity is the *contrast* between a cold dark and a warm light.
 *
 *   Density is the drawing. Points cluster where light gathers and thin out
 *   into the dark, so the eye reads mass and air rather than edges. Point size
 *   falls with distance, which is what gives the grove its depth.
 *
 *   Scale overwhelms. The trunks run past both edges of the frame, the light
 *   falls from somewhere above the top of it, and the tree at the centre is
 *   small against all of it. The viewer is inside something old.
 *
 *   npm run assets:hero
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { clamp01, gaussian, lerp, makeFbm2D, makeRng, smoothstep } from "./lib/rng.mjs";
import { generateTree, serializeTree } from "./lib/tree.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "hero");
const SRC = path.join(ROOT, "art", "source");
const SEED = "alsos-grove-v1";
const GROWTH_FRAMES = 32;

/* --------------------------------------------------------------- colour --- */

const hexToLinear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};

/**
 * The grove's ramp, shadow to sun.
 *
 * Read the hues along it: the darks are blue-teal, the middles turn jade, the
 * lights swing through leaf-green into gold. That rotation is the whole colour
 * idea — warm light can only feel warm against a cold dark.
 */
const RAMP = [
  [0.00, "#04070c"], // abyss
  [0.08, "#06131a"], // deep water
  [0.18, "#0a2426"], // teal shadow
  [0.30, "#113c31"], // moss in shade
  [0.42, "#1a5b3c"], // jade
  [0.54, "#2f7f47"], // living green
  [0.65, "#5aa054"], // sunlit leaf
  [0.75, "#93c065"], // haze
  [0.84, "#c6d582"], // light through leaves
  [0.91, "#e8dd9b"], // gold
  [0.96, "#f7edc2"], // near the source
  [1.00, "#fffbe8"], // the sun itself
].map(([stop, hex]) => [stop, hexToLinear(hex)]);

/** Sample the ramp continuously. */
function ramp(t) {
  const v = clamp01(t);
  for (let i = 1; i < RAMP.length; i++) {
    if (v <= RAMP[i][0]) {
      const [t0, c0] = RAMP[i - 1];
      const [t1, c1] = RAMP[i];
      const k = (v - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/* -------------------------------------------------------- compositions --- */

const COMPOSITIONS = [
  {
    id: "desktop",
    width: 3200,
    height: 1260,
    media: "(min-width: 768px)",
    forestFocus: { x: 0.5, y: 0.46 },
    /** Above the top edge: the source is never in frame, only its light. */
    light: { x: 0.54, y: -0.14 },
    root: { x: 0.54, y: 0.9 },
    treeHeight: 0.52,
    points: 620000,
    trunks: 46,
    rays: 16,
    /** Copy sits here, so the stipple thins and the ramp darkens. */
    safe: [
      { edge: "left", extent: 0.4, strength: 0.62 },
      { edge: "right", extent: 0.14, strength: 0.6 },
      { edge: "top", extent: 0.13, strength: 0.55 },
    ],
  },
  {
    id: "mobile",
    width: 1440,
    height: 1920,
    media: "(max-width: 767px)",
    forestFocus: { x: 0.5, y: 0.4 },
    light: { x: 0.5, y: -0.1 },
    root: { x: 0.5, y: 0.66 },
    treeHeight: 0.4,
    points: 330000,
    trunks: 30,
    rays: 11,
    safe: [
      { edge: "bottom", extent: 0.46, strength: 0.9 },
      { edge: "top", extent: 0.09, strength: 0.5 },
    ],
  },
];

function safeMultiplier(comp, x, y) {
  const u = x / comp.width;
  const v = y / comp.height;
  let darkest = 0;
  for (const s of comp.safe) {
    const along =
      s.edge === "left" ? u : s.edge === "right" ? 1 - u : s.edge === "bottom" ? 1 - v : v;
    if (along >= s.extent) continue;
    const t = 1 - smoothstep(0, s.extent, along);
    darkest = Math.max(darkest, s.strength * Math.pow(t, 1.1));
  }
  return darkest;
}

/* ---------------------------------------------------------------- canvas --- */

/** Additive float canvas. Points accumulate as light does. */
class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 3);
  }

  /**
   * One stipple point.
   *
   * Soft-edged and sub-pixel accurate: a hard square would put the image back
   * on a grid, and it is the absence of a grid that lets the grove curve.
   */
  point(cx, cy, radius, colour, intensity) {
    const { width, height, data } = this;
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius));
    const inv = 1 / (radius * radius);

    for (let y = minY; y <= maxY; y++) {
      const dy = y + 0.5 - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - cx;
        const d2 = (dx * dx + dy * dy) * inv;
        if (d2 >= 1) continue;
        // Smooth shoulder, so points read as grains of light, not discs.
        const a = (1 - d2) * (1 - d2) * intensity;
        const i = (y * width + x) * 3;
        data[i] += colour[0] * a;
        data[i + 1] += colour[1] * a;
        data[i + 2] += colour[2] * a;
      }
    }
  }
}

/* ---------------------------------------------------------------- source --- */

async function loadForest(file, width, height, focus) {
  const image = sharp(file);
  const meta = await image.metadata();
  const scale = Math.max(width / meta.width, height / meta.height);
  const drawnW = Math.ceil(meta.width * scale);
  const drawnH = Math.ceil(meta.height * scale);
  const left = Math.round(clamp01(focus.x) * (drawnW - width));
  const top = Math.round(clamp01(focus.y) * (drawnH - height));

  const { data } = await image
    .resize(drawnW, drawnH)
    // A gentle blur first: we are sampling structure, not texture, and the
    // stipple supplies all the grain the image needs.
    .blur(2.2)
    .extract({ left, top, width, height })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/* ---------------------------------------------------------------- scene --- */

/**
 * Build the luminance field the stipple will be drawn from.
 *
 * This is the painting, done in one channel: the photograph's structure, the
 * cathedral verticals, the shafts falling through them, ground mist, and the
 * glow at the root. The stipple pass then renders it as points.
 */
function buildField(comp, forest, rng) {
  const { width: W, height: H } = comp;
  const field = new Float32Array(W * H);
  const depth = new Float32Array(W * H);
  const canopy = makeFbm2D(`${SEED}:canopy:${comp.id}`, 5);
  const bark = makeFbm2D(`${SEED}:bark:${comp.id}`, 3);

  const lx = comp.light.x * W;
  const ly = comp.light.y * H;
  const rootX = comp.root.x * W;
  const rootY = comp.root.y * H;

  /* ---------------------------------------------------------- the air --- */

  // Aerial perspective is the whole trick. Distance does not darken a forest,
  // it *lightens* it — haze scatters light into everything far away. Building
  // the air first and then cutting near silhouettes out of it is what gives a
  // grove depth; darkening things by distance only ever gives a flat wall.
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const dl = Math.hypot((u - comp.light.x) * 1.15, v - comp.light.y);
      // Light pools around the source and drains toward the floor.
      let t = Math.pow(clamp01(1 - dl * 0.52), 1.9) * 1.0;
      t += Math.pow(1 - clamp01(v), 2.4) * 0.16;
      t *= 1 - smoothstep(0.6, 1.05, v) * 0.42;
      field[y * W + x] = t;
      depth[y * W + x] = 0;
    }
  }

  /* ------------------------------------------------------- the canopy --- */

  // A ceiling of leaves that the light has to find its way through. The gaps
  // are what the shafts come from, so this is drawn before them.
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const ceiling = 1 - smoothstep(0.18, 0.62, v);
    if (ceiling <= 0) continue;
    for (let x = 0; x < W; x++) {
      const n = canopy(x * 0.0016, y * 0.0034);
      const leaf = smoothstep(0.38, 0.72, n) * ceiling;
      const p = y * W + x;
      field[p] *= 1 - leaf * 0.45;
      // Leaves catch light on their own edges.
      field[p] += Math.pow(clamp01(n - 0.62), 1.4) * ceiling * 0.5;
    }
  }

  /* ------------------------------------------------------- the trunks --- */

  // Drawn back to front. Far trunks barely differ from the haze they stand in;
  // near ones are cut to near-black and run past both edges of the frame.
  const layers = [];
  for (let i = 0; i < comp.trunks; i++) layers.push(Math.pow(rng(), 0.75));
  layers.sort((a, b) => a - b);

  for (const near of layers) {
    let u = rng();
    // Keep a corridor open down the middle for the light and the tree.
    const pull = (u - comp.light.x) * 0.4;
    u = clamp01(u + pull);
    const x0 = u * W;
    // Near trunks are enormous; far ones are saplings by comparison.
    const width = W * lerp(0.003, 0.055, Math.pow(near, 2.4));
    const lean = gaussian(rng, 0, 0.055);
    const sway = gaussian(rng, 0, 0.9);
    const phase = rng() * 9;
    // Far trunks stop short of the floor; near ones run off it.
    const foot = H * lerp(0.72, 1.15, near);
    const crown = -H * lerp(0.02, 0.35, near);

    for (let y = 0; y < H; y++) {
      if (y > foot) continue;
      const along = clamp01((foot - y) / (foot - crown));
      // The curve. A trunk that is a straight line reads as scaffolding.
      const cx =
        x0 + lean * along * W * 0.09 + Math.sin(along * 2.6 + phase) * sway * W * 0.012;
      // Wide at the base, tapering as it climbs.
      const w = width * lerp(1, 0.34, Math.pow(along, 0.8));
      const soft = lerp(2.6, 1.05, near);
      const lo = Math.max(0, Math.floor(cx - w * soft));
      const hi = Math.min(W - 1, Math.ceil(cx + w * soft));

      for (let x = lo; x <= hi; x++) {
        const d = Math.abs(x - cx) / w;
        if (d > soft) continue;
        const p = y * W + x;
        // Far trunks dissolve into the haze; near ones have a hard edge.
        const solid = 1 - smoothstep(soft * 0.35, soft, d);
        const texture = 0.82 + 0.18 * bark(x * 0.02, y * 0.004);
        field[p] *= 1 - solid * lerp(0.22, 0.97, near) * texture;
        // A cold edge light on the side that faces the shafts.
        const rim = Math.exp(-Math.abs(d - soft * 0.55) * 4.5) * (x > lx ? 1 : 0.4);
        field[p] += rim * solid * lerp(0.16, 0.05, near);
        if (near > depth[p]) depth[p] = near;
      }
    }
  }

  /* -------------------------------------------------------- the light --- */

  for (let n = 0; n < comp.rays; n++) {
    const spread = (n / (comp.rays - 1) - 0.5) * 2;
    const angle = spread * 0.5 + gaussian(rng, 0, 0.06);
    const power = lerp(0.35, 1, 1 - Math.abs(spread)) * lerp(0.5, 1, rng());
    const halfWidth = W * lerp(0.008, 0.032, rng());

    for (let y = 0; y < H; y++) {
      const travel = (y - ly) / (H - ly);
      if (travel < 0) continue;
      const bend = Math.sin(travel * 2.1) * 0.07;
      const cx = lx + (angle + bend) * travel * W * 0.55;
      const w = halfWidth * lerp(0.4, 3, travel);
      const fade = Math.pow(1 - clamp01(travel), 1.7);
      const lo = Math.max(0, Math.floor(cx - w));
      const hi = Math.min(W - 1, Math.ceil(cx + w));
      for (let x = lo; x <= hi; x++) {
        const d = Math.abs(x - cx) / w;
        field[y * W + x] += Math.pow(1 - d, 3) * fade * power * 0.34;
      }
    }
  }

  /* The source's halo, just above the frame. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - lx) / (W * 0.34), (y - ly) / (H * 0.7));
      if (d > 1) continue;
      field[y * W + x] += Math.pow(1 - d, 2.4) * 0.75;
    }
  }

  /* Ground mist, drifting. */
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const band = smoothstep(0.5, 0.88, v) * (1 - smoothstep(0.9, 1.02, v));
    if (band <= 0) continue;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const drift = 0.55 + 0.45 * canopy(x * 0.0022 + 40, y * 0.006);
      const toward = Math.pow(clamp01(1 - Math.abs(u - comp.light.x) * 1.35), 2);
      field[y * W + x] += band * drift * toward * 0.3;
    }
  }

  /* The photograph, folded in as organic mottling only. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const lum = Math.pow(
        (0.2126 * forest[i] + 0.7152 * forest[i + 1] + 0.0722 * forest[i + 2]) / 255,
        2.2,
      );
      const p = y * W + x;
      // Multiplicative, centred on 1: it varies the grove without redrawing it.
      field[p] *= 0.86 + Math.pow(lum, 0.5) * 0.34;
    }
  }

  /* The glow the tree stands in. */
  const glowR = comp.treeHeight * H * 0.65;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - rootX, (y - rootY) * 1.4) / glowR;
      if (d > 1) continue;
      field[y * W + x] += Math.pow(1 - d, 2.8) * 0.6;
    }
  }

  /* A shoulder before anything is read as colour.
   *
   * Every term above is additive, so lit regions run well past 1 and the ramp
   * would pin them to the sun — turning each soft falloff into a hard-edged
   * white wedge. The extended Reinhard form rolls the shoulder off while still
   * letting the brightest zone reach the warm end of the ramp. */
  // One exposure control, applied once. Every term above is relative; chasing
  // brightness by re-tuning each of them individually just moves the problem.
  const EXPOSURE = 2.6;
  const WHITE = 2.6;
  for (let i = 0; i < field.length; i++) {
    const f = Math.max(0, field[i]) * EXPOSURE;
    field[i] = (f * (1 + f / (WHITE * WHITE))) / (1 + f);
  }

  /* Vignette and the copy's quiet. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const vig = 1 - Math.pow(Math.hypot((u - 0.5) * 1.02, (v - 0.5) * 0.98), 3.2) * 0.7;
      field[y * W + x] *= clamp01(vig) * (1 - safeMultiplier(comp, x, y));
    }
  }

  return { field, depth };
}

/* --------------------------------------------------------------- stipple --- */

/**
 * Render the field as points.
 *
 * Placement is stratified with jitter — near enough to blue noise that no
 * pattern emerges, and far cheaper than a real relaxation. Each candidate
 * survives with probability proportional to the local light, so density *is*
 * the image. Size falls with depth and rises slightly in the highlights, which
 * is what makes near trunks feel coarse and the far canopy feel like air.
 */
function stipple(canvas, comp, field, depth, rng, count) {
  const { width: W, height: H } = comp;
  const cells = Math.ceil(Math.sqrt(count));
  const stepX = W / cells;
  const stepY = H / cells;

  for (let gy = 0; gy < cells; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const x = (gx + rng()) * stepX;
      const y = (gy + rng()) * stepY;
      const px = Math.min(W - 1, Math.max(0, Math.round(x)));
      const py = Math.min(H - 1, Math.max(0, Math.round(y)));
      const p = py * W + px;

      const t = clamp01(field[p]);
      // Survival curve: the dark keeps a scattering of points so it reads as
      // air rather than as a hole, but the light is where the ink goes.
      const survive = Math.pow(t, 0.92) * 0.99 + 0.025;
      if (rng() > survive) continue;

      const d = depth[p];
      // Slight tone jitter per point. Perfectly uniform colour is what makes
      // computed stipple look computed.
      const tone = clamp01(t + gaussian(rng, 0, 0.045));
      const colour = ramp(tone);

      // Warm the highlights and cool the shadows a further step apart — the
      // ramp already does this, and pushing it at the extremes is what makes
      // the image feel lit rather than tinted.
      const warm = smoothstep(0.6, 1, tone);
      const cool = 1 - smoothstep(0.05, 0.45, tone);
      const c = [
        colour[0] * (1 + warm * 0.18 - cool * 0.25),
        colour[1] * (1 + warm * 0.06),
        colour[2] * (1 - warm * 0.22 + cool * 0.3),
      ];

      const radius = lerp(0.55, 2.3, Math.pow(d, 1.4)) * lerp(0.85, 1.3, tone);
      const intensity = lerp(0.3, 1.5, tone) * lerp(1, 0.72, d);
      canvas.point(x, y, radius, c, intensity);
    }
  }
}

/* ------------------------------------------------------------------ tree --- */

/** Points of the tree, in tree-local units, with their growth order. */
function treeParticles(tree, rng, count) {
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

  const out = [];
  const wood = Math.round(count * 0.4);

  for (let i = 0; i < wood; i++) {
    const seg = tree.segments[pick(rng())];
    const t = rng();
    const birth = lerp(seg.p0, seg.p1, t);
    const w = lerp(seg.w0, seg.w1, t);
    const spread = lerp(0.5, 2.1, Math.pow(birth, 1.5));
    const off = (rng() + rng() + rng() - 1.5) * spread;
    const core = clamp01(1 - Math.abs(off) / 1.4);
    out.push({
      x: lerp(seg.x0, seg.x1, t) + off * w,
      y: lerp(seg.y0, seg.y1, t) + gaussian(rng, 0, w * 0.4 * spread),
      birth,
      // Heartwood burns near white; the outer wood cools to jade.
      tone: lerp(0.58, 0.93, core * core) * lerp(1, 0.86, birth),
      alpha: lerp(0.06, 0.24, core * core) * lerp(1, 0.66, birth),
      radius: lerp(0.6, 1.5, core),
    });
  }

  const densityTotal = tree.clusters.reduce((a, c) => a + c.density, 0) || 1;
  for (const cl of tree.clusters) {
    const n = Math.round(((count - wood) * cl.density) / densityTotal);
    for (let i = 0; i < n; i++) {
      const ang = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.45) * cl.r * lerp(0.8, 1.4, rng());
      const falloff = clamp01(1 - rad / (cl.r * 1.4));
      out.push({
        x: cl.x + Math.cos(ang) * rad,
        y: cl.y + Math.sin(ang) * rad * 0.82,
        birth: clamp01(cl.path + rng() * 0.06),
        tone: lerp(0.52, 0.8, falloff),
        alpha: Math.pow(falloff, 1.2) * lerp(0.05, 0.18, rng()) * cl.density,
        radius: lerp(0.55, 1.1, rng()),
      });
    }
  }

  return out;
}

/**
 * The growth, pre-rendered as frames.
 *
 * Every point knows its distance from the root along the wood, so thresholding
 * that value frame by frame grows the tree through its own branches. The
 * browser plays it with a CSS steps() function — there is no engine.
 */
function renderGrowth(comp, tree, rng) {
  const { width: W, height: H } = comp;
  const scale = (comp.treeHeight * H) / tree.bounds.maxY;
  const rootX = comp.root.x * W;
  const rootY = comp.root.y * H;

  const margin = scale * 0.14;
  const left = rootX + tree.bounds.minX * scale - margin;
  const right = rootX + tree.bounds.maxX * scale + margin;
  const top = rootY - tree.bounds.maxY * scale - margin;
  const bottom = rootY - tree.bounds.minY * scale + margin;

  // Frames render at half the plate's resolution: the sheet is 32 frames deep
  // and the tree is soft-edged, so the halving is invisible and the file is a
  // quarter the size.
  const SS = 2;
  const fw = Math.ceil((right - left) / SS);
  const fh = Math.ceil((bottom - top) / SS);
  const particles = treeParticles(tree, rng, Math.round(fw * fh * 0.85));
  const sheet = Buffer.alloc(fw * fh * GROWTH_FRAMES * 4);

  for (let f = 0; f < GROWTH_FRAMES; f++) {
    const t = f / (GROWTH_FRAMES - 1);
    const growth = t * t * (3 - 2 * t);
    const frame = new Canvas(fw, fh);

    for (const p of particles) {
      if (p.birth > growth) continue;
      // Points flare as they open, then settle — germination, not a fade-in.
      const age = clamp01((growth - p.birth) * 5);
      const flare = 1 + (1 - age) * 0.6;
      frame.point(
        (rootX + p.x * scale - left) / SS,
        (rootY - p.y * scale - top) / SS,
        p.radius * 0.85 + 0.4,
        ramp(p.tone),
        p.alpha * (0.4 + 0.6 * age) * flare,
      );
    }

    const base = f * fw * fh * 4;
    for (let i = 0; i < fw * fh; i++) {
      let peak = 0;
      for (let c = 0; c < 3; c++) {
        const v = frame.data[i * 3 + c];
        const enc = Math.round(Math.pow(clamp01(v / (1 + v * 0.5)), 1 / 2.2) * 255);
        sheet[base + i * 4 + c] = enc;
        if (enc > peak) peak = enc;
      }
      // Alpha follows the brightest channel, so the sprite composites over the
      // plate without a black box around it.
      sheet[base + i * 4 + 3] = Math.min(255, Math.round(peak * 1.25));
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

/* ---------------------------------------------------------------- encode --- */

function encode(canvas) {
  const { width, height, data } = canvas;
  const out = Buffer.allocUnsafe(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < 3; c++) {
      const v = data[p * 3 + c];
      // Reinhard shoulder: the shafts can pile up without clipping to white.
      const mapped = v / (1 + v * 0.42);
      out[p * 4 + c] = Math.round(Math.pow(clamp01(mapped), 1 / 2.2) * 255);
    }
    out[p * 4 + 3] = 255;
  }
  return out;
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  console.log("ALSOS grove");
  await mkdir(OUT, { recursive: true });

  const tree = generateTree({ seed: SEED, spread: 0.46, depth: 8 });
  await writeFile(path.join(OUT, "tree-skeleton.json"), JSON.stringify(serializeTree(tree)));

  const entries = [];
  const only = process.env.HERO_ONLY;
  for (const comp of COMPOSITIONS.filter((c) => !only || c.id === only)) {
    const t0 = Date.now();
    const dir = path.join(OUT, comp.id);
    await mkdir(dir, { recursive: true });

    const rng = makeRng(`${SEED}:${comp.id}`);
    const forest = await loadForest(path.join(SRC, "forest.jpg"), comp.width, comp.height, comp.forestFocus);
    const { field, depth } = buildField(comp, forest, rng);

    const canvas = new Canvas(comp.width, comp.height);
    stipple(canvas, comp, field, depth, rng, comp.points);

    const growth = renderGrowth(comp, tree, makeRng(`${SEED}:tree:${comp.id}`));
    const base = sharp(encode(canvas), {
      raw: { width: comp.width, height: comp.height, channels: 4 },
    });

    const name = `grove-${comp.id}`;
    const widths = [0.4, 0.6, 0.8, 1].map((f) => Math.round((comp.width * f) / 2) * 2);
    const avif = [];
    const webp = [];
    for (const w of widths) {
      const suffix = w === comp.width ? "" : `-${w}`;
      const scaled = w === comp.width ? base.clone() : base.clone().resize(w);
      await scaled.clone().avif({ quality: 72, effort: 4 }).toFile(path.join(dir, `${name}${suffix}.avif`));
      await scaled.clone().webp({ quality: 88, effort: 4 }).toFile(path.join(dir, `${name}${suffix}.webp`));
      avif.push({ w, src: `/assets/hero/${comp.id}/${name}${suffix}.avif` });
      webp.push({ w, src: `/assets/hero/${comp.id}/${name}${suffix}.webp` });
    }

    await sharp(growth.buffer, {
      raw: { width: growth.frameWidth, height: growth.frameHeight * growth.frames, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, `tree-${comp.id}.png`));

    const lqip = await base.clone().resize(16).webp({ quality: 50 }).toBuffer();

    entries.push({
      id: comp.id,
      media: comp.media,
      width: comp.width,
      height: comp.height,
      poster: { avif, webp },
      lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
      growth: {
        src: `/assets/hero/${comp.id}/tree-${comp.id}.png`,
        frames: growth.frames,
        frameWidth: growth.frameWidth,
        frameHeight: growth.frameHeight,
        rect: growth.rect,
      },
      root: comp.root,
      light: comp.light,
      treeHeight: comp.treeHeight,
      safe: comp.safe,
    });

    console.log(
      `  ${comp.id} (${comp.width}x${comp.height}) — ${(comp.points / 1000).toFixed(0)}k points in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }

  if (only) return;

  await sharp(path.join(OUT, "desktop", "grove-desktop.webp"))
    .extract({ left: Math.round(3200 * 0.3), top: 0, width: Math.round(3200 * 0.48), height: 1260 })
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toFile(path.join(OUT, "og-image-1200x630.jpg"));

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      {
        version: 3,
        seed: SEED,
        generatedBy: "scripts/build-hero.mjs",
        sources: { forest: "art/source/forest.jpg" },
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
