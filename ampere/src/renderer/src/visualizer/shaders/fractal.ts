/**
 * Kaliset fractal flythrough — volumetric raymarching through an iterative
 * fractal field. Inspired by Star Nest (Pablo Roman Andrioli / Kali).
 * The "magic formula": p = abs(p)/dot(p,p) - formuparam
 * Produces infinite self-similar structure with smooth continuous drift.
 */

export const fragmentSource = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uPhaseBass;
uniform float uPhaseMid;
uniform float uPhaseTreble;

const int VOLSTEPS = 14;
const int ITERATIONS = 11;
const float FORMUPARAM = 0.53;
const float STEPSIZE = 0.13;
const float TILE = 0.85;
const float BRIGHTNESS = 0.002;
const float DIST_FADING = 0.7;
const float SATURATION = 0.8;

void main() {
  vec2 uv = vUV - 0.5;
  uv.x *= uResolution.x / uResolution.y;

  // Camera drifts through fractal space — phase-driven, smooth
  vec3 from = vec3(1.0, 0.5, 0.5);
  from += vec3(uPhaseBass * 0.4, uPhaseMid * 0.2, -uPhaseBass * 0.3);

  // View direction
  vec3 dir = normalize(vec3(uv * 2.0, 1.0));

  // Slight rotation from treble
  float a = uPhaseTreble * 0.1;
  float c = cos(a), s = sin(a);
  dir.xz = mat2(c, s, -s, c) * dir.xz;

  float fade = 1.0;
  vec3 v = vec3(0.0);

  for (int r = 0; r < VOLSTEPS; r++) {
    vec3 p = from + float(r) * STEPSIZE * dir;
    p = abs(vec3(TILE) - mod(p, vec3(TILE * 2.0)));

    float pa = 0.0, a2 = 0.0;
    for (int i = 0; i < ITERATIONS; i++) {
      p = abs(p) / dot(p, p) - FORMUPARAM;
      float lenP = length(p);
      a2 += abs(lenP - pa);
      pa = lenP;
    }

    // Dark matter density
    float dm = max(0.0, a2 - 2.3);
    a2 = pow(a2, 2.5);

    // Color varies with depth
    fade *= DIST_FADING;
    v += vec3(dm * dm * 0.3, dm * dm * 0.1, dm) * a2 * BRIGHTNESS * fade;
  }

  // Saturation control
  v = mix(vec3(length(v)), v, SATURATION);

  // Audio: bass brightens, beat pulses
  v *= 1.0 + uBass * 0.4;
  v += uBeat * 0.12;

  fragColor = vec4(clamp(v, 0.0, 1.0), 1.0);
}
`

export const defaultUniforms: Record<string, number> = {
  uBass: 0,
  uMid: 0,
  uTreble: 0,
  uBeat: 0,
  uPhaseBass: 0,
  uPhaseMid: 0,
  uPhaseTreble: 0,
}
