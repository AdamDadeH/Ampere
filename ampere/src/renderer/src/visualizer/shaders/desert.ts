/**
 * @seed desert-dunes
 * @technique FBM heightmap with wind ripples + heat shimmer
 * @status SEED
 * @description Endless desert dunes. Wind sculpts sand into flowing ridges.
 *              Heat shimmer distorts the horizon. Golden hour light.
 *              Bass shifts dune scale, treble adds ripple detail,
 *              beat intensifies sun glare.
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

// Ridged FBM — creates dune crests
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

float duneHeight(vec2 p) {
  // Wind direction shifts slowly with mid
  float windAngle = uPhaseMid * 0.05;
  mat2 windRot = mat2(cos(windAngle), sin(windAngle), -sin(windAngle), cos(windAngle));
  vec2 wp = windRot * p;

  // Large dune forms
  float dunes = ridgedFBM(wp * 0.15) * (3.0 + uBass * 1.0);

  // Medium ridges
  dunes += ridgedFBM(wp * 0.5 + 3.0) * 0.6;

  // Fine wind ripples — treble controlled
  float ripples = noise(wp * 8.0 + vec2(uPhaseBass * 0.5, 0.0)) * 0.08;
  ripples += noise(wp * 16.0) * 0.03 * (1.0 + uTreble * 0.5);
  dunes += ripples;

  return dunes;
}

vec3 duneNormal(vec2 p) {
  float e = 0.02;
  float h = duneHeight(p);
  return normalize(vec3(
    duneHeight(p + vec2(e, 0.0)) - h,
    e * 2.0,
    duneHeight(p + vec2(0.0, e)) - h
  ));
}

vec3 skyColor(vec3 rd) {
  // Desert sky: hot haze near horizon, deep blue above
  float sunY = 0.15;
  vec3 sunDir = normalize(vec3(0.4, sunY, -0.8));
  float sun = max(dot(rd, sunDir), 0.0);

  vec3 sky = mix(vec3(0.9, 0.7, 0.5), vec3(0.3, 0.5, 0.8), max(rd.y, 0.0));
  // Haze near horizon
  sky = mix(vec3(0.85, 0.75, 0.6), sky, smoothstep(0.0, 0.3, rd.y));

  // Sun
  sky += vec3(1.0, 0.8, 0.4) * pow(sun, 64.0) * 2.0;
  sky += vec3(1.0, 0.6, 0.3) * pow(sun, 8.0) * 0.3;

  return sky;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Heat shimmer distortion
  float shimmer = sin(uv.y * 40.0 + uPhaseBass * 5.0) * 0.003;
  shimmer += sin(uv.y * 80.0 + uPhaseTreble * 3.0) * 0.001;
  uv.x += shimmer * smoothstep(0.0, -0.3, uv.y); // only near horizon

  // Camera: gliding over dunes
  float flyZ = uPhaseBass * 2.0;
  float flyX = sin(uPhaseMid * 0.15) * 4.0;
  float flyY = 4.0 + sin(uPhaseMid * 0.1) * 0.5;
  vec3 ro = vec3(flyX, flyY, flyZ);

  float lookX = sin(uPhaseTreble * 0.06) * 0.1;
  float lookY = -0.15;
  vec3 rd = normalize(vec3(uv.x * 0.7 + lookX, uv.y * 0.5 + lookY, 1.0));

  vec3 col = skyColor(rd);

  // Raymarch against heightmap
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float h = duneHeight(p.xz);
    float d = p.y - h;

    if (d < 0.01 * t) {
      hit = true;
      // Refine
      float tA = t - 0.5;
      float tB = t;
      for (int j = 0; j < 5; j++) {
        float tM = (tA + tB) * 0.5;
        vec3 pM = ro + rd * tM;
        if (pM.y - duneHeight(pM.xz) < 0.0) tB = tM;
        else tA = tM;
      }
      t = (tA + tB) * 0.5;
      break;
    }

    if (t > 80.0) break;
    t += max(d * 0.4, 0.05);
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = duneNormal(p.xz);

    // Sun direction
    vec3 sunDir = normalize(vec3(0.4, 0.15, -0.8));

    // Sand material
    vec3 sandCol = vec3(0.76, 0.6, 0.42);
    // Shadow side slightly cooler
    float nDotL = max(dot(n, sunDir), 0.0);
    vec3 shadowCol = vec3(0.5, 0.4, 0.35);

    vec3 diffuse = mix(shadowCol, sandCol, nDotL) * vec3(1.0, 0.85, 0.65);

    // Specular — sun glinting off sand
    vec3 viewDir = normalize(ro - p);
    vec3 halfDir = normalize(sunDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 60.0);
    diffuse += vec3(1.0, 0.8, 0.5) * spec * 0.3 * (1.0 + uBeat * 1.0);

    // Ambient
    diffuse += vec3(0.4, 0.35, 0.3) * 0.1;

    col = diffuse;

    // Atmospheric fog — dusty haze
    float fog = 1.0 - exp(-t * 0.01);
    vec3 fogCol = vec3(0.75, 0.65, 0.5);
    col = mix(col, fogCol, fog);
  }

  // Beat: sun flare
  col += uBeat * vec3(0.06, 0.04, 0.01);

  // Vignette
  float vig = 1.0 - dot(uv * 0.25, uv * 0.25);
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
