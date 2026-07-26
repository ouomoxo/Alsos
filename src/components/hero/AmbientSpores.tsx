"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { HeroComposition } from "@/lib/hero/manifest";
import { makeRng } from "@/lib/rng";

type Props = {
  composition: HeroComposition;
  seed: string;
  frozen: boolean;
};

const SPORE_COUNT = 220;
const COLOR = new THREE.Color("#d9dd7a");

/**
 * Drifting spores in the upper frame.
 *
 * Deliberately tiny (a few hundred points): this is atmosphere, not a second
 * particle system. They are kept clear of the copy column — §15 forbids
 * rendering noise over text, and §10.6 forbids particles invading it.
 */
export function AmbientSpores({ composition, seed, frozen }: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const rng = makeRng(`${seed}:spores`);
    const position = new Float32Array(SPORE_COUNT * 3);
    const attrSeed = new Float32Array(SPORE_COUNT);
    const attrSize = new Float32Array(SPORE_COUNT);
    const attrAlpha = new Float32Array(SPORE_COUNT);

    // Text safe areas, in normalised viewport space, that spores must avoid.
    const avoid = composition.safe.map((s) => ({ edge: s.edge, extent: s.extent }));

    for (let i = 0; i < SPORE_COUNT; i++) {
      let u = rng();
      const v = Math.pow(rng(), 1.7) * 0.55;

      for (const region of avoid) {
        if (region.edge === "left" && u < region.extent) {
          // Push out of the copy column rather than resampling, which would
          // pile spores against its boundary.
          u = region.extent + rng() * (1 - region.extent);
        }
        if (region.edge === "right" && u > 1 - region.extent) {
          u = rng() * (1 - region.extent);
        }
      }

      position[i * 3] = u;
      position[i * 3 + 1] = v;
      position[i * 3 + 2] = 0;
      attrSeed[i] = rng();
      attrSize[i] = 1 + rng() * 1.6;
      attrAlpha[i] = 0.08 + Math.pow(rng(), 1.8) * 0.45;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(attrSeed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(attrSize, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(attrAlpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Number.POSITIVE_INFINITY);

    return {
      geometry: g,
      uniforms: {
        uTime: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) },
        uDpr: { value: 1 },
        uColor: { value: COLOR },
      },
    };
  }, [composition, seed]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!materialRef.current) return;
    uniforms.uViewport.value.set(state.size.width, state.size.height);
    uniforms.uDpr.value = Math.min(state.gl.getPixelRatio(), 1.5);
    uniforms.uTime.value = frozen ? 0 : state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={SPORE_VERTEX}
        fragmentShader={SPORE_FRAGMENT}
      />
    </points>
  );
}

const SPORE_VERTEX = /* glsl */ `
precision mediump float;

attribute float aSeed;
attribute float aSize;
attribute float aAlpha;

uniform float uTime;
uniform vec2 uViewport;
uniform float uDpr;

varying float vAlpha;

void main() {
  // Slow, looping drift on two incommensurate periods, so the field never
  // visibly repeats — this is the 16–24s ambient breath from §10.5.
  float phase = aSeed * 6.2831;
  float driftX = sin(uTime * 0.06 + phase) * 0.012;
  float driftY = cos(uTime * 0.041 + phase * 1.7) * 0.016 - uTime * 0.0006;

  vec2 uv = vec2(position.x + driftX, fract(position.y + driftY + 1.0));
  vec2 screen = uv * uViewport;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(screen, 0.0, 1.0);
  gl_PointSize = aSize * uDpr;

  // Fade out near the very top and bottom so nothing pops at the seam.
  vAlpha = aAlpha * smoothstep(0.0, 0.08, uv.y) * (1.0 - smoothstep(0.5, 0.62, uv.y));
}
`;

const SPORE_FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(uColor, vAlpha);
}
`;
