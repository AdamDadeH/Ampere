/**
 * @seed deep-nebula
 * @technique Volumetric nebula with iterated folding (Star Nest family)
 * @status SEED
 * @source https://www.shadertoy.com/view/XlfGRj
 * @description Deep space nebula. Dense colorful gas clouds with embedded
 *              stars. Volumetric raymarching with iterated folding creates
 *              complex structure. Based on Star Nest by Kali.
 *              Bass drives density, mid shifts palette, treble adds
 *              fine structure, beat brightens star points.
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

// Star Nest core: iterated folding creates fractal nebula structure
float nebulaField(vec3 p) {
  float strength = 7.0 + uBass * 2.0;
  float accum = 0.0;
  float prev = 0.0;
  float tw = 0.0;

  for (int i = 0; i < 18; i++) {
    // Folding: abs creates fractal-like symmetry
    vec3 q = abs(p) / dot(p, p) - 0.7;
    float mag = length(q);
    float w = max(mag - prev, 0.0);
    accum += w * w * w;
    tw += 1.0;
    prev = mag;

    // Iterate: scale + rotate
    p = q * 1.3 + vec3(
      sin(uPhaseBass * 0.03 + float(i) * 0.1) * 0.1,
      cos(uPhaseMid * 0.02 + float(i) * 0.15) * 0.08,
      sin(uPhaseTreble * 0.01 + float(i) * 0.12) * 0.06
    );
  }
  return max(0.0, 5.0 * accum / tw - 0.7);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: drifting through the nebula
  vec3 dir = normalize(vec3(uv * 0.8, 1.0));

  // Slow rotation
  float rotAngle = uPhaseBass * 0.03;
  float c = cos(rotAngle);
  float s = sin(rotAngle);
  dir.xz = mat2(c, s, -s, c) * dir.xz;

  float rotAngle2 = uPhaseMid * 0.02;
  c = cos(rotAngle2);
  s = sin(rotAngle2);
  dir.yz = mat2(c, s, -s, c) * dir.yz;

  // Travel through the nebula
  vec3 from = vec3(
    sin(uPhaseMid * 0.04) * 0.5,
    cos(uPhaseBass * 0.03) * 0.3,
    uPhaseBass * 0.15
  );

  // Volumetric raymarch
  float fade = 0.01;
  vec3 col = vec3(0.0);
  float totalDensity = 0.0;

  for (int r = 0; r < 45; r++) {
    float t = float(r) * 0.25;
    vec3 p = from + dir * t;

    float field = nebulaField(p);

    // Density with distance fade
    float density = field * fade;
    fade *= 0.98;

    // Nebula coloring — shifts with mid
    float colorPhase = uPhaseMid * 0.06;
    vec3 nebulaCol;
    float cp = fract(float(r) * 0.03 + colorPhase);
    if (cp < 0.33) {
      nebulaCol = mix(vec3(0.5, 0.1, 0.6), vec3(0.1, 0.3, 0.8), cp / 0.33);
    } else if (cp < 0.66) {
      nebulaCol = mix(vec3(0.1, 0.3, 0.8), vec3(0.2, 0.6, 0.5), (cp - 0.33) / 0.33);
    } else {
      nebulaCol = mix(vec3(0.2, 0.6, 0.5), vec3(0.5, 0.1, 0.6), (cp - 0.66) / 0.34);
    }

    // Accumulate
    col += density * nebulaCol * 0.8;
    totalDensity += density;

    if (totalDensity > 3.0) break;
  }

  // Stars: bright points in the background
  float starLayer1 = 0.0;
  float starLayer2 = 0.0;
  vec3 starDir = dir;

  // Star field using hash
  vec2 starUV = starDir.xy / (starDir.z + 1.0) * 200.0;
  vec2 starId = floor(starUV);
  vec2 starF = fract(starUV) - 0.5;
  float starR = length(starF - (vec2(
    fract(sin(dot(starId, vec2(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(starId, vec2(93.9898, 67.345))) * 24634.6345)
  ) - 0.5) * 0.7);
  float starBright = smoothstep(0.1, 0.0, starR) *
    step(0.93, fract(sin(dot(starId, vec2(45.678, 89.012))) * 12345.6789));

  // Second layer
  starUV = starDir.xy / (starDir.z + 1.0) * 350.0 + 100.0;
  starId = floor(starUV);
  starF = fract(starUV) - 0.5;
  starR = length(starF - (vec2(
    fract(sin(dot(starId, vec2(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(starId, vec2(93.9898, 67.345))) * 24634.6345)
  ) - 0.5) * 0.7);
  float starBright2 = smoothstep(0.08, 0.0, starR) *
    step(0.95, fract(sin(dot(starId, vec2(45.678, 89.012))) * 12345.6789));

  float stars = starBright + starBright2 * 0.6;
  stars *= (1.0 + uBeat * 1.0);

  // Stars behind nebula
  col += vec3(0.9, 0.9, 1.0) * stars * max(1.0 - totalDensity * 0.5, 0.0);

  // Beat: nebula glow pulse
  col += uBeat * vec3(0.05, 0.03, 0.06);

  // Tone map
  col = col / (1.0 + col * 0.2);
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
