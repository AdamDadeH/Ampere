/**
 * @liminal gen4-sandstorm
 * @generation 4
 * @parents gen3-void-clouds x desert-dunes
 * @status ACTIVE
 * @mutation Crossover: stormclouds' volumetric FBM cloud masses +
 *          desert's ridged FBM dune terrain. A massive dust storm
 *          engulfs infinite dunes. Camera between earth and sky.
 *          Visibility collapses into warm ochre haze. Sand particles
 *          stream horizontally. The dunes breathe through the murk.
 *
 * Sandstorm — you can't see the horizon. Dunes below, churning
 * dust above, and the boundary dissolves.
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

// Ridged FBM from desert parent — creates dune crests
float ridgedFBM(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    float n = abs(noise(p) * 2.0 - 1.0);
    n = 1.0 - n;
    n = n * n;
    f += n * amp;
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return f;
}

float duneHeight(vec2 p) {
  float windAngle = uPhaseMid * 0.03;
  mat2 windRot = mat2(cos(windAngle), sin(windAngle), -sin(windAngle), cos(windAngle));
  vec2 wp = windRot * p;
  float dunes = ridgedFBM(wp * 0.15) * (2.5 + uBass * 0.5);
  dunes += ridgedFBM(wp * 0.5 + 3.0) * 0.4;
  return dunes;
}

vec3 duneNormal(vec2 p) {
  float e = 0.03;
  float h = duneHeight(p);
  return normalize(vec3(
    duneHeight(p + vec2(e, 0.0)) - h,
    e * 2.0,
    duneHeight(p + vec2(0.0, e)) - h
  ));
}

// Volumetric dust from stormclouds parent — FBM cloud masses
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

float dustDensity(vec3 p) {
  // Wind drives dust horizontally
  vec3 wind = vec3(uPhaseBass * 0.8, uPhaseMid * 0.05, uPhaseBass * 0.3);
  p += wind;

  float base = fbm3(p * 0.15);
  float detail = fbm3(p * 0.4 + vec3(0.0, 0.0, uPhaseTreble * 0.1));

  float density = base * 0.6 + detail * 0.4;

  // Denser near ground, thins above
  float heightFade = smoothstep(8.0, 2.0, p.y);
  density *= heightFade;

  // Bass breathes the storm
  float threshold = 0.3 - uBass * 0.1;
  density = smoothstep(threshold, threshold + 0.15, density);

  return density;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: low, trudging through the storm
  float walkZ = uPhaseBass * 1.2;
  float walkX = sin(uPhaseMid * 0.1) * 2.0;
  vec3 ro = vec3(walkX, 3.0 + sin(uPhaseMid * 0.08) * 0.3, walkZ);

  float lookX = sin(uPhaseTreble * 0.05) * 0.08;
  float lookY = -0.1 + sin(uPhaseMid * 0.07) * 0.03;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.5 + lookY, 1.0));

  // Dust color palette — warm ochre storm
  vec3 dustColorBright = vec3(0.7, 0.55, 0.35);
  vec3 dustColorDark = vec3(0.25, 0.18, 0.1);

  // Sun — barely visible through the dust
  vec3 sunDir = normalize(vec3(0.3, 0.4, -0.6));
  float sunDot = max(dot(rd, sunDir), 0.0);

  // --- Raymarch terrain ---
  float t = 0.0;
  bool hitTerrain = false;

  for (int i = 0; i < 60; i++) {
    vec3 p = ro + rd * t;
    float h = duneHeight(p.xz);
    float d = p.y - h;

    if (d < 0.02 * (1.0 + t * 0.05)) {
      hitTerrain = true;
      break;
    }
    if (t > 40.0) break;
    t += max(d * 0.4, 0.1);
  }

  vec3 terrainCol = vec3(0.0);
  float terrainDist = hitTerrain ? t : 100.0;

  if (hitTerrain) {
    vec3 p = ro + rd * t;
    vec3 n = duneNormal(p.xz);
    float nDotL = max(dot(n, sunDir), 0.0);

    vec3 sandCol = vec3(0.65, 0.5, 0.35);
    vec3 shadowCol = vec3(0.35, 0.25, 0.18);
    terrainCol = mix(shadowCol, sandCol, nDotL);
    terrainCol += vec3(0.15, 0.12, 0.08) * 0.1; // ambient
  }

  // --- Raymarch dust volume ---
  vec3 col = vec3(0.0);
  float transmittance = 1.0;
  float dt = 0.0;
  float maxDist = min(terrainDist, 35.0);

  for (int i = 0; i < 50; i++) {
    if (transmittance < 0.03 || dt > maxDist) break;

    vec3 p = ro + rd * dt;
    float density = dustDensity(p);

    if (density > 0.005) {
      // Dust lit by diffuse sun through the mass
      float shadow = dustDensity(p + sunDir * 0.5);
      float lit = exp(-shadow * 2.0) * 0.4 + 0.1;

      // Beat glow through the dust
      float beatGlow = pow(uBeat, 1.5) * exp(-density * 2.0) * 0.3;

      vec3 dustCol = mix(dustColorDark, dustColorBright, lit);
      dustCol += vec3(0.8, 0.5, 0.2) * beatGlow;

      float alpha = density * 0.4;
      col += transmittance * dustCol * alpha;
      transmittance *= exp(-density * 0.5);
    }

    dt += 0.4 * (0.7 + 0.3 * (1.0 - min(density, 1.0)));
  }

  // Terrain shows through remaining transmittance
  col += transmittance * terrainCol;

  // Background: dust-choked sky
  vec3 bg = dustColorDark * 0.4;
  bg += vec3(0.5, 0.35, 0.15) * pow(sunDot, 4.0) * 0.3; // sun glow through haze
  col += transmittance * bg * step(100.0, terrainDist); // only if no terrain hit

  // Sand particles streaming past — horizontal streaks
  float particles = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 pUV = uv * vec2(5.0 + fi * 3.0, 20.0 + fi * 10.0);
    pUV.x += uPhaseBass * (10.0 + fi * 5.0);
    particles += smoothstep(0.98, 1.0, noise(pUV)) * (0.3 - fi * 0.08);
  }
  col += vec3(0.6, 0.45, 0.25) * particles * (0.5 + uTreble * 0.5);

  // Beat: warm pulse
  col += uBeat * vec3(0.04, 0.025, 0.01);

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
