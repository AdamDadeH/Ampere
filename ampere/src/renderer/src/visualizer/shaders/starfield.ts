/**
 * Parallax starfield — layered hash-based star placement.
 * All layers always rendered, smoothstep fade prevents pop-in.
 * Phase-driven speed for smooth motion.
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

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float starLayer(vec2 uv, float layerSeed) {
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float brightness = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = id + neighbor;

      float h = hash(cellId + layerSeed);
      if (h > 0.5) continue;

      vec2 starPos = neighbor + vec2(hash(cellId + 1.0), hash(cellId + 2.0)) - 0.5 - f;
      float d = length(starPos);

      // Star size varies per star
      float starSize = 0.08 + h * 0.12;

      // Gentle twinkle
      float twinkle = sin(uTime * (1.5 + h * 2.0) + h * 80.0) * 0.15 + 0.85;

      // Bright core + soft glow halo
      float core = smoothstep(starSize, 0.0, d);
      float glow = 0.015 / (d * d + 0.003);
      brightness += (core + glow * 0.3) * twinkle;
    }
  }
  return brightness;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Phase-driven drift — smooth, continuous
  float drift = uPhaseBass * 1.0;

  // Smooth layer count — always render all 6, fade contribution
  float layerFade = 3.0 + uMid * 3.0;

  vec3 col = vec3(0.0);

  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float depth = 1.0 + fi * 0.6;
    float layerDrift = drift / depth;

    vec2 layerUV = uv * (6.0 + fi * 3.0) + vec2(layerDrift, layerDrift * 0.3);
    float stars = starLayer(layerUV, fi * 7.0);

    // Smoothstep fade — no popping
    float alpha = smoothstep(fi + 0.5, fi, layerFade);

    float brightness = stars * (1.0 + uTreble * 0.8) / depth;
    vec3 starCol = mix(
      vec3(0.6, 0.7, 1.0),
      vec3(1.0, 0.9, 0.7),
      hash(vec2(fi, 0.0))
    );
    col += starCol * brightness * alpha;
  }

  // Bass boosts overall star brightness
  col *= 1.0 + uBass * 0.3;

  // Nebula background glow
  float nebula = sin(uv.x * 1.5 + uTime * 0.05) * sin(uv.y * 1.5 + uTime * 0.07) * 0.5 + 0.5;
  col += vec3(0.06, 0.02, 0.1) * nebula;

  // Beat flash — stars flare
  col += uBeat * vec3(0.12, 0.1, 0.15);

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
