import manifestJson from "../../../public/assets/hero/manifest.json";

/**
 * Typed view over the generated hero manifest.
 *
 * Components read art through this contract only. Swapping the procedural
 * artwork for painted plates later means producing a manifest with the same
 * shape — no component changes (§13.3 asks for exactly this versioned handoff).
 */

export type PosterSource = { w: number; src: string };

export type SafeArea = {
  edge: "left" | "right" | "top" | "bottom";
  extent: number;
  strength: number;
};

export type HeroComposition = {
  id: string;
  /** Media query selecting this composition. */
  media: string;
  width: number;
  height: number;
  poster: { avif: PosterSource[]; webp: PosterSource[] };
  /** Pre-rendered growth animation. No runtime 3D. */
  growth: {
    src: string;
    frames: number;
    frameWidth: number;
    frameHeight: number;
    rect: { x: number; y: number; width: number; height: number };
  };
  /** Inline blur placeholder so the frame is never empty. */
  lqip: string;
  /** Normalised anchor where the tree meets the palm. */
  palm: { x: number; y: number };
  light: { x: number; y: number };
  treeHeight: number;
  safe: SafeArea[];
};

export type HeroManifest = {
  version: number;
  seed: string;
  skeleton: string;
  og: string;
  compositions: HeroComposition[];
  /** Source photographs the plate was composited from. */
  sources: { forest: string; hand: string };
};

export const heroManifest = manifestJson as HeroManifest;

/** Compositions ordered widest-media-first, as <source> elements require. */
export const heroCompositions = [...heroManifest.compositions].sort(
  (a, b) => b.width / b.height - a.width / a.height,
);

export function srcSet(sources: PosterSource[]): string {
  return sources.map((s) => `${s.src} ${s.w}w`).join(", ");
}

export function compositionById(id: string): HeroComposition {
  const found = heroManifest.compositions.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown hero composition: ${id}`);
  return found;
}

/** The composition the WebGL layer aligns to for a given viewport aspect. */
export function pickComposition(width: number, height: number): HeroComposition {
  if (width < 768) return compositionById("mobile-portrait");
  if (width / height >= 1.9) return compositionById("desktop-ultrawide");
  return compositionById("desktop-standard");
}
