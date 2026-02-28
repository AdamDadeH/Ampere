/**
 * @seed terrain-flyover
 * @technique FBM heightmap raymarching (iq "Elevated" family)
 * @status SEED
 * @description Endless mountainous terrain flyover. FBM noise heightmap with
 *              analytical normals. Camera glides forward. Bass lifts terrain,
 *              treble sharpens ridges. Atmospheric fog + sky gradient.
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
  return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    f += amp * noise(p * freq);
    p = rot * p;
    freq *= 2.02;
    amp *= 0.5;
  }
  return f;
}

float terrainHeight(vec2 p) {
  // Bass lifts the terrain, treble adds ridge detail
  float h = fbm(p * 0.3, 6) * (2.0 + uBass * 1.5);
  h += fbm(p * 1.2 + 5.0, 4) * 0.4 * (1.0 + uTreble * 0.8);
  // Ridging: sharp peaks
  float ridge = 1.0 - abs(fbm(p * 0.6, 5) * 2.0 - 1.0);
  h += ridge * ridge * 0.6;
  return h;
}

vec3 terrainNormal(vec2 p) {
  float e = 0.02;
  float h = terrainHeight(p);
  return normalize(vec3(
    terrainHeight(p + vec2(e, 0.0)) - h,
    e * 2.0,
    terrainHeight(p + vec2(0.0, e)) - h
  ));
}

vec3 skyColor(vec3 rd) {
  float sun = max(dot(rd, normalize(vec3(0.4, 0.3, -0.8))), 0.0);
  vec3 sky = mix(vec3(0.3, 0.4, 0.6), vec3(0.7, 0.8, 1.0), max(rd.y, 0.0));
  sky += vec3(1.0, 0.7, 0.4) * pow(sun, 32.0) * 0.5;
  sky += vec3(1.0, 0.9, 0.7) * pow(sun, 256.0) * 1.5;
  return sky;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: flying forward over the terrain
  float flyZ = uPhaseBass * 2.0;
  float flyX = sin(uPhaseMid * 0.2) * 3.0;
  float flyY = 3.5 + sin(uPhaseMid * 0.15) * 0.5 + uBass * 0.5;
  vec3 ro = vec3(flyX, flyY, flyZ);

  // Look direction: forward with gentle drift
  float lookX = sin(uPhaseTreble * 0.08) * 0.15;
  float lookY = -0.2 + sin(uPhaseMid * 0.12) * 0.05;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.5 + lookY, 1.0));

  // Raymarch against heightmap
  float t = 0.0;
  vec3 col = skyColor(rd);
  bool hit = false;

  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float h = terrainHeight(p.xz);
    float d = p.y - h;

    if (d < 0.01 * t) {
      hit = true;
      // Binary search refinement
      float tA = t - 0.5;
      float tB = t;
      for (int j = 0; j < 5; j++) {
        float tM = (tA + tB) * 0.5;
        vec3 pM = ro + rd * tM;
        if (pM.y - terrainHeight(pM.xz) < 0.0) tB = tM;
        else tA = tM;
      }
      t = (tA + tB) * 0.5;

      vec3 hp = ro + rd * t;
      vec3 n = terrainNormal(hp.xz);

      // Material: snow on peaks, rock on slopes, grass in valleys
      float slope = n.y;
      float height = hp.y;
      vec3 rockCol = vec3(0.35, 0.3, 0.25);
      vec3 grassCol = vec3(0.2, 0.35, 0.15);
      vec3 snowCol = vec3(0.85, 0.88, 0.92);

      vec3 matCol = mix(rockCol, grassCol, smoothstep(0.5, 0.8, slope));
      matCol = mix(matCol, snowCol, smoothstep(2.5, 3.5, height) * smoothstep(0.5, 0.7, slope));

      // Lighting
      vec3 sunDir = normalize(vec3(0.4, 0.3, -0.8));
      float diff = max(dot(n, sunDir), 0.0);
      float amb = 0.15;
      vec3 sunCol = vec3(1.0, 0.9, 0.7);

      col = matCol * (diff * sunCol + amb * vec3(0.5, 0.6, 0.8));

      // Atmospheric fog
      float fog = 1.0 - exp(-t * 0.012);
      vec3 fogCol = vec3(0.55, 0.6, 0.75);
      col = mix(col, fogCol, fog);
      break;
    }

    if (t > 80.0) break;
    t += max(d * 0.5, 0.1);
  }

  // Beat: warm golden flash
  col += uBeat * vec3(0.04, 0.03, 0.01);

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  col *= vig;

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
