#!/usr/bin/env node
/**
 * ALSOS — the vault.
 *
 * You are lying on the floor of the grove looking straight up.
 *
 * That single decision is the whole piece. A forest photographed at eye level
 * is a landscape, and a landscape is something you stand in front of. A canopy
 * seen from directly beneath is something you are *inside*: the trunks leave
 * the frame behind your head, the branches subdivide over you, and everything
 * converges on one break in the leaves. The viewer's neck is already tilted
 * back before they have read a word.
 *
 * It is also, exactly, what ALSOS means — growth reaching toward light, drawn
 * from beneath by the thing doing the reaching.
 *
 * Four ideas:
 *
 *   Radial, not horizontal. Every hero on the internet is a landscape in a
 *   letterbox. This one converges. The eye is pulled toward a point instead of
 *   swept across a band, and convergence is what produces vertigo.
 *
 *   Warm centre, cold edge. Gold at the break in the canopy falling through
 *   sage and teal into deep blue at the corners. A radial temperature gradient
 *   reads as enormous distance in a way a single hue never can.
 *
 *   Mass, not line. A canopy is foliage with branches threaded through it, not
 *   a diagram of branches. Four layers of leaf mass at four depths, with the
 *   wood interleaved between them, is what separates a forest from a cobweb.
 *
 *   Silhouette and rim. Everything is near-black, lit only where it cuts across
 *   the bright sky behind it. Backlight is what makes a canopy beautiful — the
 *   structure is a drawing in negative.
 *
 *   npm run assets:hero
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { clamp01, gaussian, lerp, makeFbm2D, makeRng, smoothstep } from "./lib/rng.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "hero");
const SEED = "alsos-vault-v2";
const GROWTH_FRAMES = 34;

/* --------------------------------------------------------------- colour --- */

const hexToLinear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2));
};

/**
 * The sky, from the break in the leaves outward.
 *
 * Warm gold at the centre, cooling through sage and teal into deep blue at the
 * frame's corners. The rotation is doing the work: a warm core inside a cold
 * surround reads as depth and as distance, which is why every dusk sky looks
 * like this and why a flat green one never feels far away.
 */
const SKY = [
  [0.0, "#070c16"], // the corners, almost night
  [0.1, "#0d1a2c"], // deep blue
  [0.22, "#173747"], // dusk
  [0.36, "#205258"], // teal
  [0.5, "#2f735b"], // the last green
  [0.62, "#4f8e5a"], // sage
  [0.73, "#8fb35f"], // leaf edge
  [0.83, "#cdc072"], // gold beginning
  [0.91, "#ecd79e"], // gold
  [0.97, "#f9eccb"], // near the break
  [1.0, "#fffbef"], // the sky itself
].map(([stop, hex]) => [stop, hexToLinear(hex)]);

function sky(t) {
  const v = clamp01(t);
  for (let i = 1; i < SKY.length; i++) {
    if (v <= SKY[i][0]) {
      const [t0, c0] = SKY[i - 1];
      const [t1, c1] = SKY[i];
      const k = (v - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], k), lerp(c0[1], c1[1], k), lerp(c0[2], c1[2], k)];
    }
  }
  return SKY[SKY.length - 1][1];
}

/* -------------------------------------------------------- compositions --- */

