/**
 * @liminal gen4-frozen-dunes
 * @generation 4
 * @parents desert-dunes + "frozen, alien, blue"
 * @status ACTIVE
 * @mutation Desert's ridged FBM dune shapes but made of ice. Blue-white
 *          palette. Alien world. Subtle aurora shimmer in the dark sky.
 *          Wind ripples become frost patterns. The familiar dune shapes
 *          in wrong materials — uncanny. Cold wind particles.
 *
 * Frozen dunes — desert shapes in ice. Wrong planet. Wrong temperature.
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

// Desert parent's ridged FBM — creates dune crests
float ridgedFBM(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    float n = abs(noise(p) * 2.0 - 1.0);
    n = 1.0 - n;
    n = n * n;
    f += n * amp;
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return f;
}

float iceHeight(vec2 p) {
  // Slow wind direction — alien wind
  float windAngle = uPhaseMid * 0.04;
  mat2 windRot = mat2(cos(windAngle), sin(windAngle), -sin(windAngle), cos(windAngle));
  vec2 wp = windRot * p;

  // Large dune forms — same shapes as desert
  float dunes = ridgedFBM(wp * 0.15) * (3.0 + uBass * 0.5);
  dunes += ridgedFBM(wp * 0.5 + 3.0) * 0.5;

  // Frost crystal patterns instead of sand ripples
  float frost = noise(wp * 12.0 + vec2(uPhaseBass * 0.2, 0.0)) * 0.04;
  frost += abs(noise(wp * 25.0) * 2.0 - 1.0) * 0.015 * (1.0 + uTreble * 0.3);
  dunes += frost;

  return dunes;
}

vec3 iceNormal(vec2 p) {
  float e = 0.02;
  float h = iceHeight(p);
  return normalize(vec3(
    iceHeight(p + vec2(e, 0.0)) - h,
    e * 2.0,
    iceHeight(p + vec2(0.0, e)) - h
  ));
}

// Minimal aurora — just a hint in the sky
float auroraGlow(vec2 uv) {
  float wave = sin(uv.x * 2.0 + uPhaseBass * 0.3) * 0.3;
  wave += sin(uv.x * 5.0 + uPhaseMid * 0.2) * 0.15;
  float band = exp(-(uv.y - 0.4 - wave) * (uv.y - 0.4 - wave) * 8.0);
  float fine = fbm(vec2(uv.x * 3.0, uv.y * 5.0 + uPhaseBass * 0.1));
  return band * fine * 0.5;
}

vec3 skyColor(vec3 rd, vec2 uv) {
  // Dark alien sky — deep blue-black
  vec3 sky = mix(vec3(0.02, 0.03, 0.06), vec3(0.04, 0.06, 0.12), max(rd.y, 0.0));

  // Stars
  vec2 starUV = uv * 40.0;
  vec2 starId = floor(starUV);
  float star = smoothstep(0.08, 0.0, length(fract(starUV) - 0.5 -
    (vec2(hash(starId), hash(starId + 0.5)) - 0.5) * 0.7)) *
    step(0.93, hash(starId + 1.0));
  sky += vec3(0.6, 0.7, 1.0) * star * 0.5;

  // Subtle aurora
  float aurora = auroraGlow(uv);
  vec3 auroraCol = mix(vec3(0.1, 0.5, 0.3), vec3(0.2, 0.3, 0.6),
    sin(uPhaseMid * 0.08) * 0.5 + 0.5);
  sky += auroraCol * aurora * (0.4 + uBass * 0.3);

  return sky;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: gliding over frozen dunes
  float flyZ = uPhaseBass * 1.8;
  float flyX = sin(uPhaseMid * 0.12) * 3.5;
  float flyY = 4.0 + sin(uPhaseMid * 0.08) * 0.4;
  vec3 ro = vec3(flyX, flyY, flyZ);

  float lookX = sin(uPhaseTreble * 0.05) * 0.08;
  float lookY = -0.12;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.5 + lookY, 1.0));

  vec3 col = skyColor(rd, uv);

  // Raymarch against ice heightmap
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float h = iceHeight(p.xz);
    float d = p.y - h;

    if (d < 0.01 * (1.0 + t * 0.05)) {
      hit = true;
      // Binary search refinement
      float tA = t - 0.5;
      float tB = t;
      for (int j = 0; j < 5; j++) {
        float tM = (tA + tB) * 0.5;
        vec3 pM = ro + rd * tM;
        if (pM.y - iceHeight(pM.xz) < 0.0) tB = tM;
        else tA = tM;
      }
      t = (tA + tB) * 0.5;
      break;
    }
    if (t > 70.0) break;
    t += max(d * 0.4, 0.08);
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = iceNormal(p.xz);

    // Two light sources: dim blue sun + cold ambient
    vec3 sunDir = normalize(vec3(0.3, 0.15, -0.7));
    float nDotL = max(dot(n, sunDir), 0.0);

    // Ice material — blue-white with subsurface glow
    vec3 iceBase = vec3(0.5, 0.6, 0.75);
    vec3 iceShadow = vec3(0.15, 0.2, 0.35);
    vec3 iceCol = mix(iceShadow, iceBase, nDotL);

    // Frost shimmer on crests — treble sparkle
    float slope = n.y;
    vec3 viewDir = normalize(ro - p);
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 50.0);
    iceCol += vec3(0.6, 0.7, 1.0) * spec * 0.25 * (1.0 + uTreble * 0.5);

    // Subsurface scattering — light through ice at thin edges
    float sss = pow(max(dot(viewDir, -sunDir), 0.0), 3.0) * 0.15;
    iceCol += vec3(0.3, 0.5, 0.8) * sss;

    // Fresnel
    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0) * 0.3;
    iceCol += vec3(0.4, 0.5, 0.7) * fresnel;

    // Ambient
    iceCol += vec3(0.05, 0.07, 0.12) * 0.3;

    col = iceCol;

    // Atmospheric fog — cold blue haze
    float fog = 1.0 - exp(-t * 0.01);
    vec3 fogCol = vec3(0.1, 0.12, 0.2);
    col = mix(col, fogCol, fog);
  }

  // Beat: cold blue flash
  col += uBeat * vec3(0.01, 0.015, 0.03);

  // Wind particles — horizontal ice crystals
  float particles = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 pUV = uv * vec2(8.0 + fi * 4.0, 30.0 + fi * 15.0);
    pUV.x += uPhaseBass * (12.0 + fi * 4.0);
    particles += smoothstep(0.98, 1.0, noise(pUV)) * (0.2 - fi * 0.05);
  }
  col += vec3(0.4, 0.5, 0.8) * particles * (0.4 + uTreble * 0.3);

  // Vignette
  float vig = 1.0 - dot(uv * 0.28, uv * 0.28);
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
