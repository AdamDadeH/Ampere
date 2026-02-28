/**
 * "i like artefacts" by bergi — colored Kali set fractal voyage with
 * duckball_color texture mapping. 3D Kali set with animated magic
 * parameters creating an endlessly evolving fractal landscape.
 * Volumetric fog blending with fractal-colored sky.
 * @source https://www.shadertoy.com/view/4tX3W8
 * @author stefan berke (bergi)
 * @license aGPL3
 * @generation 6
 * @status SEED
 *
 * Audio: bass = fractal evolution + camera path via phase, mid = ambient
 * color modulation, treble = fog density, beat = color intensity pulse.
 * DIMENSIONS=3 variant. sec replaced with uPhaseBass * 0.05.
 * Iterations reduced for performance: NUM_ITER=17, NUM_TEX_ITER=45,
 * NUM_TRACE=80.
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

#define NUM_ITER 17
#define NUM_TEX_ITER 45
#define NORM_EPS 0.002
#define NUM_TRACE 80
#define PRECISSION 0.1
#define FOG_DIST 0.05

// Phase-driven animation time
float sec;

// Animated magic parameter (3D variant)
vec3 magicParam() {
  return vec3(
    -0.4 + 0.3 * sin(sec / 7.0),
    -0.8,
    -1.5 + 0.01 * sin(sec / 3.0)
  );
}

// Kali set distance
float duckball_s(in vec3 p) {
  float mag;
  vec3 mp = magicParam();
  for (int i = 0; i < NUM_ITER; ++i) {
    mag = dot(p, p);
    p = abs(p) / mag + mp;
  }
  return mag;
}

// Kali set color — accumulated orbit trap
vec3 duckball_color(in vec3 p) {
  vec3 col = vec3(0.0);
  float mag;
  vec3 mp = magicParam();
  for (int i = 0; i < NUM_TEX_ITER; ++i) {
    mag = dot(p, p);
    p = abs(p) / mag + mp;
    col += p;
  }
  return min(vec3(1.0), 2.0 * col / float(NUM_TEX_ITER));
}

float scene_d(in vec3 p) {
  return min(50.1 + 50.0 * sin(sec / 12.0), duckball_s(p) * 0.01 - 0.004);
}

vec3 scene_n(in vec3 p) {
  const vec3 e = vec3(NORM_EPS, 0.0, 0.0);
  return normalize(vec3(
    scene_d(p + e.xyy) - scene_d(p - e.xyy),
    scene_d(p + e.yxy) - scene_d(p - e.yxy),
    scene_d(p + e.yyx) - scene_d(p - e.yyx)
  ));
}

vec3 scene_color(in vec3 p) {
  // Ambient modulated by duckball color and uMid
  vec3 ambcol = vec3(
    0.9 + uMid * 0.15,
    0.5 - uMid * 0.1,
    0.1 + uMid * 0.35
  ) * (0.2 + duckball_color(p));
  float dull = max(0.0, dot(vec3(1.0), scene_n(p)));
  return ambcol * (0.3 + 0.7 * dull);
}

vec3 sky_color(in vec3 pos, in vec3 dir) {
  vec3 c = vec3(0.2, 0.6, 0.9);
  return c * 0.5 + 0.1 * duckball_color(dir + 0.3 * pos);
}

vec3 traceRay(in vec3 pos, in vec3 dir) {
  vec3 p;
  float t = 0.0;
  for (int i = 0; i < NUM_TRACE; ++i) {
    p = pos + t * dir;
    float d = scene_d(p);
    // Increase distance for too-close surfaces
    d += 0.01 * (1.0 - smoothstep(0.01, 0.011, t));
    t += d * PRECISSION;
  }
  // Fog density modulated by treble
  float fogDist = FOG_DIST * (1.0 + uTreble * 0.4);
  return mix(scene_color(p), sky_color(p, dir), min(2.6, t / fogDist));
}

vec2 rotate(in vec2 v, float r) {
  float s = sin(r), c = cos(r);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void main() {
  sec = uPhaseBass * 0.05;

  vec2 uv = (vUV * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;

  // Ray direction
  vec3 dir = normalize(vec3(uv, 1.5));

  // Camera path — wandering through fractal space
  vec3 pos = vec3(
    0.0 + 0.25 * sin(sec / 47.0),
    0.0 + 0.85 * sin(sec / 17.0),
    1.0 + 0.95 * sin(sec / 20.0)
  );

  // Camera rotation from uPhaseMid
  float camRot = uPhaseMid * 0.02;
  dir.xy = rotate(dir.xy, sec * 0.7 + sin(sec * 0.41) + camRot);
  dir.xz = rotate(dir.xz, sec * 0.6);

  // Trace
  vec3 col = traceRay(pos, dir);

  // Beat color intensity pulse
  col *= 1.0 + uBeat * 0.35;

  // Bass intensity
  col *= 1.0 + uBass * 0.2;

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