const COMPOSITIONS = [
  {
    id: "desktop",
    width: 3200,
    height: 1260,
    media: "(min-width: 768px)",
    /** The break in the canopy. Off-centre, so the copy column stays dark. */
    zenith: { x: 0.63, y: 0.42 },
    /** Half-extent of the light, as a fraction of each axis. Anisotropic so
     *  the fall is slower along the wide axis and the gradient stays radial
     *  rather than becoming an ellipse squashed by the aspect ratio. */
    spread: { x: 0.66, y: 1.12 },
    /** A canopy never has exactly one gap. The lesser breaks are far too weak
     *  to compete for the eye, but they keep the outer frame from collapsing
     *  into a single flat vignette and give the darkness somewhere to go. */
    breaks: [
      { x: 0.29, y: 0.14, radius: 0.44, strength: 0.3 },
      { x: 0.88, y: 0.76, radius: 0.32, strength: 0.2 },
    ],
    points: 2400000,
    trunks: 8,
    /** Where the plate is asked to be quiet so type can be read on it. These
     *  are not decoration: the measured contrast of the body copy and the rail
     *  labels depends on them, so they are tuned against the render, not by
     *  eye. */
    safe: [
      { edge: "left", extent: 0.32, strength: 0.58 },
      { edge: "right", extent: 0.11, strength: 0.52 },
      { edge: "top", extent: 0.11, strength: 0.44 },
    ],
  },
  {
    id: "mobile",
    width: 1440,
    height: 1920,
    media: "(max-width: 767px)",
    zenith: { x: 0.5, y: 0.34 },
    spread: { x: 1.16, y: 0.72 },
    breaks: [
      { x: 0.19, y: 0.62, radius: 0.4, strength: 0.26 },
      { x: 0.82, y: 0.16, radius: 0.34, strength: 0.2 },
    ],
    points: 1300000,
    trunks: 7,
    safe: [
      { edge: "bottom", extent: 0.4, strength: 0.7 },
      { edge: "top", extent: 0.09, strength: 0.44 },
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

class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 3);
  }

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
        const a = (1 - d2) * (1 - d2) * intensity;
        const i = (y * width + x) * 3;
        data[i] += colour[0] * a;
        data[i + 1] += colour[1] * a;
        data[i + 2] += colour[2] * a;
      }
    }
  }
}

/* --------------------------------------------------------------- canopy --- */

/**
 * Grow the vault.
 *
 * Trunks enter from outside the frame — behind and beside the viewer's head —
 * and reach *inward* toward the break in the leaves. Perspective runs opposite
 * to a landscape's: a limb is thickest at the frame edge where it is closest
 * to the eye, and thins as it recedes toward the zenith. Getting that backwards
 * would make the image read as a flat radial pattern instead of as looking up.
 *
 * A limb stops well short of the break. Wood that runs the full radius reads as
 * a spoke on a wheel; wood that gives out halfway and hands off to foliage
 * reads as a tree.
 *
 * Every segment records how far it sits from its trunk along the wood, so the
 * growth animation can open the vault outward from its trunks.
 */
function growCanopy(comp, rng) {
  const { width: W, height: H } = comp;
  const zx = comp.zenith.x * W;
  const zy = comp.zenith.y * H;
  const segments = [];
  let maxPath = 0;

  const branch = (x, y, angle, length, width, level, path, depth) => {
    const steps = Math.max(3, 7 - level);
    const stepLen = length / steps;
    // A limb curves along its length; a straight one reads as a spoke.
    const curl = gaussian(rng, 0, 0.3) / steps;
    let cx = x;
    let cy = y;
    let ca = angle;
    let cw = width;
    let cPath = path;

    for (let s = 0; s < steps; s++) {
      // Limbs bend toward the light as they climb — but only just. Too strong
      // and every limb turns into a radius; the pull has to be a tendency the
      // wood argues with, not a destination it aims at.
      const toward = Math.atan2(zy - cy, zx - cx);
      let delta = toward - ca;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      ca += curl + delta * 0.035;

      const nx = cx + Math.cos(ca) * stepLen;
      const ny = cy + Math.sin(ca) * stepLen;
      const nw = cw * 0.88;
      const nPath = cPath + stepLen;

      segments.push({ x0: cx, y0: cy, x1: nx, y1: ny, w0: cw, w1: nw, p0: cPath, p1: nPath, depth });
      cx = nx;
      cy = ny;
      cw = nw;
      cPath = nPath;
    }
    if (cPath > maxPath) maxPath = cPath;
    if (level >= 7 || cw < W * 0.0004) return;

    const forks = level === 0 ? 3 : level < 3 ? 3 : 2;
    for (let i = 0; i < forks; i++) {
      if (i > 0 && level > 2 && rng() < 0.2) continue;
      const spread = lerp(0.55, 1.0, level / 7);
      const offset =
        forks === 1
          ? gaussian(rng, 0, 0.22)
          : lerp(-spread, spread, i / (forks - 1)) + gaussian(rng, 0, 0.2);
      branch(
        cx,
        cy,
        ca + offset,
        length * lerp(0.58, 0.74, rng()),
        cw * lerp(0.6, 0.8, rng()),
        level + 1,
        cPath,
        // Each fork recedes a little further from the eye.
        depth * lerp(0.85, 0.94, rng()),
      );
    }
  };

  // Trunk entries, spread around the frame well outside it so each limb
  // arrives already thick.
  for (let i = 0; i < comp.trunks; i++) {
    const t = (i + lerp(0.15, 0.85, rng())) / comp.trunks;
    const a = t * Math.PI * 2 + 0.4;
    const x = zx + Math.cos(a) * W * 0.72;
    const y = zy + Math.sin(a) * H * 0.92;
    const toward = Math.atan2(zy - y, zx - x);
    // Half the way in, at most. The rest of the vault is leaves.
    const reach = Math.hypot(zx - x, zy - y) * lerp(0.3, 0.46, rng());
    branch(x, y, toward + gaussian(rng, 0, 0.3), reach, W * lerp(0.014, 0.024, rng()), 0, 0, 1);
  }

  for (const s of segments) {
    s.p0 = clamp01(s.p0 / maxPath);
    s.p1 = clamp01(s.p1 / maxPath);
  }
  return segments;
}

