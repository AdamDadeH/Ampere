/**
 * @seed bioluminescent-deep
 * @technique Particle systems + volumetric glow in dark water
 * @status SEED
 * @description Deep ocean bioluminescence. Glowing organisms pulse and
 *              drift in pitch-black water. Jellyfish bells, plankton
 *              clouds, bioluminescent trails. Bass triggers deep pulses,
 *              mid shifts glow colors, treble sparks plankton.
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

// Jellyfish bell shape
float jellySDF(vec3 p, vec3 center, float phase) {
  vec3 lp = p - center;

  // Pulsing motion
  float pulse = sin(phase + uPhaseBass * 1.5) * 0.15;
  float bellR = 0.3 + pulse;
  float bellH = 0.25 + pulse * 0.5;

  // Bell: hemisphere
  float bell = length(vec3(lp.x / bellR, (lp.y - 0.1) / bellH, lp.z / bellR)) - 1.0;

  // Only upper half
  bell = max(bell, -lp.y + 0.05);

  // Tentacles: thin cylinders below
  float tentacles = 1e5;
  for (int i = 0; i < 4; i++) {
    float angle = float(i) * 1.57;
    float tr = 0.08;
    vec2 tOff = vec2(cos(angle), sin(angle)) * 0.15;
    // Sway
    float sway = sin(lp.y * 3.0 - uPhaseMid * 2.0 + float(i)) * 0.1;
    vec2 td = lp.xz - tOff - vec2(sway);
    float tent = length(td) - 0.015;
    tent = max(tent, lp.y); // only below bell
    tent = max(tent, -(lp.y + 0.8)); // limit length
    tentacles = min(tentacles, tent);
  }

  return min(bell, tentacles);
}

// Plankton cloud — noise-based glow
float planktonDensity(vec3 p) {
  float n = noise(p.xz * 3.0 + vec2(uPhaseBass * 0.3, uPhaseMid * 0.2));
  n *= noise(p.xy * 4.0 + 5.0);
  float density = smoothstep(0.3, 0.6, n);
  // Treble sparks plankton
  density *= (0.5 + uTreble * 0.8);
  return density * 0.3;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: drifting in deep water
  vec3 ro = vec3(
    sin(uPhaseMid * 0.1) * 2.0,
    sin(uPhaseBass * 0.08) * 0.5,
    uPhaseBass * 1.0
  );
  vec3 rd = normalize(vec3(uv * 0.8, 1.0));

  // Rotate view slightly
  float rAngle = sin(uPhaseTreble * 0.05) * 0.1;
  float rc = cos(rAngle);
  float rs = sin(rAngle);
  rd.xy = mat2(rc, rs, -rs, rc) * rd.xy;

  vec3 col = vec3(0.0);

  // Jellyfish positions — scattered in the volume
  for (int j = 0; j < 5; j++) {
    float fj = float(j);
    vec3 jellyCenter = vec3(
      sin(fj * 2.4 + uPhaseMid * 0.15) * 3.0,
      cos(fj * 1.7 + uPhaseBass * 0.1) * 1.5,
      ro.z + 3.0 + fj * 2.0 + sin(fj * 3.0) * 1.0
    );

    // Glow color — shifts with mid
    float hue = fj * 0.3 + uPhaseMid * 0.05;
    vec3 glowCol = vec3(
      0.3 + 0.3 * sin(hue * 6.28),
      0.3 + 0.3 * sin(hue * 6.28 + 2.094),
      0.5 + 0.3 * sin(hue * 6.28 + 4.189)
    );

    // Simple distance-based glow (no full raymarch per jelly)
    float phase = fj * 1.5;

    // Closest approach of ray to jelly center
    vec3 oc = jellyCenter - ro;
    float tClosest = dot(oc, rd);
    if (tClosest < 0.0) continue;
    vec3 closest = ro + rd * tClosest;
    float dist = length(closest - jellyCenter);

    // Glow falloff
    float glow = exp(-dist * dist * 3.0);
    float pulse = 0.5 + 0.5 * sin(phase + uPhaseBass * 1.5);
    glow *= pulse * (0.7 + uBass * 0.3);

    // Depth fade
    float depthFade = exp(-tClosest * 0.08);

    col += glowCol * glow * depthFade * 0.6;

    // Bell specular highlight
    float bellSpec = exp(-dist * dist * 20.0) * pulse;
    col += glowCol * bellSpec * depthFade * 0.3;
  }

  // Plankton glow — volumetric
  float planktonGlow = 0.0;
  for (int i = 0; i < 15; i++) {
    float pt = float(i) * 0.8;
    vec3 pp = ro + rd * pt;
    planktonGlow += planktonDensity(pp) * exp(-pt * 0.1) * 0.04;
  }
  vec3 planktonCol = vec3(0.1, 0.4, 0.3) * (1.0 + uTreble * 0.5);
  col += planktonCol * planktonGlow;

  // Scattered bright sparks
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec3 sparkPos = vec3(
      sin(fi * 3.7 + uPhaseTreble * 0.3) * 4.0,
      cos(fi * 2.3 + uPhaseMid * 0.2) * 2.0,
      ro.z + mod(fi * 3.1 + uPhaseBass * 0.5, 10.0)
    );
    vec3 oc2 = sparkPos - ro;
    float tS = dot(oc2, rd);
    if (tS < 0.0) continue;
    vec3 closestS = ro + rd * tS;
    float distS = length(closestS - sparkPos);
    float spark = exp(-distS * distS * 50.0) * (0.3 + uTreble * 0.7);
    spark *= exp(-tS * 0.1);
    col += vec3(0.3, 0.8, 0.6) * spark * 0.5;
  }

  // Beat: deep pulse through the water
  col += uBeat * vec3(0.02, 0.04, 0.06);

  // Deep water background
  col += vec3(0.003, 0.005, 0.01);

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
