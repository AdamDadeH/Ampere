/**
 * Sci-fi data corridor: voronoi floor layers, rotating gate circles,
 * data stream particles. All geometry ray-traced, fully procedural.
 * @source https://www.shadertoy.com/view/XsXXDn (srtuss, 2013)
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = overall intensity + camera orbit + stream speed (phase-driven),
 * mid = color exponent shift (hue), treble = godrays/sky detail,
 * beat = additive flash.
 * Camera orbit and circle rotation driven by uPhaseBass for smooth
 * audio-locked motion. Intensity modulation replaced with bass amplitude.
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

#define time (uPhaseBass * 0.2)

vec2 rotate(vec2 p, float a) {
  return vec2(p.x * cos(a) - p.y * sin(a), p.x * sin(a) + p.y * cos(a));
}

float box(vec2 p, vec2 b, float r) {
  return length(max(abs(p) - b, 0.0)) - r;
}

// iq's ray-plane-intersection
vec3 intersect(in vec3 o, in vec3 d, vec3 c, vec3 u, vec3 v) {
  vec3 q = o - c;
  return vec3(
    dot(cross(u, v), q),
    dot(cross(q, u), d),
    dot(cross(v, q), d)) / dot(cross(v, u), d);
}

// noise functions
float rand11(float p) {
  return fract(sin(p * 591.32) * 43758.5357);
}
float rand12(vec2 p) {
  return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5357);
}
vec2 rand21(float p) {
  return fract(vec2(sin(p * 591.32), cos(p * 391.32)));
}
vec2 rand22(in vec2 p) {
  return fract(vec2(sin(p.x * 591.32 + p.y * 154.077), cos(p.x * 391.32 + p.y * 49.077)));
}

float noise11(float p) {
  float fl = floor(p);
  return mix(rand11(fl), rand11(fl + 1.0), fract(p));
}
float fbm11(float p) {
  return noise11(p) * 0.5 + noise11(p * 2.0) * 0.25 + noise11(p * 5.0) * 0.125;
}
vec3 noise31(float p) {
  return vec3(noise11(p), noise11(p + 18.952), noise11(p - 11.372)) * 2.0 - 1.0;
}

// godrays from the surface - treble adds detail
float sky(vec3 p) {
  float a = atan(p.x, p.z);
  float t = time * 0.1;
  float v = rand11(floor(a * 4.0 + t)) * 0.5
          + rand11(floor(a * 8.0 - t)) * 0.25
          + rand11(floor(a * 16.0 + t)) * (0.125 + uTreble * 0.1);
  return v;
}

vec3 voronoi(in vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  vec2 mg;
  vec2 mr;
  float md = 8.0, md2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = rand22(n + g);
      vec2 r = g + o - f;
      float d = max(abs(r.x), abs(r.y));
      if (d < md) { md2 = md; md = d; mr = r; mg = g; }
      else if (d < md2) { md2 = d; }
    }
  }
  return vec3(n + mg, md2 - md);
}

#define A2V(a) vec2(sin((a) * 6.28318531 / 100.0), cos((a) * 6.28318531 / 100.0))

float circles(vec2 p) {
  float v, w, l, c;
  vec2 pp;
  l = length(p);

  // Inner segments - rotation driven by uPhaseBass
  pp = rotate(p, uPhaseBass * 0.2 * 3.0);
  c = max(dot(pp, normalize(vec2(-0.2, 0.5))), -dot(pp, normalize(vec2(0.2, 0.5))));
  c = min(c, max(dot(pp, normalize(vec2(0.5, -0.5))), -dot(pp, normalize(vec2(0.2, -0.5)))));
  c = min(c, max(dot(pp, normalize(vec2(0.3, 0.5))), -dot(pp, normalize(vec2(0.2, 0.5)))));

  // innerest rings
  v = abs(l - 0.5) - 0.03;
  v = max(v, -c);
  v = min(v, abs(l - 0.54) - 0.02);
  v = min(v, abs(l - 0.64) - 0.05);

  // Outer segments - counter-rotation
  pp = rotate(p, uPhaseBass * 0.2 * -1.333);
  c = max(dot(pp, A2V(-5.0)), -dot(pp, A2V(5.0)));
  c = min(c, max(dot(pp, A2V(25.0 - 5.0)), -dot(pp, A2V(25.0 + 5.0))));
  c = min(c, max(dot(pp, A2V(50.0 - 5.0)), -dot(pp, A2V(50.0 + 5.0))));
  c = min(c, max(dot(pp, A2V(75.0 - 5.0)), -dot(pp, A2V(75.0 + 5.0))));

  w = abs(l - 0.83) - 0.09;
  v = min(v, max(w, c));

  return v;
}

float shade1(float d) {
  float v = 1.0 - smoothstep(0.0, mix(0.012, 0.2, 0.0), d);
  float g = exp(d * -20.0);
  return v + g * 0.5;
}

void main() {
  vec2 fragCoord = vUV * uResolution;
  vec2 uv = fragCoord.xy / uResolution.xy;
  uv = uv * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera orbit driven by audio phase
  vec3 ro = 0.7 * vec3(cos(uPhaseBass * 0.1), 0.0, sin(uPhaseBass * 0.1));
  ro.y = cos(uPhaseBass * 0.1 * 3.0) * 0.3 + 0.65;
  vec3 ta = vec3(0.0, 0.2, 0.0);

  // Camera shake
  float shake = clamp(3.0 * (1.0 - length(ro.yz)), 0.3, 1.0);
  float st = mod(time, 10.0) * 143.0;

  // Build camera matrix
  vec3 ww = normalize(ta - ro + noise31(st) * shake * 0.01);
  vec3 uu = normalize(cross(ww, normalize(vec3(0.0, 1.0, 0.2 * sin(time)))));
  vec3 vv = normalize(cross(uu, ww));
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.0 * ww);

  ro += noise31(-st) * shake * 0.015;
  ro.x += time * 2.0;

  float inten = 0.0;

  // Background - sky godrays
  float sd = dot(rd, vec3(0.0, 1.0, 0.0));
  inten = pow(1.0 - abs(sd), 20.0) + pow(sky(rd), 5.0) * step(0.0, rd.y) * 0.2;

  vec3 its;
  float v, g;

  // Voronoi floor layers
  for (int i = 0; i < 4; i++) {
    float layer = float(i);
    its = intersect(ro, rd, vec3(0.0, -5.0 - layer * 5.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0));
    if (its.x > 0.0) {
      vec3 vo = voronoi((its.yz) * 0.05 + 8.0 * rand21(float(i)));
      v = exp(-100.0 * (vo.z - 0.02));

      float fx = 0.0;

      // Special FX on lowest layer
      if (i == 3) {
        float fxi = cos(vo.x * 0.2 + time * 1.5);
        fx = clamp(smoothstep(0.9, 1.0, fxi), 0.0, 0.9) * 1.0 * rand12(vo.xy);
        fx *= exp(-3.0 * vo.z) * 2.0;
      }
      inten += v * 0.1 + fx;
    }
  }

  // Draw the gates
  float gatex = floor(ro.x / 8.0 + 0.5) * 8.0 + 4.0;
  float go = -16.0;
  for (int i = 0; i < 4; i++) {
    its = intersect(ro, rd, vec3(gatex + go, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0));
    if (dot(its.yz, its.yz) < 2.0 && its.x > 0.0) {
      v = circles(its.yz);
      inten += shade1(v);
    }
    go += 8.0;
  }

  // Draw the data stream - speed driven by uPhaseBass
  for (int j = 0; j < 20; j++) {
    float id = float(j);

    vec3 bp = vec3(0.0, (rand11(id) * 2.0 - 1.0) * 0.25, 0.0);
    vec3 streamIts = intersect(ro, rd, bp, vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0));

    if (streamIts.x > 0.0) {
      vec2 pp = streamIts.yz;
      float spd = (1.0 + rand11(id) * 3.0) * 2.5;
      pp.y += uPhaseBass * 0.2 * spd;
      pp += (rand21(id) * 2.0 - 1.0) * vec2(0.3, 1.0);
      float rep = rand11(id) + 1.5;
      pp.y = mod(pp.y, rep * 2.0) - rep;
      float d = box(pp, vec2(0.02, 0.3), 0.1);
      float sv = 1.0 - smoothstep(0.0, 0.03, abs(d) - 0.001);
      float sg = min(exp(d * -20.0), 2.0);

      inten += (sv + sg * 0.7) * 0.5;
    }
  }

  // Intensity: bass drives overall brightness
  inten *= 0.4 + uBass * 0.6;

  // Color: non-GREEN_VERSION palette, mid shifts the exponents
  float midShift = uMid * 0.3;
  vec3 col = pow(vec3(inten), 1.5 * vec3(0.15 + midShift, 2.0 - midShift * 0.5, 9.0 - midShift * 2.0));

  // Beat flash
  col += uBeat * vec3(0.12, 0.08, 0.04);

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