/* ---------------------------------------------------------------- field --- */

/**
 * Four strata of foliage, near to far.
 *
 * Coverage climbs and the mass hardens as the layers approach the eye: distant
 * leaves are large, soft, and let light through; the ones a metre above your
 * face are small, dense, and absolutely black. `nearness` records the closest
 * thing at each pixel so the stipple can coarsen its grain there — depth of
 * field is what makes the top layer feel close enough to touch.
 */
/**
 * Every stratum is two frequencies, and that is the whole trick.
 *
 * Thresholding a single low-frequency fbm produces continents with coastlines —
 * a lichen stain, not a tree. Foliage is small elements that *clump*: a broad
 * field decides where a clump of leaves hangs, and a much finer field decides
 * which leaves inside it are lit. Coverage comes from the clump, shape comes
 * from the leaf, and no feature is ever larger than the clump that placed it.
 *
 * `leaf` frequencies sit around 20-60px of feature at this scale — the size a
 * cluster of leaves actually occupies overhead — and climb as the strata
 * approach the eye, because near things are bigger and coarser.
 */
const STRATA = [
  { clump: 0.00075, leaf: 0.0125, cover: 0.6, opacity: 0.42, depth: 0.1, glow: 0.55 },
  { clump: 0.0012, leaf: 0.019, cover: 0.6, opacity: 0.54, depth: 0.3, glow: 0.46 },
  { clump: 0.0019, leaf: 0.029, cover: 0.6, opacity: 0.66, depth: 0.58, glow: 0.34 },
  { clump: 0.003, leaf: 0.045, cover: 0.61, opacity: 0.8, depth: 0.86, glow: 0.22 },
];

/**
 * How sharply a stratum's mass turns on across the noise threshold. Narrow, so
 * the fine octaves buried inside the gradient surface as a ragged edge and the
 * rim highlight collapses from a halo into a filament.
 */
const LEAF_EDGE = 0.07;

