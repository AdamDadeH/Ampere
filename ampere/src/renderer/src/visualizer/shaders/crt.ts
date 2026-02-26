/**
 * CRT post-processing — scanlines, barrel distortion, chromatic aberration,
 * RGB phosphor mask, interference bands, ghost image, vignette.
 * Inspired by mdVSRD on Shadertoy.
 * @source https://www.shadertoy.com/view/mdVSRD
 */

export const fragmentSource = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uBeat;

// Screen curvature — cosine-based barrel distortion
vec2 curveUV(vec2 uv) {
  float roundness = 0.25;
  uv = (uv - 0.5) * 2.0;
  uv.x /= cos(roundness * abs(uv.y) * 0.5);
  uv.y /= cos(roundness * abs(uv.x) * 0.5);
  return uv * 0.5 + 0.5;
}

// Scanline quantization
vec2 scanlineUV(vec2 uv) {
  float scanH = uResolution.y * 0.5;
  float jitter = abs(sin(113.0 * uTime)) * 0.0003 / (1.0 - uv.y + 0.01);
  return vec2(uv.x + jitter, floor(uv.y * scanH) / scanH);
}

float rnd(float x) {
  return fract(sin(x * 37549.54) + sin(x * 375.46));
}

void main() {
  vec2 uv = curveUV(vUV);

  // Border: black outside curved screen
  float borderX = smoothstep(0.0, 0.015, 0.5 - abs(uv.x - 0.5));
  float borderY = smoothstep(0.0, 0.015, 0.5 - abs(uv.y - 0.5));
  float border = borderX * borderY;

  if (border < 0.001) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Horizontal noise jitter — subtle per-line wobble
  float hNoise = 0.001 * rnd(uTime + 0.1 * uv.y) * abs(uv.x - 0.5);
  uv.x += hNoise * (1.0 + uBeat * 2.0);

  vec2 suv = scanlineUV(uv);

  // --- Chromatic aberration — audio-reactive ---
  float aberration = 0.0015 + uBass * 0.003 + uBeat * 0.004;
  float r = texture(uScene, suv + vec2(aberration, 0.0)).r;
  float g = texture(uScene, suv).g;
  float b = texture(uScene, suv - vec2(aberration, 0.0)).b;
  vec3 col = vec3(r, g, b);

  // --- Ghost image — faint inverted offset ---
  float ghostDist = 0.04;
  float ghostAmt = 0.06;
  vec3 ghost = 0.3 - texture(uScene, scanlineUV(uv - vec2(ghostDist, 0.0))).rgb;
  col += ghostAmt * ghost;

  // --- Interference bands — scrolling color shifts ---
  // Warm band
  float band1 = smoothstep(0.0, 0.05, fract(uv.y * 0.1 + 0.2 * uTime + 0.1 * rnd(uTime)));
  col *= mix(vec3(1.0, 0.85, 0.8), vec3(1.0), band1);

  // Blue interference flicker
  float band2 = 1.0 - smoothstep(0.0, 0.01, fract(uv.y * 0.09 + 0.1 * uTime + 0.1 * rnd(uTime)));
  float band2Noise = rnd(0.01 * uv.x + uTime + floor(uv.y * uResolution.y * 0.5));
  col += 0.25 * band2 * vec3(0.3, 0.4, 0.9) * band2Noise;

  // --- RGB phosphor sub-pixel mask ---
  float gridW = uResolution.x * 1.2;
  float gridH = uResolution.y * 0.8;
  float p = (uv.x * gridW + floor(uv.y * gridH)) * 3.14159;
  float gridDep = 0.7; // 0 = full mask, 1 = no mask
  float gridPow = 1.8;
  float gain = 0.85;
  vec3 mask;
  mask.r = mix(pow(max(0.0, sin(p)), gridPow), 1.15 * gain, gridDep);
  mask.g = mix(pow(max(0.0, sin(p + 2.2)), gridPow), 1.25 * gain, gridDep);
  mask.b = mix(pow(max(0.0, sin(p + 4.4)), gridPow), 1.25 * gain, gridDep);

  // Scanline darkening
  float scanline = pow(abs(sin(uv.y * uResolution.y * 0.5 * 3.14159)), 2.6);
  float scanCoeff = mix(scanline, 1.0, 0.55);

  // Brightness compensation — scale with average luminance
  float lum = 2.0 - (col.r + col.g + col.b) * 0.33;
  vec3 coeff = vec3(lum) * scanCoeff * mask;

  // Apply phosphor + scanline effect (subtle mix)
  float globalMix = 0.35; // how much CRT effect vs clean
  col *= mix(vec3(1.0), coeff, globalMix);

  // --- Vignette ---
  float vig = pow(1.0 - length(uv - vec2(0.5)), 0.3);
  col *= vig;

  // Border fade
  col *= border;

  // Slight warmth
  col *= vec3(0.97, 1.0, 0.97);

  fragColor = vec4(max(col, 0.0), 1.0);
}
`

export const defaultUniforms: Record<string, number> = {
  uBass: 0,
  uBeat: 0,
}
