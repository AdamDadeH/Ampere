/**
 * "No love" by bergi — Kali set fractal flythrough with predefined orbital
 * path (PATH 1). Ray marching with normal-based shading and fog blending.
 * The surface normal shades pixels regardless of hit/miss, creating a
 * dreamlike atmospheric rendering.
 * @source https://www.shadertoy.com/view/4tX3W8
 * @author stefan berke (bergi)
 * @license aGPL3
 * @generation 6
 * @status SEED
 *
 * Audio: bass = fractal evolution via phase, mid = camera rotation + ambient
 * color, treble = fog clarity, beat = brightness pulse.
 * Uses PATH 1 predefined orbit. sec replaced with uPhaseBass * 0.05.
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

#define NUM_ITER 32
#define NORM_EPS 0.002
#define NUM_TRACE 50
#define PRECISSION 0.2
#define FOG_DIST 0.1
#define MAGIC_PARAM vec3(-0.5, -0.4, -1.5)

// Kali set distance estimator
float duckball_s(in vec3 p) {
  float mag;
  for (int i = 0; i < NUM_ITER; ++i) {
    mag = dot(p, p);
    p = abs(p) / mag + MAGIC_PARAM;
  }
  return mag;
}

float scene_d(in vec3 p) {
  return duckball_s(p) * 0.01 - 0.004;
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
  // Ambient color shifts with uMid
  vec3 ambcol = vec3(
    0.9 + uMid * 0.2,
    0.5 - uMid * 0.15,
    0.1 + uMid * 0.4
  );
  float dull = max(0.0, dot(vec3(1.0), scene_n(p)));
  return ambcol * (0.3 + 0.7 * dull);
}

vec3 sky_color(in vec3 dir) {
  vec3 c1 = vec3(0.3, 0.4, 0.7);
  vec3 c2 = vec3(0.2, 0.6, 0.9);
  vec3 c3 = vec3(0.0, 0.3, 0.5);
  return mix(
    mix(c1, c2, smoothstep(-1.0, 0.5, dir.y)),
    c3, smoothstep(0.5, 0.1, dir.y)
  );
}

vec3 traceRay(in vec3 pos, in vec3 dir) {
  vec3 p;
  float t = 0.0;
  for (int i = 0; i < NUM_TRACE; ++i) {
    p = pos + t * dir;
    float d = scene_d(p);
    t += d * PRECISSION;
  }
  // Fog clarity increases with treble
  float fogDist = FOG_DIST * (1.0 + uTreble * 0.5);
  return mix(scene_color(p), sky_color(dir), t / fogDist);
}

vec2 rotate(in vec2 v, float r) {
  float s = sin(r), c = cos(r);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void main() {
  vec2 uv = (vUV * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;

  // Ray direction
  vec3 dir = normalize(vec3(uv, 1.5));

  // Phase-driven animation time
  float sec = uPhaseBass * 0.05;

  // PATH 1 — predefined orbit
  vec3 pos = vec3(
    2.48 + 0.01 * cos(sec * 2.0),
    -0.56 + 0.07 * sin(sec - 0.05),
    -1.5 + 0.1 * sin(sec)
  );

  // Camera rotation from uPhaseMid
  float camRot = uPhaseMid * 0.02;
  dir.xz = rotate(dir.xz, sec * 0.3 + camRot);
  dir.xy = rotate(dir.xy, 1.0);

  // Trace
  vec3 col = traceRay(pos, dir);

  // Beat brightness pulse
  col += uBeat * vec3(0.1, 0.08, 0.06);

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
