"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";

import { heroManifest, pickComposition, type HeroComposition } from "@/lib/hero/manifest";
import { usePageVisible, usePrefersReducedMotion } from "@/lib/motion/reduced-motion";
import { readVisualTest } from "@/lib/visual-test";
import { hasWebGL, initialTier, TIER_BUDGETS, type Tier } from "@/lib/webgl/capability-tier";
import { buildPointCloud, fetchSkeleton, type PointCloud } from "@/lib/webgl/point-cloud-loader";

import { AmbientSpores } from "./AmbientSpores";
import { ParticleTree } from "./ParticleTree";
import styles from "./HeroScene.module.css";

/**
 * Layer 2 of the hero (§9): transparent GPU particles over the static art.
 *
 * Loaded through next/dynamic with ssr:false, so neither three, nor
 * @react-three/fiber, nor the shaders appear in the initial route chunk. Every
 * failure path ends in "render nothing" — the poster is already on screen and
 * the DOM UI never depended on this.
 */
export default function HeroScene() {
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const [cloud, setCloud] = useState<PointCloud | null>(null);
  const [composition, setComposition] = useState<HeroComposition | null>(null);
  const [tier, setTier] = useState<Exclude<Tier, "static"> | null>(null);
  const [ready, setReady] = useState(false);
  const scrollProgress = useRef(0);

  const visualTest = useMemo(() => readVisualTest(), []);
  /** Reduced motion, or ?motion=0, means: final grown tree, perfectly still. */
  const still = reducedMotion || !visualTest.motion;

  /* ------------------------------------------------------------ loading -- */

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        // No WebGL at all: keep the poster and never mount a canvas.
        if (!hasWebGL()) return;

        const width = window.innerWidth;
        const height = window.innerHeight;
        const guess = initialTier(width, still);
        // `initialTier` reports "static" for the reduced-motion path; that
        // still renders, just frozen, so pick a modest budget for it.
        const resolved: Exclude<Tier, "static"> =
          guess === "static" ? (width < 768 ? "low" : "mid") : guess;

        const skeleton = await fetchSkeleton(heroManifest.skeleton, controller.signal);
        if (cancelled) return;

        const built = buildPointCloud(skeleton, TIER_BUDGETS[resolved].ceiling, visualTest.seed);
        if (cancelled) return;

        setComposition(pickComposition(width, height));
        setCloud(built);
        setTier(resolved);
      } catch {
        // Silent by design: the hero is already complete without this layer.
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [still, visualTest.seed]);

  /* ------------------------------------------------- responsive re-anchor -- */

  useEffect(() => {
    const onResize = () => setComposition(pickComposition(window.innerWidth, window.innerHeight));
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* -------------------------------------------------------------- scroll -- */

  useEffect(() => {
    if (still || visualTest.enabled) return;
    let trigger: { kill: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      // Bound to native scroll position: no pinning, no smooth-scroll engine
      // (§10.7, §11.2). Scrolling stays entirely the user's.
      trigger = ScrollTrigger.create({
        trigger: "#hero-heading",
        start: "bottom 70%",
        end: "bottom top",
        onUpdate: (self) => {
          scrollProgress.current = self.progress;
        },
      });
    })();

    return () => {
      cancelled = true;
      trigger?.kill();
    };
  }, [still, visualTest.enabled]);

  /** Cross-fade only once a real frame exists, never on a timer (§16). */
  const handleFirstFrame = useCallback(() => setReady(true), []);

  if (!cloud || !composition || !tier) return null;

  const pointerEnabled =
    !still &&
    !visualTest.enabled &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  return (
    <div
      className={styles.scene}
      data-ready={ready ? "true" : "false"}
      // Decoration only. Every word and control lives in the DOM (§15).
      aria-hidden="true"
    >
      <Canvas
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        // Capped at 1.5 per §16; more resolution buys nothing on a point cloud.
        dpr={[1, Math.min(TIER_BUDGETS[tier].maxDpr, 1.5)]}
        // Stop rendering entirely when the tab is hidden.
        frameloop={pageVisible ? "always" : "never"}
        orthographic
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }}
        onCreated={({ gl }) => gl.setClearAlpha(0)}
        style={{ pointerEvents: "none" }}
      >
        <PixelSpaceCamera />
        <ParticleTree
          cloud={cloud}
          composition={composition}
          tier={tier}
          frozen={still || visualTest.enabled}
          frozenGrowth={visualTest.enabled ? visualTest.frozenGrowth : 1}
          pointerEnabled={pointerEnabled}
          scrollProgress={scrollProgress}
          onFirstFrame={handleFirstFrame}
        />
        <AmbientSpores
          composition={composition}
          seed={visualTest.seed}
          frozen={still || visualTest.enabled}
        />
      </Canvas>
    </div>
  );
}

/**
 * Puts the camera in CSS-pixel space with y pointing down, so shaders, the
 * poster and the DOM all share one coordinate system. Without this the particle
 * alignment maths would have to be duplicated in NDC.
 */
function PixelSpaceCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const ortho = camera as THREE.OrthographicCamera;
    ortho.left = 0;
    ortho.right = size.width;
    ortho.top = 0;
    ortho.bottom = size.height;
    ortho.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}
