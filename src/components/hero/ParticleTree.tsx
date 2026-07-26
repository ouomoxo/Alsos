"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import type { HeroComposition } from "@/lib/hero/manifest";
import { HERO_GROWTH_DURATION, HERO_TIMELINE, easeOrganic } from "@/lib/motion/timings";
import { createFrameAdaptor, FRAME_BUDGET_MS, TIER_BUDGETS, type Tier } from "@/lib/webgl/capability-tier";
import type { PointCloud } from "@/lib/webgl/point-cloud-loader";
import { TREE_FRAGMENT, TREE_VERTEX } from "@/lib/webgl/shaders/tree.glsl";

type Props = {
  cloud: PointCloud;
  composition: HeroComposition;
  tier: Exclude<Tier, "static">;
  /** When true, render the finished tree with no animation at all. */
  frozen: boolean;
  frozenGrowth: number;
  pointerEnabled: boolean;
  /** Hero exit progress, driven by ScrollTrigger in the parent. */
  scrollProgress: RefObject<number>;
  onFirstFrame: () => void;
};

const COLOR_CORE = new THREE.Color("#e5e98d");
const COLOR_TIP = new THREE.Color("#aeb760");

/**
 * The whole tree as one BufferGeometry, one ShaderMaterial, one draw call.
 *
 * No React state is touched per frame and no per-point component exists (§11.1,
 * §16): everything animated lives in uniforms, and the particle count is
 * changed through the geometry's draw range.
 */
export function ParticleTree({
  cloud,
  composition,
  tier,
  frozen,
  frozenGrowth,
  pointerEnabled,
  scrollProgress,
  onFirstFrame,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startRef = useRef<number | null>(null);
  const firedFirstFrame = useRef(false);
  const { size, gl } = useThree();

  const budget = TIER_BUDGETS[tier];
  const adaptor = useMemo(
    () => createFrameAdaptor(budget, size.width < 768 ? FRAME_BUDGET_MS.mobile : FRAME_BUDGET_MS.desktop),
    [budget, size.width],
  );

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("aTarget", new THREE.BufferAttribute(cloud.target, 2));
    g.setAttribute("aScatter", new THREE.BufferAttribute(cloud.scatter, 2));
    g.setAttribute("aBirth", new THREE.BufferAttribute(cloud.birth, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(cloud.size, 1));
    g.setAttribute("aBrightness", new THREE.BufferAttribute(cloud.brightness, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(cloud.seed, 1));
    // `position` is required by three's frustum plumbing but unused: the vertex
    // shader derives screen position from aTarget. A zero-length attribute
    // keeps the bounding sphere from being computed over garbage.
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(cloud.count * 3), 3));
    g.setDrawRange(0, Math.min(budget.initial, cloud.count));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Number.POSITIVE_INFINITY);
    return g;
  }, [cloud, budget.initial]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uGrowth: { value: frozen ? frozenGrowth : 0 },
      uTime: { value: 0 },
      uOrigin: { value: new THREE.Vector2() },
      uScale: { value: 1 },
      uDpr: { value: 1 },
      uNoiseStrength: { value: 0.004 },
      uSizeScale: { value: 1 },
      uOpacity: { value: 1 },
      uPointer: { value: new THREE.Vector2(-1, -1) },
      uPointerRadius: { value: 110 },
      uPointerStrength: { value: 6 },
      uScroll: { value: 0 },
      uRootLineY: { value: 0 },
      uColorCore: { value: COLOR_CORE },
      uColorTip: { value: COLOR_TIP },
    }),
    // Deliberately built once; values are mutated in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Align the point cloud to the poster underneath it.
   *
   * The poster is `object-fit: cover`, so we reproduce that transform exactly:
   * image pixels -> screen pixels, then tree-local units -> image pixels using
   * the palm anchor the generator baked into the manifest. Get this wrong and
   * the canvas visibly jumps against the still on cross-fade.
   */
  const layout = useMemo(() => {
    const objectPositionX = size.width < 768 ? 0.5 : 0.58;
    const objectPositionY = size.width < 768 ? 0.42 : 0.5;
    const cover = Math.max(size.width / composition.width, size.height / composition.height);
    const drawnW = composition.width * cover;
    const drawnH = composition.height * cover;
    const offsetX = (size.width - drawnW) * objectPositionX;
    const offsetY = (size.height - drawnH) * objectPositionY;

    const palmImageX = composition.palm.x * composition.width;
    const palmImageY = composition.palm.y * composition.height;

    return {
      originX: offsetX + palmImageX * cover,
      originY: offsetY + palmImageY * cover,
      // Tree-local units -> screen pixels, matching drawTree() in the generator.
      scale: ((composition.treeHeight * composition.height) / cloud.maxY) * cover,
    };
  }, [size.width, size.height, composition, cloud.maxY]);

  useEffect(() => {
    uniforms.uOrigin.value.set(layout.originX, layout.originY);
    uniforms.uScale.value = layout.scale;
    uniforms.uRootLineY.value = size.height * 0.92;
    // Point sprites are sized in device pixels.
    uniforms.uDpr.value = Math.min(gl.getPixelRatio(), 1.5);
    // Keep dots the same physical size regardless of the art's cover scale.
    uniforms.uSizeScale.value = Math.max(0.75, layout.scale / 900);
    uniforms.uNoiseStrength.value = frozen ? 0 : 0.004;
    uniforms.uPointerStrength.value = pointerEnabled ? 6 : 0;
  }, [layout, size.height, gl, uniforms, frozen, pointerEnabled]);

  useEffect(() => {
    if (!pointerEnabled) {
      uniforms.uPointer.value.set(-1, -1);
      return;
    }
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      uniforms.uPointer.value.set(event.clientX, event.clientY);
    };
    const onLeave = () => uniforms.uPointer.value.set(-1, -1);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [pointerEnabled, uniforms]);

  useFrame((state, delta) => {
    const material = materialRef.current;
    if (!material) return;

    if (!firedFirstFrame.current) {
      firedFirstFrame.current = true;
      onFirstFrame();
    }

    if (frozen) {
      uniforms.uGrowth.value = frozenGrowth;
      uniforms.uTime.value = 0;
      return;
    }

    const now = state.clock.elapsedTime * 1000;
    if (startRef.current === null) startRef.current = now;
    const elapsed = now - startRef.current;

    // Growth: root to tips, on the organic curve, then done. It never loops.
    const rawProgress = (elapsed - (HERO_TIMELINE.growthStart - HERO_TIMELINE.canvasCrossfade)) / HERO_GROWTH_DURATION;
    uniforms.uGrowth.value = easeOrganic(Math.min(1, Math.max(0, rawProgress)));
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uScroll.value = scrollProgress.current;

    const next = adaptor.sample(delta * 1000);
    if (next !== null) {
      geometry.setDrawRange(0, Math.min(next, cloud.count));
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={TREE_VERTEX}
        fragmentShader={TREE_FRAGMENT}
        transparent
        depthTest={false}
        depthWrite={false}
        // Light adds; it never occludes the art underneath.
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
