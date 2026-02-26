/**
 * @liminal gen5-interior-light
 * @generation 5
 * @parents backrooms + menger + "mu6k, interior, light shafts"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/XdfGzS
 * @mutation Adapted from "Structure" by mu6k.
 *          Domain-repeated boxes with vertical reflection (abs(p.y))
 *          creating floor/ceiling symmetry. Multiple animated colored
 *          point lights orbit through the scene. 2-pass soft shadow
 *          occlusion, 8-sample ambient occlusion, Lambertian diffuse +
 *          specular. Lens flare from visible lights. Beautiful
 *          atmospheric light shafts in a minimal geometric space.
 *
 * Light fills the room. The boxes cast long shadows. You're inside the grid.
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

#define REP 6.0
#define FAR 60.0
#define NUM_LIGHTS 3

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

// Scene SDF — domain-repeated boxes with floor/ceiling symmetry
float dist(vec3 p) {
  // Vertical reflection: floor = ceiling
  p.y = abs(p.y);

  // Domain repetition in XZ
  vec2 cell = floor((p.xz + REP * 0.5) / REP);
  p.xz = mod(p.xz + REP * 0.5, REP) - REP * 0.5;

  // Floor/ceiling planes
  float fl = 3.0 - p.y;

  // Per-cell random boxes (up to 4 per cell)
  float d = fl;
  float cellHash = hash(cell);
  for (float i = 0.0; i < 4.0; i++) {
    float h = hash1(cellHash * 100.0 + i * 17.3);
    float h2 = hash1(cellHash * 200.0 + i * 31.7);
    float h3 = hash1(cellHash * 300.0 + i * 47.1);

    // Skip some boxes randomly
    if (h < 0.3) continue;

    vec3 boxPos = vec3(
      (h2 - 0.5) * REP * 0.7,
      0.0,
      (h3 - 0.5) * REP * 0.7
    );
    vec3 boxSize = vec3(
      0.3 + h * 0.8,
      0.5 + h2 * 2.0,
      0.3 + h3 * 0.8
    );
    vec3 q = abs(p - boxPos) - boxSize;
    float box = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    d = min(d, box);
  }

  return d;
}

vec3 calcNormal(vec3 p) {
  const float e = 0.005;
  return normalize(vec3(
    dist(vec3(p.x + e, p.y, p.z)) - dist(vec3(p.x - e, p.y, p.z)),
    dist(vec3(p.x, p.y + e, p.z)) - dist(vec3(p.x, p.y - e, p.z)),
    dist(vec3(p.x, p.y, p.z + e)) - dist(vec3(p.x, p.y, p.z - e))
  ));
}

// 2-pass soft shadow — fixed step search then refinement
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 24; i++) {
    float h = dist(ro + rd * t);
    res = min(res, k * h / t);
    if (h < 0.001 || t > maxt) break;
    t += clamp(h, 0.02, 0.5);
  }
  return clamp(res, 0.0, 1.0);
}

// 8-sample ambient occlusion
float calcAO(vec3 pos, vec3 nor) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i);
    float d = dist(pos + h * nor);
    occ += (h - d) * sca;
    sca *= 0.75;
  }
  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

// Animated light positions
vec3 lightPos(int idx, float t) {
  float fi = float(idx);
  float speed = 1.0 + fi * 0.3;
  return vec3(
    sin(t * speed * 0.7 + fi * 2.1) * 8.0,
    sin(t * speed * 0.5 + fi * 1.3) * 1.5,
    cos(t * speed * 0.6 + fi * 3.7) * 8.0
  );
}

// Light colors — mid shifts the palette
vec3 lightColor(int idx, float midPhase) {
  float fi = float(idx);
  float hue = fi * 0.33 + midPhase * 0.05;
  float s = 0.6 + fi * 0.1;
  // Simple HSV to RGB
  vec3 c = clamp(abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return mix(vec3(1.0), c, s) * (1.5 + fi * 0.3);
}

vec4 trace(vec3 o, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 120; i++) {
    float d = dist(o + rd * t);
    if (d < 0.001) return vec4(o + rd * t, t);
    t += d;
    if (t > FAR) break;
  }
  return vec4(o + rd * t, FAR);
}

void main() {
  vec2 uv = (vUV - 0.5) * 2.0;
  uv.x *= uResolution.x / uResolution.y;

  // Audio-driven time
  float t = uPhaseBass * 0.15 + uPhaseMid * 0.05;

  // Orbiting camera — bass widens the orbit
  float orbitRadius = 4.0 + uBass * 2.0;
  float camAngle = t * 0.8;
  vec3 ro = vec3(
    sin(camAngle) * orbitRadius,
    0.8 + sin(t * 1.3) * 0.5,
    cos(camAngle) * orbitRadius
  );

  // Look toward origin with slight drift
  vec3 target = vec3(sin(t * 0.3) * 2.0, 0.0, cos(t * 0.4) * 2.0);
  vec3 forward = normalize(target - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  vec3 rd = normalize(forward + uv.x * right + uv.y * up);

  // Trace
  vec4 hit = trace(ro, rd);
  vec3 col = vec3(0.0);

  if (hit.w < FAR) {
    vec3 pos = hit.xyz;
    vec3 nor = calcNormal(pos);
    float ao = calcAO(pos, nor);

    // Surface color — neutral gray/warm
    vec3 matCol = vec3(0.35, 0.32, 0.3);

    // Accumulate lighting from all point lights
    for (int i = 0; i < NUM_LIGHTS; i++) {
      vec3 lp = lightPos(i, t);
      vec3 lc = lightColor(i, uPhaseMid);

      vec3 ld = lp - pos;
      float ldist = length(ld);
      ld /= ldist;

      // Lambertian diffuse
      float diff = max(dot(nor, ld), 0.0);

      // Blinn-Phong specular — treble sharpens it
      vec3 h = normalize(ld - rd);
      float specPow = 32.0 + uTreble * 64.0;
      float spec = pow(max(dot(nor, h), 0.0), specPow);

      // Attenuation
      float atten = 1.0 / (1.0 + ldist * ldist * 0.02);

      // Soft shadow
      float sha = softShadow(pos + nor * 0.01, ld, 0.02, ldist, 8.0);

      // Bass drives light intensity
      float lightBoost = 1.0 + uBass * 0.6;

      col += matCol * lc * diff * atten * sha * ao * lightBoost;
      col += lc * spec * atten * sha * 0.5;
    }

    // Ambient
    col += matCol * vec3(0.02, 0.02, 0.03) * ao;
  }

  // Lens flare from each light
  for (int i = 0; i < NUM_LIGHTS; i++) {
    vec3 lp = lightPos(i, t);
    vec3 lc = lightColor(i, uPhaseMid);

    // Project light position to screen
    vec3 ld = lp - ro;
    float ldot = dot(ld, normalize(vec3(forward + uv.x * right + uv.y * up)));
    vec3 ldir = lp - ro;
    float lz = dot(ldir, forward);
    if (lz > 0.0) {
      vec2 lscreen = vec2(dot(ldir, right), dot(ldir, up)) / lz;
      float flare = 0.02 / (0.01 + length(uv - lscreen));
      // Only show flare if light is in front of nearest surface
      float ldist = length(ldir);
      if (ldist < hit.w + 1.0) {
        col += lc * flare * 0.15;
      }
    }
  }

  // Beat flash — white-hot pulse
  float beatFlash = pow(uBeat, 1.5);
  col += beatFlash * vec3(0.1, 0.08, 0.12);
  col *= 1.0 + beatFlash * 0.3;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.3, vc * 0.3);
  col *= vig;

  // Tone mapping
  col = col / (1.0 + col);

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
