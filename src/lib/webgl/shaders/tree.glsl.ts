import { NOISE_GLSL } from "./noise.glsl";

/**
 * Point cloud shader for the hero tree.
 *
 * Positions arrive in *tree-local* units and are mapped to screen pixels here,
 * so a viewport resize is two uniform writes rather than a buffer rebuild.
 *
 * The reveal is the heart of it (§10.1): each particle carries `aBirth`, its
 * normalised distance from the root *along the branches*. Comparing that to
 * uGrowth makes the tree grow through its own structure — a mask wipe would
 * light up an unconnected twig before the branch that feeds it.
 */
export const TREE_VERTEX = /* glsl */ `
precision highp float;

attribute vec2 aTarget;
attribute vec2 aScatter;
attribute float aBirth;
attribute float aSize;
attribute float aBrightness;
attribute float aSeed;

uniform float uGrowth;
uniform float uTime;
uniform vec2 uOrigin;
uniform float uScale;
uniform float uDpr;
uniform float uNoiseStrength;
uniform float uSizeScale;
uniform float uOpacity;
uniform vec2 uPointer;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uScroll;
uniform float uRootLineY;

varying float vAlpha;
varying float vTone;

${NOISE_GLSL}

void main() {
  // Reveal along the branch path. The narrow smoothstep band is the visible
  // growth front travelling outward.
  float reveal = smoothstep(aBirth - 0.035, aBirth + 0.035, uGrowth);

  vec2 local = mix(aScatter, aTarget, reveal);

  // Ambient drift. Tips move more than the trunk, because a trunk does not
  // sway — this is what reads as breathing rather than as noise.
  vec2 organic = curl2(vec3(aTarget * 1.8, uTime * 0.025)) * uNoiseStrength * (0.25 + aBirth);
  local += organic;

  // Tree-local -> screen pixels. y flips because screen y grows downward.
  vec2 pos = uOrigin + vec2(local.x, -local.y) * uScale;

  // As the hero leaves the viewport the lower particles flatten into the root
  // line that carries into the next section (§10.7).
  if (uScroll > 0.0) {
    float lowness = 1.0 - smoothstep(0.0, 0.45, aBirth);
    float collapse = uScroll * lowness;
    pos.y = mix(pos.y, uRootLineY, collapse);
    pos.x += sin(aSeed * 43.0) * collapse * 120.0;
  }

  // Pointer: a handful of spores drift a few pixels. No magnet, no vortex.
  if (uPointer.x > 0.0 && uPointerStrength > 0.0) {
    vec2 away = pos - uPointer;
    float dist = length(away);
    if (dist < uPointerRadius && dist > 0.001) {
      float push = (1.0 - dist / uPointerRadius);
      // Only a fraction of particles respond, so the field stays calm.
      float participates = step(0.55, fract(aSeed * 91.7));
      pos += normalize(away) * push * push * uPointerStrength * participates;
    }
  }

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);

  // Particles pop in slightly small and settle — germination, not a fade.
  gl_PointSize = aSize * uSizeScale * uDpr * (0.55 + 0.45 * reveal);

  vAlpha = reveal * aBrightness * uOpacity;
  vTone = aBirth;
}
`;

export const TREE_FRAGMENT = /* glsl */ `
precision mediump float;

uniform vec3 uColorCore;
uniform vec3 uColorTip;

varying float vAlpha;
varying float vTone;

void main() {
  // Round the point sprite and give it a soft shoulder. Square particles read
  // as pixels; these need to read as spores.
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float falloff = 1.0 - smoothstep(0.02, 0.25, r2);

  vec3 color = mix(uColorCore, uColorTip, vTone);
  gl_FragColor = vec4(color, vAlpha * falloff);
}
`;
