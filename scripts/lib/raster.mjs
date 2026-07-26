import { clamp01, segmentDistance, smoothstep } from "./rng.mjs";

/**
 * Minimal float RGB raster with a companion depth channel.
 *
 * Everything composites in linear-ish float space and only quantises at the very
 * end, which is what keeps the deep greens from banding into mud once the
 * dither pass runs.
 */
export class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height * 3);
    /** 0 = far, 1 = near. Exported as the 16-bit depth map. */
    this.depth = new Float32Array(width * height);
    /** Per-pixel coverage buffers, reused to bake the masks. */
    this.masks = new Map();
  }

  mask(name) {
    let m = this.masks.get(name);
    if (!m) {
      m = new Float32Array(this.width * this.height);
      this.masks.set(name, m);
    }
    return m;
  }

  index(x, y) {
    return (y * this.width + x) * 3;
  }

  /** Alpha-blend a colour, tracking depth and an optional coverage mask. */
  blend(x, y, r, g, b, a, depth, maskName) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.index(x, y);
    const inv = 1 - a;
    this.data[i] = this.data[i] * inv + r * a;
    this.data[i + 1] = this.data[i + 1] * inv + g * a;
    this.data[i + 2] = this.data[i + 2] * inv + b * a;
    if (depth !== undefined) {
      const p = y * this.width + x;
      if (depth > this.depth[p]) this.depth[p] = depth;
    }
    if (maskName) {
      const m = this.mask(maskName);
      const p = y * this.width + x;
      if (a > m[p]) m[p] = a;
    }
  }

  /** Additive light. Glow is emission, not a wash over the top of the frame. */
  add(x, y, r, g, b, amount, maskName) {
    if (amount <= 0 || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = this.index(x, y);
    this.data[i] += r * amount;
    this.data[i + 1] += g * amount;
    this.data[i + 2] += b * amount;
    if (maskName) {
      const m = this.mask(maskName);
      const p = y * this.width + x;
      m[p] = Math.min(1, m[p] + amount);
    }
  }

  /** Per-pixel pass over the whole frame. fn(x, y, i) -> [r,g,b] | void */
  forEach(fn) {
    const { width, height, data } = this;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3;
        const out = fn(x, y, i, data);
        if (out) {
          data[i] = out[0];
          data[i + 1] = out[1];
          data[i + 2] = out[2];
        }
      }
    }
  }
}

/**
 * Rasterise a tapered capsule (a branch, a trunk, a finger bone).
 * `shade(t, edge, dist)` returns [r,g,b,a]; t runs along the capsule, edge is
 * 0 at the silhouette and 1 at the spine.
 */
export function drawCapsule(raster, x0, y0, x1, y1, w0, w1, shade, opts = {}) {
  const { depth, mask, feather = 1.0 } = opts;
  const maxW = Math.max(w0, w1) + feather + 1;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - maxW));
  const maxX = Math.min(raster.width - 1, Math.ceil(Math.max(x0, x1) + maxW));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - maxW));
  const maxY = Math.min(raster.height - 1, Math.ceil(Math.max(y0, y1) + maxW));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const { dist, t } = segmentDistance(x + 0.5, y + 0.5, x0, y0, x1, y1);
      const w = w0 + (w1 - w0) * t;
      if (dist > w + feather) continue;
      const coverage = 1 - smoothstep(w - feather, w + feather, dist);
      if (coverage <= 0.002) continue;
      const edge = w > 0 ? clamp01(1 - dist / w) : 1;
      const c = shade(t, edge, dist, x, y);
      if (!c) continue;
      raster.blend(x, y, c[0], c[1], c[2], c[3] * coverage, depth, mask);
    }
  }
}

/** Soft round splat — used for spores, foliage grain and particle dots. */
export function splat(raster, cx, cy, radius, r, g, b, intensity, maskName) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(raster.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(raster.height - 1, Math.ceil(cy + radius));
  const r2 = radius * radius;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const falloff = 1 - Math.sqrt(d2) / radius;
      raster.add(x, y, r, g, b, intensity * falloff * falloff, maskName);
    }
  }
}

/* --------------------------------------------------------------- output -- */

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
 * Ordered-dither quantisation.
 *
 * This is the signature texture: the frame resolves into discrete particles in
 * the shadows and stays smooth in the highlights, so the artwork reads as the
 * same material as the WebGL point cloud layered on top of it. `strengthAt`
 * lets the caller pull the dither back over the text safe area (§13.3).
 */
export function ditherQuantise(raster, { cell = 2, levels = 14, strengthAt, stochastic = 0.55 }) {
  const { width, height, data } = raster;

  // Pure ordered dithering lays a regular screen over the frame, which reads as
  // a texture pasted on top. Blending the Bayer threshold with a per-pixel hash
  // breaks the grid into particulate matter — the material §2.3 asks for.
  const hash = (x, y) => {
    let h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
    h = (h ^ (h >>> 13)) >>> 0;
    return h / 4294967296;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const strength = strengthAt ? strengthAt(x, y) : 1;
      if (strength <= 0.001) continue;
      const bx = Math.floor(x / cell) & 7;
      const by = Math.floor(y / cell) & 7;
      const ordered = (BAYER8[by][bx] + 0.5) / 64 - 0.5;
      const noise = hash(x, y) - 0.5;
      const threshold = ordered * (1 - stochastic) + noise * stochastic;

      for (let c = 0; c < 3; c++) {
        const v = data[i + c];
        // Nothing to break up in true black — quantising it just manufactures
        // noise across the empty half of the frame.
        if (v < 0.004) continue;
        // Dither hardest where the eye reads texture, and fade out in
        // highlights so the tree core stays solid light.
        const shadowWeight = 1 - smoothstep(0.12, 0.5, v);
        const amount = strength * shadowWeight;
        if (amount <= 0.001) continue;

        // Quantise perceptually. Even steps in linear light are enormous jumps
        // down in the shadows, which is where this whole image lives.
        const g = Math.pow(v, 1 / 2.2);
        const q = 1 / levels;
        const quantised = Math.pow(clamp01(Math.round((g + threshold * q * amount) / q) * q), 2.2);
        data[i + c] = clamp01(v * (1 - amount) + quantised * amount);
      }
    }
  }
}

/** Filmic-ish tone curve, then sRGB encode into 8-bit RGBA. */
export function toRGBA8(raster, { exposure = 1, gamma = 2.2 } = {}) {
  const { width, height, data } = raster;
  const out = Buffer.allocUnsafe(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * 3;
    for (let c = 0; c < 3; c++) {
      let v = data[i + c] * exposure;
      // Reinhard shoulder keeps the light source from clipping to flat white.
      v = v / (1 + v * 0.62);
      v = Math.pow(clamp01(v), 1 / gamma);
      out[p * 4 + c] = Math.round(clamp01(v) * 255);
    }
    out[p * 4 + 3] = 255;
  }
  return out;
}

/** Single-channel 8-bit buffer from a coverage mask. */
export function maskToGray8(mask, width, height) {
  const out = Buffer.allocUnsafe(width * height);
  for (let p = 0; p < width * height; p++) {
    out[p] = Math.round(clamp01(mask[p]) * 255);
  }
  return out;
}

/** 16-bit big-endian grayscale for the depth map. */
export function depthToGray16(depth, width, height) {
  const out = Buffer.allocUnsafe(width * height * 2);
  for (let p = 0; p < width * height; p++) {
    out.writeUInt16LE(Math.round(clamp01(depth[p]) * 65535), p * 2);
  }
  return out;
}
