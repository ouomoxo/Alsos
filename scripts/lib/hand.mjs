import { drawCapsule } from "./raster.mjs";
import { clamp01, smoothstep } from "./rng.mjs";

/**
 * The open palm the tree grows from.
 *
 * Bones live in local units where the origin is the palm centre (exactly where
 * the tree's root sits) and +x runs toward the wrist, +y runs up. Everything is
 * a tapered capsule so the same rasteriser draws hand and branch — one material
 * language, which is why the dither pass makes them read as the same substance.
 */
export const HAND_BONES = [
  // [x0, y0, x1, y1, w0, w1, kind]
  // Forearm and palm mass, running off the right edge of frame.
  [1.32, -0.46, 0.62, -0.14, 0.30, 0.35, "palm"],
  [0.66, -0.14, 0.04, 0.0, 0.37, 0.34, "palm"],
  [0.30, 0.14, -0.02, 0.14, 0.22, 0.17, "palm"],

  // Index finger — highest, catches the most rim light.
  [0.02, 0.19, -0.30, 0.25, 0.105, 0.095, "finger"],
  [-0.30, 0.25, -0.53, 0.25, 0.095, 0.08, "finger"],
  [-0.53, 0.25, -0.68, 0.21, 0.08, 0.062, "finger"],

  // Middle finger — the longest reach.
  [0.02, 0.05, -0.34, 0.09, 0.11, 0.10, "finger"],
  [-0.34, 0.09, -0.59, 0.07, 0.10, 0.083, "finger"],
  [-0.59, 0.07, -0.76, 0.01, 0.083, 0.064, "finger"],

  // Ring finger.
  [0.02, -0.09, -0.31, -0.08, 0.105, 0.094, "finger"],
  [-0.31, -0.08, -0.54, -0.12, 0.094, 0.078, "finger"],
  [-0.54, -0.12, -0.69, -0.20, 0.078, 0.06, "finger"],

  // Little finger.
  [0.04, -0.22, -0.24, -0.24, 0.088, 0.078, "finger"],
  [-0.24, -0.24, -0.43, -0.30, 0.078, 0.064, "finger"],
  [-0.43, -0.30, -0.55, -0.39, 0.064, 0.05, "finger"],

  // Thumb, splayed toward the viewer.
  [0.70, -0.12, 0.52, -0.36, 0.135, 0.115, "finger"],
  [0.52, -0.36, 0.33, -0.49, 0.115, 0.092, "finger"],
];

/**
 * @param {object} raster
 * @param {object} opts
 * @param {{x:number,y:number}} opts.origin  palm centre in pixels
 * @param {number} opts.scale                local unit -> pixels
 * @param {number} opts.rotation             radians, positive = counter-clockwise
 * @param {{x:number,y:number}} opts.light   light position in pixels
 * @param {number[]} opts.skin               linear rgb of the lit side
 */
export function drawHand(raster, opts) {
  const {
    origin,
    scale,
    rotation = 0,
    light,
    skin,
    rimColor,
    depth = 0.82,
    /** Warm bounce thrown back onto the palm by the tree standing on it. */
    bounce = { x: origin.x, y: origin.y, radius: scale * 0.9, color: rimColor, strength: 0.5 },
  } = opts;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  // Local (x right, y up) -> pixel space (y down).
  const toPixel = (lx, ly) => ({
    x: origin.x + (lx * cos - ly * sin) * scale,
    y: origin.y - (lx * sin + ly * cos) * scale,
  });

  for (const [x0, y0, x1, y1, w0, w1, kind] of HAND_BONES) {
    const a = toPixel(x0, y0);
    const b = toPixel(x1, y1);
    const rw0 = w0 * scale;
    const rw1 = w1 * scale;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    drawCapsule(
      raster,
      a.x,
      a.y,
      b.x,
      b.y,
      rw0,
      rw1,
      (t, edge, dist, px, py) => {
        // Which side of the spine are we on, and does it face the light?
        const sx = a.x + dx * t;
        const sy = a.y + dy * t;
        const side = Math.sign((px + 0.5 - sx) * nx + (py + 0.5 - sy) * ny) || 1;
        const toLightX = light.x - px;
        const toLightY = light.y - py;
        const ll = Math.hypot(toLightX, toLightY) || 1;
        const facing = clamp01((nx * side * toLightX + ny * side * toLightY) / ll);

        // Rim: a thin bright lip on the silhouette that faces the glow — this
        // is what separates individual fingers without any outline stroke.
        // Measured in pixels inward from the edge, never as a fraction of the
        // width, or a thin finger becomes rim all the way through and the hand
        // reads as lit rubber instead of a shadow.
        const w = rw0 + (rw1 - rw0) * t;
        const into = Math.max(0, w - dist);
        const rimPx = Math.max(1.0, scale * 0.005);
        const rim = Math.exp(-into / rimPx) * Math.pow(facing, 2.6) * 0.55;
        // Barely-there wrap so the mass is not a dead black hole.
        const wrap = Math.pow(edge, 1.4) * facing * 0.008;
        const shade = kind === "finger" ? 1 : 0.7;

        // Bounce from the tree, falling off fast so it stays on the palm and
        // never becomes general illumination across the whole hand.
        const bd = Math.hypot(px - bounce.x, py - bounce.y) / bounce.radius;
        const bounceAmt = bd < 1 ? Math.pow(1 - bd, 4.5) * bounce.strength : 0;

        const r = skin[0] * wrap * shade + rimColor[0] * rim + bounce.color[0] * bounceAmt;
        const g = skin[1] * wrap * shade + rimColor[1] * rim + bounce.color[1] * bounceAmt;
        const bl = skin[2] * wrap * shade + rimColor[2] * rim + bounce.color[2] * bounceAmt;

        // Alpha 1: the hand is opaque and occludes everything behind it.
        return [r, g, bl, 1];
      },
      { depth, mask: "hand", feather: 1.1 },
    );
  }
}

/**
 * Scattered dark motes hugging the hand's upper contour, so the silhouette
 * dissolves into the frame instead of ending at a hard cut.
 */
export function handSporeField(raster, opts, rng, count) {
  const { origin, scale, rotation = 0 } = opts;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = [];
  for (let i = 0; i < count; i++) {
    const bone = HAND_BONES[Math.floor(rng() * HAND_BONES.length)];
    const t = rng();
    const lx = bone[0] + (bone[2] - bone[0]) * t;
    const ly = bone[1] + (bone[3] - bone[1]) * t;
    const w = bone[4] + (bone[5] - bone[4]) * t;
    // Push outward past the silhouette, densest right at the edge.
    const spreadT = Math.pow(rng(), 2.2);
    const ang = rng() * Math.PI * 2;
    const rad = w * (1 + spreadT * 2.4);
    const ox = lx + Math.cos(ang) * rad;
    const oy = ly + Math.sin(ang) * rad * 0.8;
    points.push({
      x: origin.x + (ox * cos - oy * sin) * scale,
      y: origin.y - (ox * sin + oy * cos) * scale,
      falloff: 1 - spreadT,
    });
  }
  return points;
}

export function handSafeFalloff(distanceFromEdge, feather) {
  return smoothstep(0, feather, distanceFromEdge);
}
