/**
 * @seed deep-forest
 * @technique Volumetric fog + SDF trees + god rays
 * @status SEED
 * @description Dense foggy forest. Walking between tall dark trunks.
 *              Volumetric light shafts pierce the canopy. Fog swirls.
 *              Bass drives fog density, mid sways branches, treble
 *              adds leaf shimmer, beat sends light shafts.
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

float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                 mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                 mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    f += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return f;
}

// Tree trunk SDF — cylinder with taper
float treeTrunk(vec3 p, vec2 treePos, float height, float radius) {
  vec2 d2 = p.xz - treePos;
  float dist2D = length(d2);

  // Taper: wider at base
  float taper = radius * (1.0 - p.y / height * 0.4);

  // Trunk sway from mid
  float sway = sin(p.y * 0.5 + uPhaseMid * 0.3 + treePos.x) * 0.05 * p.y;
  dist2D += sway;

  float trunk = dist2D - taper;
  float capY = max(p.y - height, -p.y); // cap top and bottom
  return max(trunk, capY);
}

// Forest — scattered trees
float forestSDF(vec3 p) {
  float d = 1e5;

  // Grid of trees with jitter
  vec2 cellSize = vec2(2.5, 2.5);
  vec2 cellId = floor(p.xz / cellSize);

  for (int dx = -1; dx <= 1; dx++) {
    for (int dz = -1; dz <= 1; dz++) {
      vec2 cId = cellId + vec2(float(dx), float(dz));
      float rnd = hash(cId);

      if (rnd < 0.15) continue; // some cells empty

      // Jittered tree position
      vec2 treePos = (cId + 0.5) * cellSize;
      treePos += (vec2(hash(cId + 0.1), hash(cId + 0.2)) - 0.5) * cellSize * 0.6;

      float height = 5.0 + rnd * 4.0;
      float radius = 0.15 + hash(cId + 0.3) * 0.1;

      d = min(d, treeTrunk(p, treePos, height, radius));
    }
  }

  // Ground — gentle undulation
  float ground = p.y - (fbm(p.xz * 0.3) * 0.4 - 0.3);
  d = min(d, ground);

  return d;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.005, 0.0);
  float d = forestSDF(p);
  return normalize(vec3(
    forestSDF(p + e.xyy) - d,
    forestSDF(p + e.yxy) - d,
    forestSDF(p + e.yyx) - d
  ));
}

// Volumetric fog
float fogDensity(vec3 p) {
  float base = 0.15 + uBass * 0.15;
  float height = exp(-max(p.y - 1.0, 0.0) * 0.5); // denser low
  float swirl = noise3(p * 0.5 + vec3(uPhaseBass * 0.2, 0.0, uPhaseMid * 0.1)) * 0.5 + 0.5;
  return base * height * swirl;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: walking through the forest
  float walkZ = uPhaseBass * 1.5;
  float walkX = sin(uPhaseMid * 0.15) * 2.0;
  vec3 ro = vec3(walkX, 1.6, walkZ);

  float lookX = sin(uPhaseTreble * 0.07) * 0.1;
  float lookY = sin(uPhaseMid * 0.1) * 0.05;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.6 + lookY, 1.0));

  // Light direction: filtering through canopy
  vec3 lightDir = normalize(vec3(0.3, 0.8, 0.2));
  vec3 lightCol = vec3(1.0, 0.9, 0.7);

  // Raymarch
  float t = 0.0;
  bool hit = false;
  vec3 col = vec3(0.0);
  float fogAccum = 0.0;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = forestSDF(p);

    // Accumulate fog
    float fog = fogDensity(p);

    // God rays: check if this point can see the sky
    float shadow = forestSDF(p + lightDir * 2.0);
    float lit = smoothstep(0.0, 0.5, shadow);
    float rayLight = fog * lit * 0.015 * (1.0 + uBeat * 1.5);
    fogAccum += rayLight;

    if (d < 0.005) {
      hit = true;
      break;
    }
    if (t > 25.0) break;

    t += max(d * 0.7, 0.05);
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    float isGround = step(0.8, n.y);

    // Lighting
    float diff = max(dot(n, lightDir), 0.0);
    float amb = 0.08;

    if (isGround > 0.5) {
      // Forest floor: brown/green
      vec3 floorCol = vec3(0.15, 0.12, 0.08);
      floorCol = mix(floorCol, vec3(0.1, 0.15, 0.05), noise(p.xz * 3.0));
      col = floorCol * (diff * lightCol * 0.3 + amb);
    } else {
      // Tree bark: dark brown
      vec3 barkCol = vec3(0.18, 0.12, 0.08);
      float barkTex = noise(vec2(atan(n.x, n.z) * 3.0, p.y * 5.0));
      barkCol *= (0.7 + barkTex * 0.3);
      col = barkCol * (diff * lightCol * 0.4 + amb);
    }

    // Distance fog
    float distFog = 1.0 - exp(-t * 0.05);
    vec3 fogCol = vec3(0.15, 0.18, 0.12);
    col = mix(col, fogCol, distFog);
  } else {
    // Canopy / sky glimpse
    vec3 canopy = vec3(0.08, 0.12, 0.06);
    float skyPeek = smoothstep(0.3, 0.6, rd.y);
    col = mix(canopy, vec3(0.4, 0.5, 0.4), skyPeek * 0.3);
  }

  // Add god rays
  col += lightCol * fogAccum;

  // Leaf particles — treble shimmer
  float leaf = smoothstep(0.97, 1.0, noise(uv * 15.0 + vec2(uPhaseTreble * 0.5, uPhaseBass * 0.3)));
  col += vec3(0.3, 0.4, 0.1) * leaf * 0.3 * (1.0 + uTreble * 0.5);

  // Vignette — heavy, dark forest
  float vig = 1.0 - dot(uv * 0.35, uv * 0.35);
  col *= vig;

  col = pow(col, vec3(0.85));
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
