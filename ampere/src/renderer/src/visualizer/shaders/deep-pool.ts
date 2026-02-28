/**
 * @liminal gen1-deep-pool
 * @generation 1
 * @parents gen0-empty-pool
 * @status ACTIVE
 * @mutation Reduced flicker (slower, subtler), deeper water with stronger caustics,
 *          more tile detail with color variation, underwater light shafts.
 *          Fixes: flicker was too aggressive in gen0-empty-pool.
 *
 * Deep pool — a larger, deeper pool with rich caustic light patterns
 * dancing on the floor and walls. Fluorescent lights hum steadily with
 * only occasional gentle flutter. The water is deeper, darker, bluer.
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

// --- Noise ---
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

// --- Water surface (Seascape FBM) ---
float seaOctave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float waterHeight(vec2 p) {
  float seaTime = uPhaseBass * 0.3;
  float freq = 0.25;
  float amp = 0.12 + uBass * 0.06;
  float choppy = 1.8 + uTreble * 1.0; // gentler than gen0

  float h = 0.0;
  mat2 octaveM = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    float d = seaOctave((p + seaTime) * freq, choppy);
    d += seaOctave((p - seaTime) * freq, choppy);
    h += d * amp;
    p *= octaveM;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }
  return h;
}

// --- Caustics ---
// Animated caustic pattern — voronoi-based for organic look
float causticPattern(vec2 p, float t) {
  float c = 0.0;
  // Two layers at different scales for richness
  for (int k = 0; k < 2; k++) {
    float scale = 3.0 + float(k) * 4.0;
    vec2 uv = p * scale + t * vec2(0.3, 0.2) * (1.0 + float(k) * 0.5);

    // Cheap voronoi via sin lattice
    float v = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 offset = vec2(sin(fi * 2.4 + t * 0.5), cos(fi * 3.1 + t * 0.4)) * 0.5;
      v += sin(dot(uv + offset, vec2(cos(fi * 1.7 + t * 0.2), sin(fi * 2.3 + t * 0.15))) * 3.14159);
    }
    v = abs(v) / 3.0;
    c += pow(v, 3.0) * (k == 0 ? 0.6 : 0.4);
  }
  return c;
}

// --- Tile pattern with color variation ---
float tilePattern(vec2 p, float scale) {
  vec2 tp = p * scale;
  vec2 g = abs(fract(tp) - 0.5);
  float grout = smoothstep(0.44, 0.48, max(g.x, g.y));
  return grout;
}

vec3 tileColor(vec2 p, float scale) {
  vec2 id = floor(p * scale);
  float h = hash(id);
  // Subtle color variation per tile — cyan to teal range
  vec3 base = mix(vec3(0.45, 0.65, 0.72), vec3(0.50, 0.70, 0.68), h);
  // Occasional darker accent tile
  if (h > 0.85) base *= 0.7;
  return base;
}

// --- Fluorescent light (MUCH gentler than gen0) ---
float flicker(float t) {
  // Steady hum with very rare, subtle dip — NOT aggressive
  float base = 0.9 + 0.1 * sin(t * 120.0); // 60Hz but mostly stable
  float dip = step(0.995, hash(vec2(floor(t * 2.0), 0.0))); // very rare
  return mix(base, 0.7, dip * 0.3); // dip is mild, not dropout
}

// --- Pool geometry ---
const float POOL_HALF_W = 5.0;
const float POOL_HALF_L = 8.0;
const float POOL_DEPTH = 4.0;
const float POOL_FLOOR = -4.0;

float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float poolDist(vec3 p) {
  vec3 centered = p - vec3(0.0, -POOL_DEPTH * 0.5, 0.0);
  float box = sdBox(centered, vec3(POOL_HALF_W, POOL_DEPTH * 0.5, POOL_HALF_L));
  return -box;
}

float waterDist(vec3 p) {
  float waterLevel = POOL_FLOOR + 1.5 + uBass * 0.2;
  float wh = waterHeight(p.xz);
  return p.y - waterLevel - wh * 0.06;
}

struct Hit {
  float dist;
  int material; // 0=pool walls, 1=water, 2=floor
};

Hit sceneDist(vec3 p) {
  float pool = poolDist(p);
  float water = waterDist(p);
  float floor_d = p.y - POOL_FLOOR;

  Hit h;
  if (water < pool && water < floor_d) {
    h.dist = water;
    h.material = 1;
  } else if (floor_d < pool) {
    h.dist = floor_d;
    h.material = 2;
  } else {
    h.dist = pool;
    h.material = 0;
  }
  return h;
}

vec3 calcNormal(vec3 p, int mat) {
  vec2 e = vec2(0.002, 0.0);
  if (mat == 1) {
    float h = waterDist(p);
    return normalize(vec3(
      waterDist(p + e.xyy) - h,
      e.x,
      waterDist(p + e.yyx) - h
    ));
  }
  float d = sceneDist(p).dist;
  return normalize(vec3(
    sceneDist(p + e.xyy).dist - d,
    sceneDist(p + e.yxy).dist - d,
    sceneDist(p + e.yyx).dist - d
  ));
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Steady light with gentle hum
  float lightIntensity = flicker(uTime);

  // Camera: standing at pool edge, looking along its length and down
  float camDrift = sin(uPhaseMid * 0.12) * 0.4;
  vec3 ro = vec3(camDrift, -0.5, -POOL_HALF_L + 2.0);

  float lookX = sin(uPhaseTreble * 0.06) * 0.1;
  float lookY = -0.3 + sin(uPhaseBass * 0.08) * 0.04;
  vec3 rd = normalize(vec3(uv.x * 0.8 + lookX, uv.y * 0.8 + lookY, 1.0));

  // Subtle head bob
  ro.y += sin(uPhaseMid * 0.4) * 0.008;

  // --- Raymarch ---
  float t = 0.0;
  int hitMat = -1;
  vec3 hitPos;

  for (int i = 0; i < 80; i++) {
    hitPos = ro + rd * t;
    Hit h = sceneDist(hitPos);

    if (abs(h.dist) < 0.003) {
      hitMat = h.material;
      break;
    }
    if (t > 35.0) break;

    t += h.dist * 0.7;
  }

  // Lighting
  vec3 lightPos = vec3(0.0, 1.0, hitPos.z + 2.0);
  vec3 lightColor = vec3(0.8, 0.88, 1.0) * lightIntensity;

  vec3 col;

  if (hitMat == -1) {
    // Ceiling — concrete with light strip
    float ceilStrip = smoothstep(0.35, 0.0, abs(uv.x));
    col = vec3(0.07, 0.07, 0.08) + ceilStrip * lightColor * 0.5;

    // Second light strip for wider pools
    float ceilStrip2 = smoothstep(0.15, 0.0, abs(abs(uv.x) - 0.5));
    col += ceilStrip2 * lightColor * 0.2;
  }
  else {
    vec3 n = calcNormal(hitPos, hitMat);
    vec3 toLight = lightPos - hitPos;
    float lightDist = length(toLight);
    vec3 l = toLight / lightDist;
    float atten = 1.0 / (1.0 + lightDist * 0.04 + lightDist * lightDist * 0.008);
    float diff = max(dot(n, l), 0.0);

    if (hitMat == 0) {
      // Pool walls — ceramic tile with color variation
      float tile = tilePattern(hitPos.yz, 4.0);
      float tileSide = tilePattern(hitPos.xz, 4.0);
      vec3 tCol = tileColor(hitPos.yz, 4.0);
      vec3 tColSide = tileColor(hitPos.xz, 4.0);
      float tileAll = min(tile, tileSide);
      vec3 wallCol = mix(tCol, tColSide, 0.5);
      wallCol = mix(wallCol, wallCol * 0.7, tileAll); // grout darkens

      // Grime gradient
      float grime = smoothstep(POOL_FLOOR, POOL_FLOOR + 3.0, hitPos.y) * 0.25 + 0.75;

      // Caustics projected onto walls underwater
      float caustic = 0.0;
      if (hitPos.y < -1.0) {
        caustic = causticPattern(hitPos.yz * 0.5, uPhaseBass * 0.3) * 0.3;
        caustic *= smoothstep(-1.0, -2.0, hitPos.y); // stronger deeper
      }

      col = wallCol * grime * diff * lightColor * atten;
      col += vec3(0.1, 0.2, 0.25) * caustic * lightIntensity;
    }
    else if (hitMat == 1) {
      // Water surface
      vec3 viewDir = normalize(hitPos - ro);
      float fresnel = pow(1.0 - max(dot(n, -viewDir), 0.0), 3.0) * 0.6;
      vec3 reflected = reflect(viewDir, n);

      vec3 waterCol = vec3(0.05, 0.15, 0.25);
      float specular = pow(max(dot(reflected, l), 0.0), 40.0);
      col = waterCol * diff * lightColor * atten + specular * lightColor * 0.5;
      col = mix(col, lightColor * 0.25, fresnel);
    }
    else {
      // Pool floor — tile with rich caustics
      float tile = tilePattern(hitPos.xz, 4.0);
      vec3 floorCol = tileColor(hitPos.xz, 4.0);
      floorCol = mix(floorCol, floorCol * 0.7, tile);

      // Strong caustic pattern on the floor
      float caustic = causticPattern(hitPos.xz, uPhaseBass * 0.25);
      vec3 causticCol = vec3(0.2, 0.35, 0.45) * caustic * lightIntensity;

      col = floorCol * diff * lightColor * atten + causticCol;
    }

    // Distance fog — deep blue-cyan
    float fog = 1.0 - exp(-t * 0.035);
    vec3 fogColor = vec3(0.02, 0.05, 0.07) * lightIntensity;
    col = mix(col, fogColor, fog);
  }

  // Beat: subtle cyan pulse
  col += uBeat * vec3(0.01, 0.03, 0.04);

  // Vignette
  float vig = 1.0 - dot(uv * 0.4, uv * 0.4);
  col *= vig;

  // Tone map
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
