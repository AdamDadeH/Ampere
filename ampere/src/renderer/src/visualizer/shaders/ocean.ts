/**
 * FBM ocean — layered wave octaves with raymarched water surface.
 * Technique from Seascape (Alexander Alekseev / TDM).
 * Multiple noise octaves at decreasing amplitude create realistic waves.
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

const int NUM_STEPS = 8;
const int ITER_GEOMETRY = 3;
const int ITER_FRAGMENT = 5;

const vec3 SEA_BASE = vec3(0.0, 0.09, 0.18);
const vec3 SEA_WATER = vec3(0.48, 0.54, 0.36);

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float seaOctave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float map(vec3 p, int iters) {
  float seaTime = uPhaseBass * 0.8;
  float freq = 0.16;
  float amp = 0.6 + uBass * 0.2;
  float choppy = 4.0 + uTreble * 2.0;

  vec2 uv = p.xz;
  float h = 0.0;

  mat2 octaveM = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    if (i >= iters) break;
    float d = seaOctave((uv + seaTime) * freq, choppy);
    d += seaOctave((uv - seaTime) * freq, choppy);
    h += d * amp;
    uv *= octaveM;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }
  return p.y - h;
}

vec3 getNormal(vec3 p, float eps) {
  vec3 n;
  n.y = map(p, ITER_FRAGMENT);
  n.x = map(vec3(p.x + eps, p.y, p.z), ITER_FRAGMENT) - n.y;
  n.z = map(vec3(p.x, p.y, p.z + eps), ITER_FRAGMENT) - n.y;
  n.y = eps;
  return normalize(n);
}

float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {
  float tm = 0.0;
  float tx = 200.0;
  float hx = map(ori + dir * tx, ITER_GEOMETRY);
  if (hx > 0.0) { p = ori + dir * tx; return tx; }
  float hm = map(ori + dir * tm, ITER_GEOMETRY);
  float tmid = 0.0;
  for (int i = 0; i < NUM_STEPS; i++) {
    tmid = mix(tm, tx, hm / (hm - hx));
    p = ori + dir * tmid;
    float hmid = map(p, ITER_GEOMETRY);
    if (hmid < 0.0) {
      tx = tmid;
      hx = hmid;
    } else {
      tm = tmid;
      hm = hmid;
    }
  }
  return tmid;
}

vec3 getSkyColor(vec3 e) {
  e.y = max(e.y, 0.0) + 0.1;
  return vec3(pow(1.0 - e.y, 2.0), 1.0 - e.y, 0.6 + (1.0 - e.y) * 0.4) * 1.1;
}

vec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {
  float fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
  fresnel = pow(fresnel, 3.0) * 0.5;

  vec3 reflected = getSkyColor(reflect(eye, n));
  vec3 refracted = SEA_BASE + SEA_WATER * 0.12 * max(dot(n, l), 0.0);

  vec3 color = mix(refracted, reflected, fresnel);
  float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
  color += vec3(0.12) * (p.y - 0.6) * atten * SEA_WATER;

  // Specular
  float spec = pow(max(dot(reflect(eye, n), l), 0.0), 60.0);
  color += vec3(spec);

  return color;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera
  float phase = uPhaseMid * 0.3;
  vec3 ori = vec3(0.0, 3.5, phase * 5.0);
  vec3 ang = vec3(sin(phase * 0.2) * 0.1, sin(phase * 0.15) * 0.05 + 0.3, phase * 0.5);

  // Build view matrix
  vec3 dir = normalize(vec3(uv, -2.0));
  float ca = cos(ang.x), sa = sin(ang.x);
  float cb = cos(ang.y), sb = sin(ang.y);
  dir = vec3(
    dir.x * cb + dir.z * sb,
    dir.y * ca - (dir.z * cb - dir.x * sb) * sa,
    dir.y * sa + (dir.z * cb - dir.x * sb) * ca
  );

  // Light
  vec3 light = normalize(vec3(0.0, 1.0, 0.8));

  // Raymarch
  vec3 p;
  heightMapTracing(ori, dir, p);
  vec3 dist = p - ori;
  vec3 n = getNormal(p, dot(dist, dist) * 0.001);

  // Color
  vec3 color = mix(
    getSkyColor(dir),
    getSeaColor(p, n, light, dir, dist),
    pow(smoothstep(0.0, -0.02, dir.y), 0.2)
  );

  // Audio: beat flash, bass depth tint
  color += uBeat * 0.08;
  color = mix(color, color * vec3(0.7, 0.85, 1.0), uBass * 0.3);

  fragColor = vec4(pow(color, vec3(0.65)), 1.0);
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
