/**
 * @liminal gen5-neon-rain
 * @generation 5
 * @parents neon-city + stormclouds + "street-level, blade runner, immersive"
 * @status ACTIVE
 * @mutation Crossover: neon-city's building grid + stormclouds' volumetric
 *          atmosphere. Camera at street level looking up through rain.
 *          Buildings form towering canyons. Neon signs scatter colored
 *          light through volumetric rain-fog. Wet ground reflects
 *          everything. Much more atmospheric and immersive than the
 *          original bird's-eye neon-city.
 *
 * Blade Runner streets. Rain. Neon. The city swallows you.
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

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
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

const float STREET_W = 2.5;
const float CELL_Z = 3.0;

// Building height per cell
float buildingH(vec2 cellId) {
  return 8.0 + hash(cellId) * 18.0;
}

// Building width variation
float buildingW(vec2 cellId) {
  return 0.8 + hash(cellId + 5.0) * 0.5;
}

// Neon color for a building
vec3 neonHue(float id) {
  float phase = uPhaseMid * 0.08 + id * 3.7;
  vec3 c = vec3(
    0.5 + 0.5 * sin(phase),
    0.5 + 0.5 * sin(phase + 2.1),
    0.5 + 0.5 * sin(phase + 4.2)
  );
  return c * c * 2.0; // saturated and bright
}

// City SDF — street canyon
float citySDF(vec3 p) {
  // Ground
  float ground = p.y;

  // Building rows on each side
  float zId = floor(p.z / CELL_Z);
  float zLocal = mod(p.z, CELL_Z) - CELL_Z * 0.5;

  float bestD = ground;

  // Left row
  vec2 cellL = vec2(-1.0, zId);
  float hL = buildingH(cellL) * (1.0 + uBass * 0.08);
  float wL = buildingW(cellL);
  vec3 bpL = vec3(p.x + STREET_W + wL, p.y - hL * 0.5, zLocal);
  vec3 dL = abs(bpL) - vec3(wL, hL * 0.5, CELL_Z * 0.44);
  float buildL = length(max(dL, 0.0)) + min(max(dL.x, max(dL.y, dL.z)), 0.0);
  bestD = min(bestD, buildL);

  // Right row
  vec2 cellR = vec2(1.0, zId);
  float hR = buildingH(cellR) * (1.0 + uBass * 0.08);
  float wR = buildingW(cellR);
  vec3 bpR = vec3(p.x - STREET_W - wR, p.y - hR * 0.5, zLocal);
  vec3 dR = abs(bpR) - vec3(wR, hR * 0.5, CELL_Z * 0.44);
  float buildR = length(max(dR, 0.0)) + min(max(dR.x, max(dR.y, dR.z)), 0.0);
  bestD = min(bestD, buildR);

  // Adjacent z cells for continuity
  float zId2 = zId + sign(zLocal);
  float zLocal2 = zLocal - sign(zLocal) * CELL_Z;

  vec2 cellL2 = vec2(-1.0, zId2);
  float hL2 = buildingH(cellL2) * (1.0 + uBass * 0.08);
  float wL2 = buildingW(cellL2);
  vec3 bpL2 = vec3(p.x + STREET_W + wL2, p.y - hL2 * 0.5, zLocal2);
  vec3 dL2_ = abs(bpL2) - vec3(wL2, hL2 * 0.5, CELL_Z * 0.44);
  bestD = min(bestD, length(max(dL2_, 0.0)) + min(max(dL2_.x, max(dL2_.y, dL2_.z)), 0.0));

  vec2 cellR2 = vec2(1.0, zId2);
  float hR2 = buildingH(cellR2) * (1.0 + uBass * 0.08);
  float wR2 = buildingW(cellR2);
  vec3 bpR2 = vec3(p.x - STREET_W - wR2, p.y - hR2 * 0.5, zLocal2);
  vec3 dR2_ = abs(bpR2) - vec3(wR2, hR2 * 0.5, CELL_Z * 0.44);
  bestD = min(bestD, length(max(dR2_, 0.0)) + min(max(dR2_.x, max(dR2_.y, dR2_.z)), 0.0));

  return bestD;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  float d = citySDF(p);
  return normalize(vec3(
    citySDF(p + e.xyy) - d,
    citySDF(p + e.yxy) - d,
    citySDF(p + e.yyx) - d
  ));
}

// Window pattern on buildings
float windowPattern(vec3 p) {
  vec2 wuv = vec2(fract(p.x * 3.5 + p.z * 3.5), fract(p.y * 2.5));
  float wx = step(0.12, wuv.x) * step(wuv.x, 0.88);
  float wy = step(0.15, wuv.y) * step(wuv.y, 0.85);
  float win = wx * wy;
  vec2 wId = floor(vec2((p.x + p.z) * 3.5, p.y * 2.5));
  float lit = step(0.45, hash(wId));
  return win * lit;
}

// Neon sign region on building face
float neonSign(vec3 p, float buildingH, vec2 cellId) {
  float hasSign = step(0.55, hash(cellId + 3.0));
  if (hasSign < 0.5) return 0.0;
  float signY = buildingH * (0.3 + hash(cellId + 4.0) * 0.4);
  float signH = 0.6 + hash(cellId + 6.0) * 0.8;
  float yBand = smoothstep(signH, signH - 0.05, abs(p.y - signY));
  float zBand = smoothstep(1.0, 0.95, abs(mod(p.z, CELL_Z) - CELL_Z * 0.5) / (CELL_Z * 0.35));
  return yBand * zBand;
}

// Nearest neon light contribution for fog
vec3 nearestNeonLight(vec3 p) {
  vec3 total = vec3(0.0);
  float zId = floor(p.z / CELL_Z);

  for (float dz = -1.0; dz <= 1.0; dz += 1.0) {
    float zc = zId + dz;
    // Left building neon
    vec2 cellL = vec2(-1.0, zc);
    float hL = buildingH(cellL);
    float signY = hL * (0.3 + hash(cellL + 4.0) * 0.4);
    vec3 neonPos = vec3(-STREET_W, signY, (zc + 0.5) * CELL_Z);
    float dist = length(p - neonPos);
    float hasSign = step(0.55, hash(cellL + 3.0));
    total += neonHue(hash(cellL)) * hasSign / (1.0 + dist * 0.3 + dist * dist * 0.05);

    // Right building neon
    vec2 cellR = vec2(1.0, zc);
    float hR = buildingH(cellR);
    float signYR = hR * (0.3 + hash(cellR + 4.0) * 0.4);
    vec3 neonPosR = vec3(STREET_W, signYR, (zc + 0.5) * CELL_Z);
    float distR = length(p - neonPosR);
    float hasSignR = step(0.55, hash(cellR + 3.0));
    total += neonHue(hash(cellR)) * hasSignR / (1.0 + distR * 0.3 + distR * distR * 0.05);
  }
  return total;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: street level, walking forward
  float walkZ = uPhaseBass * 1.8;
  float walkX = sin(uPhaseMid * 0.12) * 0.8;
  vec3 ro = vec3(walkX, 1.6, walkZ);

  // Look forward and slightly up to see the buildings towering
  float lookX = sin(uPhaseTreble * 0.06) * 0.05;
  float lookY = 0.1 + sin(uPhaseMid * 0.07) * 0.05;
  vec3 rd = normalize(vec3(uv.x * 0.65 + lookX, uv.y * 0.5 + lookY, 1.0));

  // --- Raymarch ---
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = citySDF(p);

    if (d < 0.005) { hit = true; break; }
    if (t > 50.0) break;
    t += d * 0.7;
  }

  // Dark sky with rain clouds
  vec3 col = vec3(0.015, 0.012, 0.025);
  // Sky glow from city lights
  col += vec3(0.04, 0.02, 0.05) * max(rd.y, 0.0);

  // Accumulate volumetric neon fog along the ray
  vec3 fogAccum = vec3(0.0);
  float fogSteps = min(t, 35.0);
  for (int i = 0; i < 20; i++) {
    float ft = fogSteps * (float(i) + 0.5) / 20.0;
    vec3 fp = ro + rd * ft;
    vec3 neonContrib = nearestNeonLight(fp);
    float fogDensity = 0.015 + 0.005 * noise3(fp * 0.3 + vec3(0.0, 0.0, uPhaseBass * 0.2));
    fogAccum += neonContrib * fogDensity * (fogSteps / 20.0);
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float zId = floor(p.z / CELL_Z);

    bool isGround = n.y > 0.7;

    if (isGround) {
      // Wet asphalt
      vec3 streetCol = vec3(0.02, 0.02, 0.025);

      // Puddles — reflective patches
      float puddle = smoothstep(0.45, 0.55, noise(p.xz * 0.8));

      // Reflection: sample neon light from above
      vec3 neonRefl = nearestNeonLight(p + vec3(0.0, 3.0, 0.0));

      // Ripple distortion
      float ripple = sin(length(p.xz * 3.0) * 8.0 - uPhaseBass * 4.0) * 0.5 + 0.5;
      ripple *= (0.7 + uTreble * 0.3);

      streetCol += neonRefl * puddle * ripple * 0.35;

      // Window light reflection
      streetCol += vec3(0.3, 0.25, 0.15) * (1.0 - puddle) * 0.01;

      col = streetCol;
    } else {
      // Building face
      vec3 buildCol = vec3(0.04, 0.04, 0.05);

      // Which building?
      float side = (p.x < 0.0) ? -1.0 : 1.0;
      vec2 cellId = vec2(side, zId);
      float bH = buildingH(cellId);

      // Windows
      if (p.y > 0.5 && p.y < bH - 0.3) {
        float win = windowPattern(p);
        vec3 winCol = vec3(0.7, 0.6, 0.4) * (0.3 + hash(vec2(zId, p.y)) * 0.2);
        winCol *= (1.0 + uBass * 0.15);
        buildCol = mix(buildCol, winCol, win);
      }

      // Neon sign
      float sign_ = neonSign(p, bH, cellId);
      if (sign_ > 0.0) {
        vec3 neon = neonHue(hash(cellId));
        float pulse = 0.7 + uBeat * 0.5 + sin(uPhaseBass * 3.0 + hash(cellId) * 6.28) * 0.15;
        buildCol += neon * sign_ * pulse;
      }

      // Building edge/corner darkening
      float zLocal = mod(p.z, CELL_Z) - CELL_Z * 0.5;
      float edgeZ = smoothstep(CELL_Z * 0.42, CELL_Z * 0.44, abs(zLocal));
      buildCol *= (1.0 - edgeZ * 0.6);

      col = buildCol;
    }

    // Distance fog — dark with neon tint
    float fog = 1.0 - exp(-t * 0.02);
    vec3 fogCol = vec3(0.02, 0.015, 0.03);
    col = mix(col, fogCol, fog);
  }

  // Add volumetric neon fog
  col += fogAccum * 0.15;

  // Rain streaks — vertical
  float rain = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 rainUV = uv * vec2(25.0 + fi * 12.0, 2.0 + fi * 0.5);
    rainUV.y += uPhaseBass * (15.0 + fi * 5.0);
    rainUV.x += fi * 3.7;
    float streak = smoothstep(0.97, 1.0, noise(rainUV));
    rain += streak * (0.3 - fi * 0.05);
  }
  // Rain catches neon light
  vec3 rainNeon = nearestNeonLight(ro + rd * 2.0);
  col += (vec3(0.15) + rainNeon * 0.2) * rain * (0.3 + uTreble * 0.4);

  // Beat: city-wide neon surge
  col += uBeat * vec3(0.04, 0.02, 0.05);

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  col *= vig;

  // Tone map and gamma
  col = col / (1.0 + col * 0.15);
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
