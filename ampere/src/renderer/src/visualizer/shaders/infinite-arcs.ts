/**
 * @liminal gen5-infinite-arcs
 * @generation 5
 * @parents fractal + "mrange, exponential zoom, arcs, scale invariant"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/mlXGzs
 * @mutation Adapted from "Infinite Arcs II" by mrange (CC0).
 *          Exponential zoom creates scale-invariant infinite zoom.
 *          Arc SDF with per-cell random aperture, radius, and rotation.
 *          HSV coloring keyed to each cell's hash. Arcs rotate at
 *          speed proportional to their hash. Continuous zoom means
 *          you never reach the center.
 *
 * Arcs within arcs. The zoom never stops. Each ring is unique and eternal.
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

#define PI  3.141592654
#define TAU 6.283185307

const float ExpBy = log(1.2) / log(2.0);

// HSV to RGB
const vec4 hsv2rgb_K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + hsv2rgb_K.xyz) * 6.0 - hsv2rgb_K.www);
  return c.z * mix(hsv2rgb_K.xxx, clamp(p - hsv2rgb_K.xxx, 0.0, 1.0), c.y);
}

float hash(float co) {
  return fract(sin(co * 12.9898) * 13758.5453);
}

vec2 sca(float a) {
  return vec2(sin(a), cos(a));
}

// Arc SDF — sc is sin/cos of aperture, ra = radius, rb = thickness
float arc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y)
    ? length(p - sc * ra)
    : abs(length(p) - ra)) - rb;
}

float forward(float n) {
  return exp2(ExpBy * n);
}

float reverse(float n) {
  return log2(n) / ExpBy;
}

vec2 cell(float n) {
  float n2  = forward(n);
  float pn2 = forward(n - 1.0);
  float m   = (n2 + pn2) * 0.5;
  float w   = (n2 - pn2) * 0.5;
  return vec2(m, w);
}

vec2 df(vec2 p, float tm) {
  const float w = 2.0 / 3.0;

  float m = fract(tm);
  float f = floor(tm);
  float z = forward(m);

  vec2 p0 = p / z;

  float l0 = length(p0);
  float n0 = ceil(reverse(l0));
  vec2 c0 = cell(n0);

  float h0 = hash(n0 - f);
  float h1 = fract(3677.0 * h0);
  float h2 = fract(8677.0 * h0);
  float sh2 = (h2 - 0.5) * 2.0;

  // Arc rotation — bass drives spin speed
  float spinSpeed = 1.0 + uBass * 2.0;
  float a = TAU * h2 + sqrt(abs(sh2)) * sign(sh2) * tm * TAU / (20.0 / spinSpeed);
  float cs = cos(a), sn = sin(a);
  p0 = mat2(cs, -sn, sn, cs) * p0;

  // Treble sharpens the arcs (thinner)
  float thickness = w * (1.0 - uTreble * 0.3);
  float d0 = arc(p0, sca(PI / 4.0 + 0.5 * PI * h1), c0.x, c0.y * thickness);
  d0 *= z;

  return vec2(d0, h0);
}

void main() {
  float aa = 2.0 / uResolution.y;
  vec2 p = (vUV - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;

  // Audio-driven zoom time — bass is the zoom throttle
  float tm = uPhaseBass * 0.12 + uPhaseMid * 0.03;

  // Beat pulses a momentary zoom burst
  float beatBurst = pow(uBeat, 1.5) * 0.3;
  tm += beatBurst;

  vec2 d2 = df(p, tm);

  vec3 col = vec3(0.0);

  // Background color from arc hash — mid shifts hue
  float hue = d2.y + uPhaseMid * 0.04;
  float sat = 0.9;
  float val = smoothstep(10.0 * aa, 20.0 * aa, length(p));
  vec3 bcol = hsv2rgb(vec3(hue, sat, val));

  // Bass boosts saturation/brightness
  bcol *= 1.0 + uBass * 0.4;

  col = mix(col, bcol, smoothstep(aa, -aa, d2.x));

  // Beat flash — white surge
  float beatFlash = pow(uBeat, 1.5);
  col += beatFlash * vec3(0.1, 0.08, 0.12);

  // Gamma
  col = sqrt(col);

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
