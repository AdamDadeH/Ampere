/**
 * @liminal gen0-dead-office
 * @generation 0
 * @parents SEED
 * @status ACTIVE
 * @notes Raymarched empty open-plan office. Fluorescent ceiling grid,
 *        low cubicle partitions in rows, dark monitor screens, industrial
 *        carpet. The hum of lights that were never turned off. Audio drives
 *        flicker and fog.
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

// Fluorescent grid flicker — each fixture independent
float fixtureFlicker(vec2 fixtureId, float t) {
  float id = hash(fixtureId) * 100.0;
  float base = 0.65 + 0.35 * sin(t * 120.0 + id * 13.0);
  float dropout = step(0.95, hash(vec2(floor(t * 5.0) + id, fixtureId.y)));
  float warm = smoothstep(-0.3, 0.4, sin(t * 31.3 + id * 5.0));
  return mix(base * warm, 0.03, dropout);
}

const float CEIL_H = 2.8;
const float FLOOR_Y = 0.0;
const float CUBICLE_H = 1.4;
const float CUBICLE_SPACING_X = 2.5;
const float CUBICLE_SPACING_Z = 3.0;
const float CUBICLE_WALL_THICK = 0.06;
const float ROOM_HALF_W = 12.0;

// Distance to cubicle walls — repeating grid with openings
float cubicleDist(vec3 p) {
  // X-walls: repeat every CUBICLE_SPACING_X
  float cx = mod(p.x + CUBICLE_SPACING_X * 0.5, CUBICLE_SPACING_X) - CUBICLE_SPACING_X * 0.5;
  float wallX = abs(cx) - CUBICLE_WALL_THICK;

  // Z-walls: repeat every CUBICLE_SPACING_Z
  float cz = mod(p.z + CUBICLE_SPACING_Z * 0.5, CUBICLE_SPACING_Z) - CUBICLE_SPACING_Z * 0.5;
  float wallZ = abs(cz) - CUBICLE_WALL_THICK;

  // Only below cubicle height
  float heightMask = p.y - CUBICLE_H;
  if (heightMask > 0.0) return heightMask + 0.5;

  // Opening in the front of each cubicle (gap in Z-wall)
  float doorGap = step(abs(cx), 0.5); // gap where x is near center of cell

  float xDist = max(wallX, -heightMask);
  float zDist = max(wallZ, -heightMask);

  // Remove Z-wall segments to create doorways
  if (doorGap > 0.5) zDist = max(zDist, 0.3);

  return min(xDist, zDist);
}

// Monitor on desk — simple box at each cubicle center
float monitorDist(vec3 p) {
  float cx = mod(p.x, CUBICLE_SPACING_X) - CUBICLE_SPACING_X * 0.5;
  float cz = mod(p.z, CUBICLE_SPACING_Z) - CUBICLE_SPACING_Z * 0.5;

  // Desk surface at y=0.75, monitor face at z offset
  vec3 local = vec3(cx, p.y - 1.1, cz + 0.5);
  vec3 b = vec3(0.3, 0.25, 0.02);
  vec3 d = abs(local) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

struct Hit {
  float dist;
  int mat; // 0=floor, 1=ceiling, 2=cubicle wall, 3=monitor, 4=light fixture, 5=outer wall
};

Hit map(vec3 p) {
  Hit h;
  h.dist = 1e5;
  h.mat = 0;

  // Floor
  float floorD = p.y - FLOOR_Y;
  if (floorD < h.dist) { h.dist = floorD; h.mat = 0; }

  // Ceiling
  float ceilD = CEIL_H - p.y;
  if (ceilD < h.dist) { h.dist = ceilD; h.mat = 1; }

  // Outer walls
  float outerW = ROOM_HALF_W - abs(p.x);
  if (outerW < h.dist) { h.dist = outerW; h.mat = 5; }

  // Cubicle partitions
  float cubD = cubicleDist(p);
  if (cubD < h.dist) { h.dist = cubD; h.mat = 2; }

  // Monitors
  float monD = monitorDist(p);
  if (monD < h.dist) { h.dist = monD; h.mat = 3; }

  // Ceiling light fixtures — 2x4 grid panels
  float lx = mod(p.x + CUBICLE_SPACING_X * 0.5, CUBICLE_SPACING_X) - CUBICLE_SPACING_X * 0.5;
  float lz = mod(p.z + 3.0, 6.0) - 3.0;
  float lightPanel = max(abs(lx) - 0.5, abs(lz) - 0.3);
  float lightCeil = abs(p.y - CEIL_H + 0.015);
  float lightD = max(lightPanel, lightCeil);
  if (lightD < h.dist && p.y > CEIL_H - 0.08) {
    h.dist = lightD;
    h.mat = 4;
  }

  return h;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.004, 0.0);
  float d = map(p).dist;
  return normalize(vec3(
    map(p + e.xyy).dist - d,
    map(p + e.yxy).dist - d,
    map(p + e.yyx).dist - d
  ));
}

// Carpet pattern
float carpet(vec2 p) {
  float n = noise(p * 8.0) * 0.5 + noise(p * 16.0) * 0.25 + noise(p * 32.0) * 0.125;
  return 0.35 + n * 0.15;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: drifting through the cubicle rows
  float walkZ = uPhaseBass * 1.5;
  float sway = sin(uPhaseMid * 0.4) * 0.6;
  vec3 ro = vec3(sway, 1.65, walkZ);

  // Look direction
  float lookX = sin(uPhaseTreble * 0.12) * 0.15;
  float lookY = sin(uPhaseMid * 0.08) * 0.05 - 0.02;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.7 + lookY, 1.0));

  // --- Raymarch ---
  float t = 0.0;
  int hitMat = -1;
  vec3 hitPos = ro;

  for (int i = 0; i < 80; i++) {
    hitPos = ro + rd * t;
    Hit h = map(hitPos);

    if (h.dist < 0.004) {
      hitMat = h.mat;
      break;
    }
    if (t > 40.0) break;

    t += h.dist * 0.7;
  }

  // Find nearest ceiling light fixture
  vec2 fixtureId = vec2(
    floor((hitPos.x + CUBICLE_SPACING_X * 0.5) / CUBICLE_SPACING_X),
    floor((hitPos.z + 3.0) / 6.0)
  );
  vec3 lightPos = vec3(
    fixtureId.x * CUBICLE_SPACING_X,
    CEIL_H - 0.05,
    fixtureId.y * 6.0
  );
  float lightOn = fixtureFlicker(fixtureId, uTime + uBeat * 0.3);

  // Adjacent fixture
  vec2 fixtureId2 = fixtureId + vec2(0.0, 1.0);
  vec3 lightPos2 = vec3(fixtureId2.x * CUBICLE_SPACING_X, CEIL_H - 0.05, fixtureId2.y * 6.0);
  float lightOn2 = fixtureFlicker(fixtureId2, uTime + uBeat * 0.3);

  vec3 col = vec3(0.0);

  if (hitMat == -1) {
    col = vec3(0.015, 0.018, 0.02);
  }
  else {
    vec3 n = calcNormal(hitPos);

    // Two-light illumination
    vec3 toL1 = lightPos - hitPos;
    float d1 = length(toL1);
    vec3 l1 = toL1 / d1;
    float atten1 = lightOn / (1.0 + d1 * 0.1 + d1 * d1 * 0.01);

    vec3 toL2 = lightPos2 - hitPos;
    float d2 = length(toL2);
    vec3 l2 = toL2 / d2;
    float atten2 = lightOn2 / (1.0 + d2 * 0.1 + d2 * d2 * 0.01);

    float diff = max(dot(n, l1), 0.0) * atten1 + max(dot(n, l2), 0.0) * atten2;
    vec3 lightTint = vec3(0.92, 0.95, 1.0);

    if (hitMat == 0) {
      // Floor — industrial carpet
      float cp = carpet(hitPos.xz);
      vec3 floorCol = vec3(0.22, 0.21, 0.23) * cp;
      col = floorCol * diff * lightTint;
    }
    else if (hitMat == 1) {
      // Ceiling — drop ceiling tiles
      vec2 cTile = abs(fract(hitPos.xz * 0.4) - 0.5);
      float cGrid = smoothstep(0.45, 0.48, max(cTile.x, cTile.y));
      vec3 ceilCol = mix(vec3(0.5, 0.49, 0.47), vec3(0.42, 0.41, 0.40), cGrid);
      col = ceilCol * (diff * 0.5 + 0.3) * lightTint;
    }
    else if (hitMat == 2) {
      // Cubicle walls — grey fabric
      float fabric = noise(hitPos.xy * 15.0) * 0.08;
      vec3 wallCol = vec3(0.38, 0.38, 0.40) + fabric;
      col = wallCol * diff * lightTint;
    }
    else if (hitMat == 3) {
      // Monitor — dark screen, faint standby glow
      float cx = mod(hitPos.x, CUBICLE_SPACING_X) - CUBICLE_SPACING_X * 0.5;
      float monitorId = floor(hitPos.x / CUBICLE_SPACING_X) + floor(hitPos.z / CUBICLE_SPACING_Z) * 20.0;
      float standby = step(0.7, hash1(monitorId));
      float pulse = sin(uTime * 2.0 + monitorId * 4.0) * 0.5 + 0.5;
      vec3 screenCol = vec3(0.02, 0.02, 0.03);
      // Some monitors have a faint blue standby LED
      screenCol += vec3(0.0, 0.02, 0.08) * standby * pulse * (0.5 + uMid * 0.5);
      col = screenCol + vec3(0.02) * diff;
    }
    else if (hitMat == 4) {
      // Light fixture — emissive
      col = vec3(0.93, 0.95, 1.0) * lightOn * 1.5;
    }
    else if (hitMat == 5) {
      // Outer walls — off-white paint
      float dirt = noise(hitPos.yz * 1.5) * 0.1;
      vec3 wallCol = vec3(0.55, 0.54, 0.52) - dirt;
      col = wallCol * diff * lightTint;
    }

    // Distance fog — stale office air
    float fog = 1.0 - exp(-t * 0.03);
    vec3 fogColor = vec3(0.03, 0.035, 0.04) * (0.5 + lightOn * 0.5);
    col = mix(col, fogColor, fog);
  }

  // Beat: barely perceptible warm pulse
  col += uBeat * vec3(0.02, 0.015, 0.01);

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
