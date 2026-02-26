/**
 * @seed neon-city
 * @technique Procedural grid city with raymarched buildings
 * @status SEED
 * @description Cyberpunk city flyover at night. Procedural grid of buildings
 *              with lit windows. Neon reflections on wet streets. Rain.
 *              Bass drives building pulse, mid shifts neon hues, treble
 *              adds rain detail, beat flashes signs.
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

// Building height for cell
float buildingHeight(vec2 cellId) {
  float h = hash(cellId) * 3.0 + 0.5;
  // Some cells are empty (streets)
  float isBuilding = step(0.2, hash(cellId + 0.5));
  return h * isBuilding;
}

// City SDF — grid of boxes
float citySDF(vec3 p) {
  vec2 cellSize = vec2(1.2, 1.2);
  vec2 cellId = floor(p.xz / cellSize);
  vec2 cellPos = mod(p.xz, cellSize) - cellSize * 0.5;

  float bHeight = buildingHeight(cellId) * (1.0 + uBass * 0.15);

  // Building footprint (with margin for streets)
  float margin = 0.15;
  vec2 halfSize = vec2(0.4, 0.4);
  vec2 d2 = abs(cellPos) - halfSize;
  float boxXZ = max(d2.x, d2.y);

  float boxY = p.y - bHeight;
  float d = max(boxXZ, boxY);

  // Ground plane
  d = min(d, p.y);

  return d;
}

// Get building info for shading
vec2 getBuildingCell(vec3 p) {
  vec2 cellSize = vec2(1.2, 1.2);
  return floor(p.xz / cellSize);
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

// Window pattern — cell-relative so windows align to building faces
float windows(vec3 p, vec3 n, vec2 cellId) {
  float bH = buildingHeight(cellId);
  if (p.y > bH - 0.05 || p.y < 0.1) return 0.0;

  // Cell-local position
  vec2 cellSize = vec2(1.2, 1.2);
  vec2 cellLocal = mod(p.xz, cellSize) - cellSize * 0.5;

  // Pick wall-aligned coordinate based on which face we hit
  float wallCoord = abs(n.x) > abs(n.z) ? cellLocal.y : cellLocal.x;
  float face = abs(n.x) > abs(n.z) ? 0.0 : 7.0;

  // Window grid: 4 windows across 0.8-wide face, 4 floors per unit height
  float wu = fract(wallCoord * 5.0 + 0.5);
  float wv = fract(p.y * 4.0);
  float wx = step(0.15, wu) * step(wu, 0.85);
  float wy = step(0.2, wv) * step(wv, 0.8);
  float win = wx * wy;

  // Random on/off per window — keyed to integer window position + cell + face
  vec2 wId = floor(vec2(wallCoord * 5.0 + 0.5, p.y * 4.0));
  float lit = step(0.4, hash(wId + cellId * 17.0 + face));

  return win * lit;
}

// Neon color palette
vec3 neonColor(float id) {
  float phase = uPhaseMid * 0.1 + id * 2.5;
  return vec3(
    0.5 + 0.5 * sin(phase),
    0.5 + 0.5 * sin(phase + 2.1),
    0.5 + 0.5 * sin(phase + 4.2)
  ) * 1.5;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: flying over the city
  float flyZ = uPhaseBass * 2.5;
  float flyX = sin(uPhaseMid * 0.15) * 3.0;
  float flyY = 3.5 + sin(uPhaseMid * 0.1) * 0.5;
  vec3 ro = vec3(flyX, flyY, flyZ);

  // Look down and ahead
  float lookX = sin(uPhaseTreble * 0.07) * 0.1;
  float lookY = -0.35 + sin(uPhaseMid * 0.12) * 0.05;
  vec3 rd = normalize(vec3(uv.x * 0.6 + lookX, uv.y * 0.5 + lookY, 1.0));

  // Raymarch
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = citySDF(p);

    if (d < 0.005) { hit = true; break; }
    if (t > 40.0) break;

    t += d * 0.8;
  }

  // Night sky
  vec3 col = vec3(0.01, 0.01, 0.03);

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec2 cellId = getBuildingCell(p);

    float isGround = step(0.99, n.y);

    if (isGround > 0.5) {
      // Ground — wet street
      vec3 streetCol = vec3(0.03, 0.03, 0.04);

      // Neon reflections on wet ground
      vec2 reflCellId = floor(p.xz / 1.2);
      float bH = buildingHeight(reflCellId);
      if (bH > 0.5) {
        vec3 neon = neonColor(hash(reflCellId));
        float reflStrength = 0.3 / (1.0 + length(p.xz - (reflCellId + 0.5) * 1.2) * 2.0);
        // Ripple distortion
        float ripple = sin(length(p.xz) * 15.0 - uPhaseBass * 3.0) * 0.5 + 0.5;
        streetCol += neon * reflStrength * ripple * 0.4;
      }

      // Window light reflected on street
      streetCol += vec3(0.4, 0.35, 0.25) * 0.02;

      col = streetCol;
    } else {
      // Building surface
      vec3 buildingCol = vec3(0.06, 0.06, 0.07);
      float bH = buildingHeight(cellId);

      // Windows
      float win = windows(p, n, cellId);
      vec3 winCol = vec3(0.8, 0.7, 0.5) * 0.5; // warm interior light

      // Some windows pulse with bass
      float pulse = step(0.8, hash(cellId + 10.0)) * uBass * 0.3;
      winCol *= (1.0 + pulse);

      buildingCol = mix(buildingCol, winCol, win);

      // Neon signs on some buildings
      float hasNeon = step(0.7, hash(cellId + 5.0));
      if (hasNeon > 0.5 && p.y > bH * 0.5 && p.y < bH * 0.7) {
        vec3 neon = neonColor(hash(cellId));
        float neonBright = 0.3 + uBeat * 0.4;
        buildingCol += neon * neonBright * 0.3;
      }

      // Edge highlight
      float edge = max(
        smoothstep(0.38, 0.4, abs(fract(p.x / 1.2 + 0.5) - 0.5) * 1.2),
        smoothstep(0.38, 0.4, abs(fract(p.z / 1.2 + 0.5) - 0.5) * 1.2)
      );
      buildingCol = mix(buildingCol, buildingCol * 0.5, edge * 0.5);

      col = buildingCol;
    }

    // Fog / haze
    float fog = 1.0 - exp(-t * 0.025);
    vec3 fogCol = vec3(0.03, 0.02, 0.04);
    col = mix(col, fogCol, fog);
  }

  // Rain streaks
  float rain = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 rainUV = uv * vec2(30.0 + float(i) * 10.0, 3.0);
    rainUV.y += uPhaseBass * (8.0 + float(i) * 3.0);
    float streak = smoothstep(0.98, 1.0, noise(rainUV));
    rain += streak;
  }
  col += vec3(0.2, 0.2, 0.25) * rain * 0.15 * (1.0 + uTreble * 0.5);

  // Beat: city-wide neon flash
  col += uBeat * vec3(0.03, 0.02, 0.04);

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
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
