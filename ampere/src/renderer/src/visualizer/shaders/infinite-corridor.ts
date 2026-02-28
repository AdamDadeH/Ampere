/**
 * @liminal gen5-infinite-corridor
 * @generation 5
 * @parents menger-halls + flooded-hall + "backrooms, liminal, fluorescent"
 * @status ACTIVE
 * @mutation Crossover: menger's infinite repetition + flooded-hall's
 *          interior architecture. A never-ending corridor that gently
 *          curves. Fluorescent ceiling lights — some flicker. Doors on
 *          both walls, some open into black voids. Dirty carpet. Stained
 *          ceiling tiles. Floor reflects the buzzing lights. Warm yellow
 *          haze. The corridor goes on forever. You've been here before.
 *
 * The Backrooms. Level 0. Fluorescent hum. Damp carpet.
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

const float HALL_W = 1.8;
const float HALL_H = 3.0;
const float CELL_Z = 5.0;

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

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    f += amp * noise(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return f;
}

// Corridor center path — gently winding
vec2 corridorPath(float z) {
  return vec2(
    sin(z * 0.06) * 3.0 + sin(z * 0.023) * 1.5,
    0.0
  );
}

// Interior SDF: positive inside corridor, 0 at walls
float corridorSDF(vec3 p) {
  vec2 path = corridorPath(p.z);
  vec2 local = vec2(p.x - path.x, p.y - HALL_H * 0.5);
  vec2 d = abs(local) - vec2(HALL_W, HALL_H * 0.5);
  return -(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0));
}

vec3 corridorNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  float d = corridorSDF(p);
  return normalize(vec3(
    corridorSDF(p + e.xyy) - d,
    corridorSDF(p + e.yxy) - d,
    corridorSDF(p + e.yyx) - d
  ));
}

// Light fixture: emissive strip on ceiling per cell
float lightFixture(float localX, float zInCell) {
  float xBand = smoothstep(0.4, 0.3, abs(localX));
  float zBand = smoothstep(0.3, 0.5, zInCell) * smoothstep(CELL_Z - 0.3, CELL_Z - 0.5, zInCell);
  return xBand * zBand;
}

// Flicker function per cell
float getFlicker(float cellId) {
  float flickerChance = hash(vec2(cellId, 7.0));
  if (flickerChance > 0.65) {
    float speed = 4.0 + hash(vec2(cellId, 8.0)) * 12.0;
    float n = noise(vec2(uPhaseBass * speed, cellId * 3.7));
    return smoothstep(0.25, 0.55, n);
  }
  return 1.0;
}

// Lighting from the two nearest fluorescent fixtures
vec3 calcLighting(vec3 p, vec3 n, vec3 wallCol) {
  vec3 totalLight = vec3(0.0);

  for (int k = -1; k <= 1; k++) {
    float zLight = (floor(p.z / CELL_Z) + float(k)) * CELL_Z + CELL_Z * 0.5;
    vec2 lPath = corridorPath(zLight);
    vec3 lightPos = vec3(lPath.x, HALL_H - 0.05, zLight);

    float cellId = floor(zLight / CELL_Z);
    float flicker = getFlicker(cellId);

    vec3 toLight = lightPos - p;
    float dist = length(toLight);
    vec3 lDir = toLight / dist;
    float atten = 1.0 / (1.0 + dist * 0.12 + dist * dist * 0.025);
    float diff = max(dot(n, lDir), 0.0);

    vec3 lCol = vec3(0.95, 0.9, 0.75) * (1.5 + uBass * 0.3) * flicker;
    totalLight += wallCol * diff * lCol * atten;
  }

  // Ambient — dim warm
  totalLight += wallCol * vec3(0.06, 0.055, 0.04);

  return totalLight;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera following corridor path at eye height
  float camZ = uPhaseBass * 1.2;
  vec2 camPath = corridorPath(camZ);
  vec3 ro = vec3(camPath.x, 1.55, camZ);

  // Look ahead along the winding path
  float aheadZ = camZ + 6.0;
  vec2 aheadPath = corridorPath(aheadZ);
  vec3 lookAt = vec3(aheadPath.x, 1.55 + sin(uPhaseMid * 0.06) * 0.1, aheadZ);

  vec3 fwd = normalize(lookAt - ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);

  // Subtle head sway
  float sway = sin(uPhaseBass * 1.8) * 0.012;
  vec3 rd = normalize(fwd + (uv.x + sway) * right * 0.7 + uv.y * up * 0.5);

  // --- Raymarch ---
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 100; i++) {
    vec3 p = ro + rd * t;
    float d = corridorSDF(p);

    if (d < 0.002) { hit = true; break; }
    if (t > 50.0) break;
    t += d * 0.75;
  }

  vec3 col = vec3(0.04, 0.035, 0.025);

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = corridorNormal(p);
    vec2 path = corridorPath(p.z);
    float localX = p.x - path.x;
    float cellId = floor(p.z / CELL_Z);
    float zInCell = mod(p.z, CELL_Z);
    float zLocal = zInCell - CELL_Z * 0.5;

    // --- Surface identification ---
    bool isCeiling = n.y < -0.5;
    bool isFloor = n.y > 0.5;

    // --- Base material ---
    vec3 wallCol = vec3(0.68, 0.64, 0.52); // yellowish institutional

    // FBM stains
    float stain = fbm(p.xz * 0.7);
    float waterMark = smoothstep(0.55, 0.75, fbm(p.xz * 0.25 + 10.0));
    wallCol *= (1.0 - stain * 0.25);
    wallCol = mix(wallCol, vec3(0.5, 0.46, 0.38), waterMark * 0.35);

    if (isCeiling) {
      // Ceiling tile grid
      float gx = smoothstep(0.02, 0.0, abs(fract(localX * 0.85) - 0.5) - 0.48);
      float gz = smoothstep(0.02, 0.0, abs(fract(p.z * 0.4) - 0.5) - 0.48);
      float grid = min(gx + gz, 1.0);
      wallCol = mix(vec3(0.72, 0.68, 0.58), vec3(0.45, 0.4, 0.33), grid);

      // Fluorescent light strip
      float light = lightFixture(localX, zInCell);
      if (light > 0.0) {
        float flicker = getFlicker(cellId);
        vec3 emit = vec3(0.95, 0.92, 0.8) * (3.0 + uBass * 1.0) * flicker;
        wallCol = mix(wallCol, emit, light);
      }
    }

    if (isFloor) {
      // Carpet — dark brownish with subtle pattern
      float carpet = noise(p.xz * 3.0) * 0.08;
      wallCol = vec3(0.22, 0.19, 0.14) + carpet;
      float carpetStain = smoothstep(0.55, 0.75, fbm(p.xz * 1.2));
      wallCol = mix(wallCol, vec3(0.18, 0.15, 0.11), carpetStain * 0.5);
    }

    if (!isCeiling && !isFloor) {
      // Side walls — check for doors
      float side = sign(localX);
      float doorHash = hash(vec2(cellId, 2.0 + side));
      bool hasDoor = doorHash > 0.35;

      if (hasDoor && abs(zLocal) < 0.5 && p.y < 2.2 && p.y > 0.0) {
        // Door area
        bool isOpen = hash(vec2(cellId, 5.0 + side)) > 0.65;
        if (isOpen) {
          wallCol = vec3(0.015, 0.012, 0.01); // dark void
        } else {
          // Closed door — wood
          wallCol = vec3(0.32, 0.22, 0.12);
          float panels = smoothstep(0.02, 0.0, abs(fract(p.y * 1.8) - 0.5) - 0.44);
          wallCol *= (1.0 - panels * 0.15);
          // Doorknob hint
          float knobDist = length(vec2(abs(zLocal) - 0.35, p.y - 1.0));
          wallCol += vec3(0.3, 0.25, 0.15) * smoothstep(0.04, 0.02, knobDist);
        }
        // Frame
        float frameZ = smoothstep(0.06, 0.02, abs(abs(zLocal) - 0.5));
        float frameY = smoothstep(0.06, 0.02, abs(p.y - 2.2)) * step(p.y, 2.25);
        float frameBot = smoothstep(0.04, 0.01, p.y);
        float frame = max(max(frameZ, frameY), frameBot);
        wallCol = mix(wallCol, vec3(0.35, 0.3, 0.22), frame);
      }

      // Baseboard trim
      float baseboard = smoothstep(0.18, 0.12, p.y);
      wallCol = mix(wallCol, vec3(0.38, 0.33, 0.25), baseboard);
    }

    // --- Lighting ---
    col = calcLighting(p, n, wallCol);

    // Floor reflection of ceiling lights
    if (isFloor) {
      float light = lightFixture(localX, zInCell);
      float flicker = getFlicker(cellId);
      col += vec3(0.4, 0.38, 0.3) * light * flicker * 0.1;
      // Nearby cells too
      float zInCellNext = mod(p.z + CELL_Z, CELL_Z);
      float lightNext = lightFixture(localX, zInCellNext);
      float flickerNext = getFlicker(cellId + 1.0);
      col += vec3(0.4, 0.38, 0.3) * lightNext * flickerNext * 0.06;
    }

    // Beat: fluorescent surge
    col += uBeat * vec3(0.05, 0.045, 0.03);

    // Yellow-warm distance haze
    float fog = 1.0 - exp(-t * 0.025);
    vec3 fogCol = vec3(0.12, 0.1, 0.06);
    col = mix(col, fogCol, fog);
  }

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  col *= vig;

  col = pow(col, vec3(0.88));
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
