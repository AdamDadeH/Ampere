/**
 * @liminal gen5-deep-stars
 * @generation 5
 * @parents starfield + "layered parallax, glow, pulsing"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/stBcW1
 * @mutation Adapted from "These stars look good" (based on youtube.com/watch?v=3CycKKJiwis).
 *          10 depth layers with per-cell random star positions.
 *          Each star pulses with a unique phase. Camera center
 *          orbits slowly with depth-dependent parallax. 3x3 cell
 *          neighborhood search for smooth glow falloff. Tone-mapped
 *          with gamma correction. Colored stars with white cores.
 *
 * Deep field. Every point of light has been burning for billions of years.
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

float random(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 random2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float getGlow(float dist, float radius, float intensity) {
  return pow(radius / dist, intensity);
}

void main() {
  // Audio-driven time — bass drives depth motion
  float t = 1.0 + uPhaseBass * 0.08 + uPhaseMid * 0.02;

  float layers = 10.0;
  float scale = 32.0;
  float del = 1.0 / layers;

  // Bass affects perceived depth speed
  float depthSpeed = t * (1.0 + uBass * 0.3);

  // Rotation — treble adds spin energy
  float rotationAngle = uPhaseBass * -0.02 + uPhaseTreble * 0.01;
  mat2 rotation = mat2(
    cos(rotationAngle), -sin(rotationAngle),
    sin(rotationAngle),  cos(rotationAngle)
  );

  vec2 rot = vec2(cos(depthSpeed), sin(depthSpeed));

  vec3 col = vec3(0.0);

  for (float i = 0.0; i <= 1.0; i += del) {
    float depth = fract(i + t);

    // Camera center orbits with depth parallax
    vec2 centre = rot * 0.2 * depth + 0.5;

    vec2 uv = centre - vUV;
    uv.x *= uResolution.x / uResolution.y;
    uv *= rotation;
    uv *= mix(scale, 0.0, depth);

    vec2 fl = floor(uv);
    vec2 local_uv = uv - fl - 0.5;

    // 3x3 cell neighborhood
    for (float j = -1.0; j <= 1.0; j++) {
      for (float k = -1.0; k <= 1.0; k++) {
        vec2 cell = vec2(j, k);
        vec2 index = fl + cell;
        vec2 seed = 128.0 * i + index;

        vec2 pos = cell + 0.9 * (random2(seed) - 0.5);
        float phase = 128.0 * random(seed);

        // Star color — mid shifts the hue palette
        vec3 tone = vec3(
          random(seed),
          random(seed + 1.0),
          random(seed + 2.0)
        );
        // Mid-driven hue shift
        float hueShift = uPhaseMid * 0.03;
        tone = vec3(
          tone.r * cos(hueShift) + tone.g * sin(hueShift),
          tone.g * cos(hueShift) - tone.r * sin(hueShift),
          tone.b
        );

        // Size pulses with unique phase — beat makes ALL stars pulse together
        float basePulse = 0.5 + 0.5 * sin(phase * t);
        float beatPulse = pow(uBeat, 1.5);
        float size = (0.1 + basePulse) * depth * (1.0 + beatPulse * 0.8);

        // Glow — treble sharpens it (higher intensity exponent)
        float glowIntensity = 2.5 + uTreble * 1.5;
        float glow = size * getGlow(length(local_uv - pos), 0.07, glowIntensity);

        // White core + colored glow
        col += 5.0 * vec3(0.02 * glow) + tone * glow;
      }
    }
  }

  // Bass boosts overall brightness
  col *= 1.0 + uBass * 0.4;

  // Beat flash — brief white surge
  col += pow(uBeat, 2.0) * vec3(0.15, 0.12, 0.18);

  // Tone mapping
  col = 1.0 - exp(-col);

  // Gamma
  col = pow(col, vec3(0.4545));

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.2, vc * 0.2);
  col *= vig;

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
