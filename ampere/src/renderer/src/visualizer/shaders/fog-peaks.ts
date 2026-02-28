/**
 * @liminal gen4-fog-peaks
 * @generation 4
 * @parents terrain x gen3-void-clouds
 * @status ACTIVE
 * @mutation Crossover: terrain's FBM heightmap mountains + void-clouds'
 *          volumetric breathing fog. Mountains emerge and vanish in dense
 *          fog. Can't tell where the peaks end and sky begins. The fog
 *          uses void-clouds' slow drift FBM. Liminal: the boundary
 *          between solid and air dissolves.
 *
 * Fog peaks — mountains dissolving into cloud. The ground is uncertain.
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

// Terrain parent's FBM heightmap
float fbm2(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    f += amp * noise(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return f;
}

// Void-clouds parent's 3D FBM
float fbm3(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  mat3 rot = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    f += amp * noise3(p);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return f;
}

float terrainHeight(vec2 p) {
  float h = fbm2(p * 0.25) * 4.0;
  // Ridge detail
  float ridge = 1.0 - abs(fbm2(p * 0.5) * 2.0 - 1.0);
  h += ridge * ridge * 1.0;
  return h;
}

vec3 terrainNormal(vec2 p) {
  float e = 0.03;
  float h = terrainHeight(p);
  return normalize(vec3(
    terrainHeight(p + vec2(e, 0.0)) - h,
    e * 2.0,
    terrainHeight(p + vec2(0.0, e)) - h
  ));
}

// Fog density — void-clouds breathing technique
float fogDensity(vec3 p) {
  vec3 wind = vec3(uPhaseBass * 0.1, uPhaseMid * 0.03, uPhaseBass * 0.06);
  p += wind;

  float base = fbm3(p * 0.12);
  float detail = fbm3(p * 0.3 + vec3(0.0, 0.0, uPhaseTreble * 0.03));

  float density = base * 0.6 + detail * 0.4;

  // Fog hugs the terrain — denser in valleys, thinner at peaks
  float terrH = terrainHeight(p.xz);
  float heightAboveTerrain = p.y - terrH;
  float terrainHug = exp(-max(heightAboveTerrain, 0.0) * 0.3);

  // Also fog at high altitude (cloud layer)
  float cloudLayer = smoothstep(3.0, 5.0, p.y) * smoothstep(8.0, 6.0, p.y);

  density *= (terrainHug * 0.7 + cloudLayer * 0.5);

  // Bass breathes
  float threshold = 0.32 - uBass * 0.08;
  density = smoothstep(threshold, threshold + 0.15, density);

  return density;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: flying slowly over foggy mountains
  float flyZ = uPhaseBass * 1.5;
  float flyX = sin(uPhaseMid * 0.12) * 3.0;
  float flyY = 5.0 + sin(uPhaseMid * 0.08) * 0.5 + uBass * 0.3;
  vec3 ro = vec3(flyX, flyY, flyZ);

  float lookX = sin(uPhaseTreble * 0.05) * 0.08;
  float lookY = -0.15 + sin(uPhaseMid * 0.06) * 0.03;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.5 + lookY, 1.0));

  // Muted palette — cold, grey, liminal
  vec3 fogColorNear = vec3(0.35, 0.38, 0.42);
  vec3 fogColorFar = vec3(0.2, 0.22, 0.26);

  // Dim diffuse light
  vec3 lightDir = normalize(vec3(0.3, 0.5, 0.2));
  vec3 lightCol = vec3(0.6, 0.6, 0.65);

  // --- Raymarch terrain ---
  float t = 0.0;
  bool hitTerrain = false;

  for (int i = 0; i < 70; i++) {
    vec3 p = ro + rd * t;
    float h = terrainHeight(p.xz);
    float d = p.y - h;

    if (d < 0.02 * (1.0 + t * 0.05)) {
      hitTerrain = true;
      break;
    }
    if (t > 50.0) break;
    t += max(d * 0.4, 0.1);
  }

  float terrainDist = hitTerrain ? t : 100.0;
  vec3 terrainCol = vec3(0.0);

  if (hitTerrain) {
    vec3 p = ro + rd * t;
    vec3 n = terrainNormal(p.xz);
    float diff = max(dot(n, lightDir), 0.0);

    // Rock and moss
    vec3 rockCol = vec3(0.25, 0.24, 0.22);
    vec3 mossCol = vec3(0.15, 0.2, 0.12);
    float slope = n.y;
    terrainCol = mix(rockCol, mossCol, smoothstep(0.6, 0.9, slope));

    // Snow on high peaks
    float snow = smoothstep(3.0, 4.5, p.y) * smoothstep(0.4, 0.7, slope);
    terrainCol = mix(terrainCol, vec3(0.6, 0.62, 0.65), snow);

    terrainCol *= (diff * lightCol * 0.6 + 0.12);
  }

  // --- Raymarch fog volume ---
  vec3 col = vec3(0.0);
  float transmittance = 1.0;
  float ft = 0.0;
  float maxDist = min(terrainDist, 40.0);

  for (int i = 0; i < 45; i++) {
    if (transmittance < 0.03 || ft > maxDist) break;

    vec3 p = ro + rd * ft;
    float density = fogDensity(p);

    if (density > 0.005) {
      // Self-shadowing
      float shadow = fogDensity(p + vec3(0.1, 0.5, 0.0));
      float lit = exp(-shadow * 1.5) * 0.3 + 0.08;

      // Beat glow — subtle cold pulse
      float beatGlow = pow(uBeat, 1.5) * exp(-density * 3.0) * 0.15;

      vec3 fogCol = mix(fogColorFar, fogColorNear, lit);
      fogCol += vec3(0.3, 0.35, 0.4) * beatGlow;

      float alpha = density * 0.35;
      col += transmittance * fogCol * alpha;
      transmittance *= exp(-density * 0.4);
    }

    ft += 0.45 * (0.6 + 0.4 * (1.0 - min(density, 1.0)));
  }

  // Terrain through remaining transmittance
  col += transmittance * terrainCol;

  // Sky — matches fog for seamless blend
  vec3 sky = mix(fogColorFar, fogColorNear * 0.8, max(rd.y, 0.0));
  col += transmittance * sky * step(100.0, terrainDist);

  // Beat: cold pulse
  col += uBeat * vec3(0.02, 0.02, 0.025);

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