function buildField(comp, segments) {
  const { width: W, height: H } = comp;
  const field = new Float32Array(W * H);
  const nearness = new Float32Array(W * H);
  const haze = makeFbm2D(`${SEED}:haze:${comp.id}`, 4);
  const shafts = makeFbm2D(`${SEED}:shafts:${comp.id}`, 3);
  const strata = STRATA.map((s, i) => ({
    ...s,
    clumpFbm: makeFbm2D(`${SEED}:clump${i}:${comp.id}`, 3),
    leafFbm: makeFbm2D(`${SEED}:leaf${i}:${comp.id}`, 4),
  }));

  const zx = comp.zenith.x * W;
  const zy = comp.zenith.y * H;
  const rx = W * comp.spread.x;
  const ry = H * comp.spread.y;

  /* The sky: a broad radial fall from the break outward, all the way to the
     corners. The gradient has to cross the whole frame — if it lands inside a
     few hundred pixels the image is a lamp in a dark room, not a canopy. */
  const breaks = [
    { x: zx, y: zy, rx, ry, strength: 1 },
    ...(comp.breaks ?? []).map((b) => ({
      x: b.x * W,
      y: b.y * H,
      rx: rx * b.radius,
      ry: ry * b.radius,
      strength: b.strength,
    })),
  ];

  const radius = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let t = 0;
      for (let i = 0; i < breaks.length; i++) {
        const b = breaks[i];
        const d = clamp01(Math.hypot((x - b.x) / b.rx, (y - b.y) / b.ry));
        // Max, not sum: two gaps in a canopy do not add up where they overlap,
        // and summing them would flood the mid-field into grey.
        const v = Math.pow(1 - d, 1.75) * b.strength;
        if (v > t) t = v;
        if (i === 0) radius[p] = d;
      }
      field[p] = t * (0.82 + 0.18 * haze(x * 0.0009, y * 0.0016));
    }
  }

  /* Shafts. Light coming through a canopy arrives in radial streaks, and the
     streaks are the strongest single cue that everything converges on one
     point. Sampled on the unit circle so the noise is seamless in angle. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const d = radius[p];
      const a = Math.atan2((y - zy) / ry, (x - zx) / rx);
      const n = shafts(Math.cos(a) * 3.1 + 11, Math.sin(a) * 3.1 + 7);
      // Nothing at the break itself (there is no shaft inside the light) and
      // nothing at the rim (it has scattered out by then).
      const profile = smoothstep(0.04, 0.26, d) * (1 - smoothstep(0.38, 1, d));
      field[p] += smoothstep(0.44, 0.84, n) * profile * 0.62;
    }
  }

  /* Strata 0-1: the far canopy, behind the drawn wood. */
  applyStrata(comp, field, nearness, strata.slice(0, 2));

  /* The drawn branches: silhouette, with rim where they cross the bright sky. */
  for (const s of segments) {
    const pad = s.w0 + 3;
    const minX = Math.max(0, Math.floor(Math.min(s.x0, s.x1) - pad));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(s.x0, s.x1) + pad));
    const minY = Math.max(0, Math.floor(Math.min(s.y0, s.y1) - pad));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(s.y0, s.y1) + pad));
    const abx = s.x1 - s.x0;
    const aby = s.y1 - s.y0;
    const lenSq = abx * abx + aby * aby || 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const apx = x + 0.5 - s.x0;
        const apy = y + 0.5 - s.y0;
        const t = clamp01((apx * abx + apy * aby) / lenSq);
        const dx = apx - abx * t;
        const dy = apy - aby * t;
        const dist = Math.hypot(dx, dy);
        const w = s.w0 + (s.w1 - s.w0) * t;
        if (dist > w + 3) continue;

        const p = y * W + x;
        // Feather inward from the edge rather than straddling it. A fixed
        // +/-1.2px band never reaches solid=1 on a twig, so thin wood used to
        // darken almost nothing while collecting a full-strength rim — which is
        // exactly how a canopy turns into a diagram of glowing wires.
        const solid = 1 - smoothstep(w * 0.5, w + 1, dist);
        if (solid <= 0.002) continue;

        // Near limbs are absolute silhouette; far ones let a little sky through.
        field[p] *= 1 - solid * lerp(0.8, 0.97, s.depth);
        // Light wraps around a *thick* occluder. A twig has no cross-section to
        // wrap around, so it simply goes black; only real limbs earn a rim.
        const rimGain = smoothstep(3, 16, w) * 0.4;
        if (rimGain > 0) {
          const edge = Math.exp(-Math.abs(dist - w) * 0.9) * solid;
          field[p] += edge * rimGain * Math.pow(1 - radius[p], 1.5);
        }
        if (s.depth > nearness[p]) nearness[p] = s.depth;
      }
    }
  }

  /* Strata 2-3: the near canopy, over everything, a metre above your face. */
  applyStrata(comp, field, nearness, strata.slice(2));

  /* The break itself. Broad rather than fierce — a hot pinprick reads as a
     lens flare, a wide pool reads as sky. */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      // Tear the edge of the pool. A gap in a canopy is a hole with leaves
      // around it, so its boundary is ragged; a clean ellipse of light reads as
      // a moon, or worse, as a lens flare put there in post.
      const wob = 0.84 + 0.3 * haze(x * 0.0024 + 31, y * 0.0024 + 17);
      const d = radius[p];
      field[p] += Math.pow(clamp01(1 - d / (0.34 * wob)), 2.1) * 0.8;
      field[p] += Math.pow(clamp01(1 - d / (0.78 * wob)), 2.6) * 0.3;
    }
  }

  /* Shoulder, then vignette and the copy's quiet. Every term above is additive,
     so the bright areas run well past 1; an extended Reinhard with a white
     point rolls them off instead of clipping soft falloff into a hard wedge. */
  const EXPOSURE = 2.05;
  const WHITE = 2.4;
  for (let i = 0; i < field.length; i++) {
    const f = Math.max(0, field[i]) * EXPOSURE;
    field[i] = (f * (1 + f / (WHITE * WHITE))) / (1 + f);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const vig = 1 - Math.pow(Math.hypot((u - 0.5) * 1.02, (v - 0.5) * 0.96), 2.4) * 0.72;
      field[y * W + x] *= clamp01(vig) * (1 - safeMultiplier(comp, x, y));
    }
  }

  return { field, nearness };
}

