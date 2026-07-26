/**
 * Deterministic randomness for the hero pipeline.
 *
 * Every asset ALSOS ships must regenerate byte-identically from a seed, both so
 * visual-regression tests are meaningful (§19) and so a user's tree never
 * reshuffles itself between visits (§8.5).
 */

/** mulberry32 — small, fast, good enough distribution for art. */
export function makeRng(seed) {
  let a = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0 || 1e-6));
  return t * t * (3 - 2 * t);
}

/** Box-Muller, so branch angles cluster naturally instead of reading uniform. */
export function gaussian(rng, mean = 0, sd = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* --------------------------------------------------------------- noise --- */

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Seeded 2D value noise with smooth interpolation. */
export function makeValueNoise2D(seed) {
  const SIZE = 256;
  const MASK = SIZE - 1;
  const rng = makeRng(seed);
  const table = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < table.length; i++) table[i] = rng();

  const at = (x, y) => table[(y & MASK) * SIZE + (x & MASK)];

  return function noise2D(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = lerp(at(xi, yi), at(xi + 1, yi), xf);
    const b = lerp(at(xi, yi + 1), at(xi + 1, yi + 1), xf);
    return lerp(a, b, yf);
  };
}

/** Fractal brownian motion over value noise — canopy, haze, bark. */
export function makeFbm2D(seed, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  const noise = makeValueNoise2D(seed);
  return function fbm(x, y) {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  };
}

/* ------------------------------------------------------------ geometry --- */

/** Distance from point p to segment ab, plus the projection parameter t. */
export function segmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const lenSq = abx * abx + aby * aby;
  const t = lenSq > 0 ? clamp01((apx * abx + apy * aby) / lenSq) : 0;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  return { dist: Math.hypot(dx, dy), t };
}
