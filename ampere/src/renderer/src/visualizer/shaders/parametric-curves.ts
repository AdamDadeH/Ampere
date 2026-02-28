/**
 * Parametric curve renderer using bisection method to find closest
 * distance to epitrochoid curves. Stop-motion stepping via sfloor.
 * @source https://www.shadertoy.com/view/XdSSRw
 * @license CC BY-NC-SA 3.0 (nimitz)
 * @generation 6
 * @status SEED
 *
 * Audio: bass = curve thickness (phase-driven animation), mid = color warmth
 * shift, treble = grain intensity, beat = additive flash.
 * TYPE 2 (Epitrochoid), COLOR_TYPE 1.
 * Texture grain replaced with procedural hash noise.
 * iMouse removed -- curve animates purely from time.
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

#define time (uPhaseBass * 0.3)
#define pi 3.14159265

// Stride for the global minimum search
#define STRIDE 0.035

// Main iteration count
#define ITR 100

// Procedural hash noise (replaces iChannel0 texture)
float hashNoise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Stop-motion stepping for animation
float sfloor(in float x, in float w) {
  float fx = floor(x);
  return fx + smoothstep(fx + w, fx + 1.0 - w, x);
}

// Parametric equation: Epitrochoid (TYPE 2)
vec2 f(in float t) {
  float cam = sfloor(time * 0.4, 0.1) * pi * 2.0;
  const float R = 2.8;
  const float r = 0.4;
  float d = sin(time * 0.21) * 2.0 + 2.6;
  float x = (R + r) * cos(t - cam) - d * cos((R + r) / r * t);
  float y = (R + r) * sin(t) - d * sin((R + r) / r * t);
  return vec2(x, y);
}

// Squared distance from point (pixel) to curve
float fd(in vec2 p, in float t) {
  p = p + f(t);
  return dot(p, p);
}

// Root finding on the derivative via bisection
float bisect(in vec2 p, in float near, in float far) {
  float mid = 0.0;
  float mdrv = 0.0;
  float ep = 0.02;
  for (int i = 0; i <= 5; i++) {
    mid = (near + far) * 0.5;
    mdrv = fd(p, mid + ep) - fd(p, mid - ep);
    if (abs(mdrv) < 0.001) break;
    if (mdrv > 0.0) far = mid; else near = mid;
  }
  return length(p + f((near + far) * 0.5));
}

// Find global minimum region then refine with bisection
float intersect(in vec2 p, in float near, in float far) {
  float t = near;
  float told = near;
  float nr = 0.0, fr = 1.0;
  float mn = 10000.0;

  for (int i = 0; i <= 120; i++) {
    float d = fd(p, t);
    if (d < mn) {
      mn = d;
      nr = told;
      fr = t + 0.05;
    }
    if (t > far) break;
    told = t;
    t += log(d + 1.15) * STRIDE;
  }

  return bisect(p, nr, fr);
}

// Reinhard based tone mapping
vec3 tone(vec3 color, float gamma) {
  float white = 2.0;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float toneMappedLuma = luma * (1.0 + luma / (white * white)) / (1.0 + luma);
  color *= toneMappedLuma / luma;
  color = pow(color, vec3(1.0 / gamma));
  return color;
}

void main() {
  vec2 fragCoord = vUV * uResolution;
  vec2 p = fragCoord.xy / uResolution.xy - 0.5;
  vec2 bp = p + 0.5;
  p.x *= uResolution.x / uResolution.y;
  p *= 19.0;

  // Bass drives effective curve thickness by scaling the coordinate space
  float bassScale = 1.0 - uBass * 0.15;
  p *= bassScale;

  float rz = intersect(p, 0.0, 30.0);

  // COLOR_TYPE 1: warm default palette
  rz = pow(rz * 2.0, 0.5);

  // Mid shifts warmth: positive mid pushes toward warmer tones
  float warmth = uMid * 0.4;
  vec3 col = vec3(2.0 + warmth, 1.5 - warmth * 0.3, 0.1 + warmth * 0.2) * 1.0 - log(rz + 1.8);
  col = clamp(col, 0.5, 10.0);

  // Procedural grain (replaces iChannel0 texture lookup)
  float grain = (hashNoise(p * 0.00025 * uResolution.x + fract(time) * vec2(51.0, 100.0)) - 0.5);
  // Treble increases grain visibility
  col *= grain * (0.24 + uTreble * 0.15) + 1.0;

  col = mix(col, tone(col, 1.7), 0.5);

  // Vignette (iq style)
  col *= pow(16.0 * bp.x * bp.y * (1.0 - bp.x) * (1.0 - bp.y), 0.45);

  // Beat flash
  col += uBeat * vec3(0.15, 0.1, 0.06);

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