function applyStrata(comp, field, nearness, layers) {
  const { width: W, height: H } = comp;
  for (const layer of layers) {
    const { clumpFbm, leafFbm, clump, leaf, cover, opacity, depth, glow } = layer;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Where a mass of leaves hangs...
        const density = smoothstep(0.34, 0.72, clumpFbm(x * clump, y * clump * 1.15));
        // ...and which leaves inside it are lit. The clump only moves the
        // threshold; it never draws a shape of its own, so no edge in the image
        // is ever bigger than a leaf cluster.
        const n = leafFbm(x * leaf, y * leaf * 1.18);
        const threshold = cover - density * 0.34;
        const mass = smoothstep(threshold, threshold + LEAF_EDGE, n);
        if (mass <= 0.002) continue;
        const p = y * W + x;
        const behind = field[p];
        field[p] = behind * (1 - mass * opacity);
        // A leaf is translucent at its edge and opaque at its middle: the light
        // behind it survives around the rim. That filament, not the silhouette,
        // is what makes foliage read as foliage.
        field[p] += mass * (1 - mass) * 4 * glow * behind * 0.55;
        if (mass > 0.5 && depth > nearness[p]) nearness[p] = depth;
      }
    }
  }
}

/* --------------------------------------------------------------- stipple --- */

/**
 * Points, not pixels.
 *
 * Nothing snaps to a grid, so form stays curved. Density does most of the
 * drawing — points crowd into the light and scatter into the dark — but the
 * dark is never emptied entirely: a shadow made of sparse cold points reads as
 * material, and a shadow made of no points reads as a hole in the canvas.
 */
function stipple(canvas, comp, field, nearness, rng, count) {
  const { width: W, height: H } = comp;
  const cells = Math.ceil(Math.sqrt((count * W) / H));
  const rows = Math.ceil(count / cells);
  const stepX = W / cells;
  const stepY = H / rows;

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cells; gx++) {
      const x = (gx + rng()) * stepX;
      const y = (gy + rng()) * stepY;
      const px = Math.min(W - 1, Math.max(0, Math.round(x)));
      const py = Math.min(H - 1, Math.max(0, Math.round(y)));
      const p = py * W + px;

      const t = clamp01(field[p]);
      const survive = 0.34 + 0.66 * Math.pow(t, 0.62);
      if (rng() > survive) continue;

      const tone = clamp01(t + gaussian(rng, 0, 0.035));
      const colour = sky(tone);
      const near = nearness[p];

      // Push the ends further apart than the ramp already does: cold shadows
      // colder, warm light warmer. This temperature contrast is what the whole
      // image rests on.
      const warm = smoothstep(0.6, 1, tone);
      const cool = 1 - smoothstep(0.03, 0.36, tone);
      const c = [
        colour[0] * (1 + warm * 0.22 - cool * 0.28),
        colour[1] * (1 + warm * 0.06),
        colour[2] * (1 - warm * 0.26 + cool * 0.42),
      ];

      // Near foliage is coarse and out of focus; far sky is fine grain.
      const radius = lerp(0.62, 2.9, Math.pow(near, 1.2)) * lerp(0.92, 1.2, tone);
      const intensity = lerp(0.2, 1.35, Math.pow(tone, 1.05));
      canvas.point(x, y, radius, c, intensity);
    }
  }
}

/* --------------------------------------------------------------- growth --- */

