/**
 * Classic Amiga plasma — sin/cos interference patterns.
 * Uses IQ cosine palette for smooth color cycling.
 * All motion driven by accumulated phase, not raw time * audio.
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

// IQ cosine palette — smooth, controllable color cycling
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Phase-driven motion — smooth, no lurching
  float p = uPhaseBass * 0.8;

  // 6 interference waves at incommensurate frequencies
  float v1 = sin(uv.x * 2.7 + p);
  float v2 = sin(uv.y * 3.1 + p * 0.73);
  float v3 = sin((uv.x + uv.y) * 1.9 + p * 0.53);
  float v4 = sin(length(uv) * 3.3 + p * 1.1);
  float v5 = sin((uv.x - uv.y) * 2.3 + uPhaseTreble * 0.4);
  float v6 = sin(length(uv + vec2(sin(p * 0.3), cos(p * 0.2))) * 2.1);

  // Multiply some terms for sharper interference bands
  float plasma = (v1 + v2 + v3 + v4 + v5 * v6) / 5.0;

  // Treble adds fine detail
  plasma += sin(uv.x * 7.0 + uPhaseTreble) * uTreble * 0.15;

  // IQ palette — mid shifts the hue offset
  vec3 col = palette(
    plasma * 0.5 + uPhaseMid * 0.1,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 1.0, 1.0),
    vec3(0.0 + uMid * 0.2, 0.33, 0.67)
  );

  // Gentle beat brightness pulse
  col += uBeat * 0.25;

  fragColor = vec4(col, 1.0);
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
