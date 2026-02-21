/**
 * Evolving interference — nested sin/length creating smooth, organic patterns.
 * Technique from Creation (Danilo Guanabara / Silexars).
 * Famous for being ultra-compact yet producing endlessly smooth evolution.
 * This version adds audio-reactive modulation to the iteration parameters.
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

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  vec3 col = vec3(0.0);
  float t = uPhaseBass * 0.6;

  // Three nested iterations — each builds on previous
  // The magic: length(p) feeds back into sin(), creating organic flow
  for (int i = 0; i < 3; i++) {
    float fi = float(i);

    // Scale factor evolves per iteration
    float scale = 1.0 + fi * 0.5 + uMid * 0.3;

    vec2 p = uv * scale;

    // Core Silexars formula: nested sin + length feedback
    p += vec2(
      sin(t + sin(t + p.y * 0.7) * 0.5) * (1.2 + uTreble * 0.3),
      sin(t * 0.7 + sin(t * 0.8 + p.x * 0.6) * 0.6) * (1.2 + uTreble * 0.3)
    );

    float v = sin(length(p) * (2.0 + fi * 0.5) - t * (0.8 + fi * 0.2));
    v = 0.5 + 0.5 * v;

    // Each iteration contributes a different color channel emphasis
    col[i] = v;
  }

  // Smooth color mixing
  col = pow(col, vec3(1.5));

  // Palette enrichment — blend toward warm/cool based on mid phase
  float palette = sin(uPhaseMid * 0.15) * 0.5 + 0.5;
  vec3 warm = col * vec3(1.2, 0.8, 0.6);
  vec3 cool = col * vec3(0.6, 0.8, 1.2);
  col = mix(warm, cool, palette);

  // Beat brightness
  col += uBeat * 0.15;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