/**
 * Dawn coming through the vault.
 *
 * The first version of this traced the branch skeleton, and that was the wrong
 * subject twice over. The plate already draws that wood as silhouette, so
 * lighting the same centrelines lays a bright stroke over its own dark shape —
 * a cable diagram thrown across the artwork. And a canopy is not a skeleton: a
 * viewer looking up sees leaves, so leaves are what must move.
 *
 * What ignites here are the gaps — the brightest few percent of the finished
 * plate, where the canopy actually has a hole in it. Points are born in order
 * of distance from the break, so the light spreads outward through the leaves
 * as a wavefront rather than switching on. A slow angular wobble keeps that
 * front from being a perfect expanding circle.
 *
 * Everything is additive, which is what makes it safe: the layer only ever adds
 * light the finished plate is already lit for. Reduced motion pins the last
 * frame, so the resting state is designed to be a permanent glitter on the
 * foliage nearest the light rather than an effect that has to fade out.
 */
function renderGrowth(comp, field, rng) {
  const { width: W, height: H } = comp;
  const SS = 3;
  const fw = Math.ceil(W / SS);
  const fh = Math.ceil(H / SS);
  const sheet = Buffer.alloc(fw * fh * GROWTH_FRAMES * 4);
  const zx = comp.zenith.x * W;
  const zy = comp.zenith.y * H;
  const rx = W * comp.spread.x;
  const ry = H * comp.spread.y;
  const wobble = makeFbm2D(`${SEED}:front:${comp.id}`, 3);

  /* One pass over the plate, emitting a point wherever the canopy has an actual
     hole in it. No cumulative table: the acceptance probability *is* the
     distribution, and a single scan over four million pixels is cheaper than
     building one.

     Weighting by leaf *edges* was the earlier mistake. Those edges are closed
     loops around every leaf cluster, so lighting them draws lace — the frame
     crusted over like frost. The gaps are what actually catch fire at dawn, so
     the weight is a steep power of the finished luminance: only the brightest
     few percent of the plate qualifies, and the result is glints rather than a
     texture.

     Normalised against its own total, not its peak — the peak of this field is
     far above its mean, and normalising by it is what produced five thousand
     points where a hundred and fifty thousand were asked for. */
  const weight = (x, y) => {
    const d = Math.hypot((x - zx) / rx, (y - zy) / ry);
    if (d >= 1) return 0;
    return Math.pow(field[y * W + x], 4) * Math.pow(1 - d, 1.2);
  };

  let totalWeight = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) totalWeight += weight(x, y);
  const target = Math.round(fw * fh * 0.06);
  const density = target / (totalWeight || 1);

  const particles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const w = weight(x, y);
      if (w <= 0) continue;
      if (rng() > w * density) continue;
      const d = Math.hypot((x - zx) / rx, (y - zy) / ry);
      const lit = Math.pow(1 - d, 1.2);

      const a = Math.atan2((y - zy) / ry, (x - zx) / rx);
      particles.push({
        x: x / SS,
        y: y / SS,
        // The wavefront: outward from the break, bent by a slow angular wobble
        // so it arrives as weather rather than as a radar sweep.
        birth: clamp01(d * 0.82 + (wobble(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 3) - 0.5) * 0.3),
        tone: lerp(0.86, 1, clamp01(lit + gaussian(rng, 0, 0.06))),
        alpha: lerp(0.08, 0.26, lit) * lerp(0.5, 1, rng()),
        // Soft and wide. A glint is a small light seen through moving air, not
        // a hard dot.
        radius: lerp(1.1, 3.4, rng() * rng()),
      });
    }
  }

  for (let f = 0; f < GROWTH_FRAMES; f++) {
    const t = f / (GROWTH_FRAMES - 1);
    const growth = t * t * (3 - 2 * t);
    const frame = new Canvas(fw, fh);
    for (const p of particles) {
      if (p.birth > growth) continue;
      const age = clamp01((growth - p.birth) * 3.4);
      // Two envelopes, and the ratio between them is the whole effect.
      //
      // `flare` is a hump peaking halfway through a point's arrival and gone by
      // the end — the only thing the eye reads as motion. The first version had
      // it *dimmer* than the resting value, so there was no wavefront at all.
      //
      // `rest` is what survives, and it has to be nearly nothing: the plate
      // already draws these same filaments, so a resting value anywhere near
      // the flare draws them a second time and the canopy crusts over with
      // frost. Thirty times below the peak, which gamma encoding lifts back to
      // a faint sparkle rather than the nothing it looks like here.
      const rest = 0.01 + 0.023 * age;
      const flare = 4 * age * (1 - age) * 1.08;
      frame.point(p.x, p.y, p.radius, sky(p.tone), p.alpha * (rest + flare));
    }
    const base = f * fw * fh * 4;
    for (let i = 0; i < fw * fh; i++) {
      for (let c = 0; c < 3; c++) {
        const v = frame.data[i * 3 + c];
        sheet[base + i * 4 + c] = Math.round(Math.pow(clamp01(v / (1 + v * 0.5)), 1 / 2.2) * 255);
      }
      // Opaque, always. The layer is composited with `screen`, where black is
      // the identity — an alpha channel would only fringe the points, and a
      // partly transparent bright pixel would *dim* the plate underneath it
      // rather than lighting it.
      sheet[base + i * 4 + 3] = 255;
    }
  }

  return {
    buffer: sheet,
    frameWidth: fw,
    frameHeight: fh,
    frames: GROWTH_FRAMES,
    particles: particles.length,
    rect: { x: 0, y: 0, width: 1, height: 1 },
  };
}

