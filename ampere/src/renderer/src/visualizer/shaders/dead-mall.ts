/**
 * @liminal gen0-dead-mall
 * @generation 0
 * @parents SEED
 * @status ACTIVE
 * @notes Raymarched abandoned mall corridor. Repeating storefronts with dark
 *        windows, reflective polished floor, rows of flickering fluorescent
 *        panels. Audio drives fog density, light decay, and the slow camera
 *        drift forward into nothing.
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
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

// Fluorescent light panel flicker — each panel has its own rhythm
float panelFlicker(float panelId, float t) {
  float base = 0.7 + 0.3 * sin(t * 120.0 + panelId * 17.0);
  float dropout = step(0.93, hash1(floor(t * 6.0) + panelId * 31.0));
  float warm = smoothstep(-0.2, 0.3, sin(t * 23.7 + panelId * 7.0));
  return mix(base * warm, 0.05, dropout);
}

// Distance to an infinite corridor with storefronts
// Corridor runs along Z axis, walls at x = +/- HALF_W
const float HALF_W = 5.0;
const float CEIL_H = 4.0;
const float FLOOR_Y = 0.0;

// Storefront: recessed rectangle in the wall
float storefrontDist(vec3 p, float side) {
  // Repeat storefronts every 6 units along Z
  float cellZ = 6.0;
  float zId = floor(p.z / cellZ);
  float zLocal = mod(p.z, cellZ) - cellZ * 0.5;

  // Storefront opening: 4 units wide, 3 units tall, recessed 0.8 units
  float inset = side * (abs(p.x) - HALF_W + 0.8);
  float inW = step(abs(zLocal), 2.0);
  float inH = step(FLOOR_Y, p.y) * step(p.y, 3.0);

  if (inW * inH > 0.5 && inset < 0.0) {
    return -inset; // inside the recess
  }
  return 1e5;
}

struct Hit {
  float dist;
  int mat; // 0=wall, 1=floor, 2=ceiling, 3=storefront glass, 4=light panel
};

Hit map(vec3 p) {
  Hit h;
  h.dist = 1e5;
  h.mat = 0;

  // Floor
  float floorD = p.y - FLOOR_Y;
  if (floorD < h.dist) { h.dist = floorD; h.mat = 1; }

  // Ceiling
  float ceilD = CEIL_H - p.y;
  if (ceilD < h.dist) { h.dist = ceilD; h.mat = 2; }

  // Walls
  float wallD = HALF_W - abs(p.x);
  if (wallD < h.dist) { h.dist = wallD; h.mat = 0; }

  // Storefront recesses (darken as glass)
  float cellZ = 6.0;
  float zLocal = mod(p.z, cellZ) - cellZ * 0.5;
  float inW = step(abs(zLocal), 2.0);
  float inH = step(FLOOR_Y, p.y) * step(p.y, 3.0);
  float nearWall = step(HALF_W - 0.85, abs(p.x));
  if (inW * inH * nearWall > 0.5) {
    h.mat = 3;
  }

  // Ceiling light panels — every 6 units along Z, centered
  float lightZ = mod(p.z + 3.0, 6.0) - 3.0;
  float lightPanel = max(abs(lightZ) - 0.6, abs(p.x) - 0.4);
  float lightCeil = abs(p.y - CEIL_H + 0.02);
  float lightD = max(lightPanel, lightCeil);
  if (lightD < h.dist && p.y > CEIL_H - 0.1) {
    h.dist = lightD;
    h.mat = 4;
  }

  return h;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.005, 0.0);
  float d = map(p).dist;
  return normalize(vec3(
    map(p + e.xyy).dist - d,
    map(p + e.yxy).dist - d,
    map(p + e.yyx).dist - d
  ));
}

// Floor tile pattern
float floorTile(vec2 p) {
  vec2 g = abs(fract(p * 0.5) - 0.5);
  float grout = smoothstep(0.47, 0.49, max(g.x, g.y));
  // Checkerboard tint
  vec2 id = floor(p * 0.5);
  float checker = mod(id.x + id.y, 2.0);
  return mix(0.7, 0.85, checker) * (1.0 - grout * 0.3);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: walking forward through the mall, never arriving
  float walkZ = uPhaseBass * 2.0;
  float sway = sin(uPhaseMid * 0.6) * 0.4;
  vec3 ro = vec3(sway, 1.7, walkZ);

  // Look direction: slightly varying, mostly forward
  float lookX = sin(uPhaseTreble * 0.1) * 0.1;
  float lookY = sin(uPhaseMid * 0.15) * 0.05 - 0.05;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.7 + lookY, 1.0));

  // --- Raymarch ---
  float t = 0.0;
  int hitMat = -1;
  vec3 hitPos = ro;

  for (int i = 0; i < 80; i++) {
    hitPos = ro + rd * t;
    Hit h = map(hitPos);

    if (h.dist < 0.005) {
      hitMat = h.mat;
      break;
    }
    if (t > 50.0) break;

    t += h.dist * 0.8;
  }

  // Nearest light panel for this point
  float panelZ = floor(hitPos.z / 6.0) * 6.0 + 3.0;
  float panelId = floor(hitPos.z / 6.0);
  vec3 lightPos = vec3(0.0, CEIL_H - 0.1, panelZ);
  float lightOn = panelFlicker(panelId, uTime + uBeat * 0.5);
  vec3 lightColor = vec3(0.9, 0.95, 1.0) * lightOn;

  // Also consider adjacent panels
  float panelId2 = panelId + 1.0;
  float lightOn2 = panelFlicker(panelId2, uTime + uBeat * 0.5);
  vec3 lightPos2 = vec3(0.0, CEIL_H - 0.1, panelZ + 6.0);

  vec3 col = vec3(0.0);

  if (hitMat == -1) {
    // Far void — deep fog
    col = vec3(0.02, 0.025, 0.03);
  }
  else {
    vec3 n = calcNormal(hitPos);

    // Two-light contribution
    vec3 toL1 = lightPos - hitPos;
    float d1 = length(toL1);
    vec3 l1 = toL1 / d1;
    float atten1 = lightOn / (1.0 + d1 * 0.08 + d1 * d1 * 0.008);

    vec3 toL2 = lightPos2 - hitPos;
    float d2 = length(toL2);
    vec3 l2 = toL2 / d2;
    float atten2 = lightOn2 / (1.0 + d2 * 0.08 + d2 * d2 * 0.008);

    float diff = max(dot(n, l1), 0.0) * atten1 + max(dot(n, l2), 0.0) * atten2;

    if (hitMat == 0) {
      // Walls — beige/cream paint, slightly dirty
      float dirt = noise(hitPos.yz * 2.0) * 0.15;
      vec3 wallCol = vec3(0.55, 0.50, 0.45) - dirt;
      col = wallCol * diff * vec3(0.9, 0.92, 1.0);
    }
    else if (hitMat == 1) {
      // Floor — polished tile, reflective
      float tile = floorTile(hitPos.xz);
      vec3 floorCol = vec3(0.5, 0.48, 0.45) * tile;
      col = floorCol * diff * vec3(0.9, 0.92, 1.0);

      // Floor reflection of ceiling lights — fake specular
      vec3 refl = reflect(rd, n);
      float spec1 = pow(max(dot(refl, l1), 0.0), 20.0) * atten1;
      float spec2 = pow(max(dot(refl, l2), 0.0), 20.0) * atten2;
      col += vec3(0.8, 0.85, 1.0) * (spec1 + spec2) * 0.4;
    }
    else if (hitMat == 2) {
      // Ceiling — acoustic tile
      vec3 ceilCol = vec3(0.45, 0.44, 0.42);
      float ceilTile = abs(fract(hitPos.x * 0.5) - 0.5) + abs(fract(hitPos.z * 0.5) - 0.5);
      ceilTile = smoothstep(0.45, 0.5, ceilTile);
      ceilCol = mix(ceilCol, ceilCol * 0.85, ceilTile);
      col = ceilCol * diff * vec3(0.9, 0.92, 1.0);
    }
    else if (hitMat == 3) {
      // Storefront glass — dark, faint reflection
      vec3 glassCol = vec3(0.03, 0.04, 0.05);
      vec3 refl = reflect(rd, n);
      float spec = pow(max(dot(refl, l1), 0.0), 40.0) * atten1;
      col = glassCol + vec3(0.5, 0.55, 0.6) * spec * 0.3;
      // Faint interior glow from some stores (audio reactive)
      float storeGlow = smoothstep(0.6, 0.9, hash1(panelId * 7.0 + 3.0));
      col += vec3(0.03, 0.01, 0.0) * storeGlow * (0.5 + uMid * 0.5);
    }
    else if (hitMat == 4) {
      // Light panel — emissive
      col = vec3(0.95, 0.97, 1.0) * lightOn * 1.5;
    }

    // Distance fog — murky warm
    float fog = 1.0 - exp(-t * 0.025);
    vec3 fogColor = vec3(0.04, 0.04, 0.045) + uBass * vec3(0.01, 0.005, 0.0);
    col = mix(col, fogColor, fog);
  }

  // Beat: subtle warm flash
  col += uBeat * vec3(0.03, 0.025, 0.02);

  // Vignette
  float vig = 1.0 - dot(uv * 0.35, uv * 0.35);
  col *= vig;

  // Tone map
  col = pow(col, vec3(0.9));

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