/* ---------------------------------------------------------------- encode --- */

function encode(canvas) {
  const { width, height, data } = canvas;
  const out = Buffer.allocUnsafe(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    for (let c = 0; c < 3; c++) {
      const v = data[p * 3 + c];
      out[p * 4 + c] = Math.round(Math.pow(clamp01(v / (1 + v * 0.5)), 1 / 2.2) * 255);
    }
    out[p * 4 + 3] = 255;
  }
  return out;
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  console.log("ALSOS vault");
  await mkdir(OUT, { recursive: true });

  const only = process.env.HERO_ONLY;
  const entries = [];

  for (const comp of COMPOSITIONS.filter((c) => !only || c.id === only)) {
    const t0 = Date.now();
    const dir = path.join(OUT, comp.id);
    await mkdir(dir, { recursive: true });

    const rng = makeRng(`${SEED}:${comp.id}`);
    const segments = growCanopy(comp, rng);
    const { field, nearness } = buildField(comp, segments);

    const canvas = new Canvas(comp.width, comp.height);
    stipple(canvas, comp, field, nearness, rng, comp.points);
    const growth = renderGrowth(comp, field, makeRng(`${SEED}:growth:${comp.id}`));

    const base = sharp(encode(canvas), {
      raw: { width: comp.width, height: comp.height, channels: 4 },
    });
    const name = `vault-${comp.id}`;
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
      .toFile(path.join(dir, `canopy-${comp.id}.png`));

    const lqip = await base.clone().resize(16).webp({ quality: 50 }).toBuffer();

    entries.push({
      id: comp.id,
      media: comp.media,
      width: comp.width,
      height: comp.height,
      poster: { avif, webp },
      lqip: `data:image/webp;base64,${lqip.toString("base64")}`,
      growth: {
        src: `/assets/hero/${comp.id}/canopy-${comp.id}.png`,
        frames: growth.frames,
        frameWidth: growth.frameWidth,
        frameHeight: growth.frameHeight,
        rect: growth.rect,
      },
      zenith: comp.zenith,
      safe: comp.safe,
    });

    console.log(
      `  ${comp.id} (${comp.width}x${comp.height}) — ${segments.length} limbs, ${(comp.points / 1000000).toFixed(1)}M points, ${(growth.particles / 1000).toFixed(0)}k igniting in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }

  if (only) return;

  await sharp(path.join(OUT, "desktop", "vault-desktop.webp"))
    .extract({ left: Math.round(3200 * 0.34), top: 0, width: Math.round(3200 * 0.48), height: 1260 })
    .resize(1200, 630, { fit: "cover" })
    .jpeg({ quality: 88 })
    .toFile(path.join(OUT, "og-image-1200x630.jpg"));

  await writeFile(
    path.join(OUT, "manifest.json"),
    JSON.stringify(
      { version: 4, seed: SEED, generatedBy: "scripts/build-hero.mjs", og: "/assets/hero/og-image-1200x630.jpg", compositions: entries },
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
