/**
 * @liminal gen4-event-horizon
 * @generation 4
 * @parents deep-nebula + "darker, gravitational, ominous"
 * @status ACTIVE
 * @mutation Nebula's iterated folding technique but with gravitational
 *          distortion pulling everything toward a central void. The void
 *          at center is absolute black — light bends around it. Gas
 *          spirals inward in an accretion disk. More ominous palette.
 *          The closer to center, the more time/space distorts.
 *
 * Event horizon — the point of no return. Gas and light spiral
 * into absolute darkness.
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

// Nebula parent's iterated folding — the core technique
float nebulaField(vec3 p) {
  float accum = 0.0;
  float prev = 0.0;
  float tw = 0.0;

  for (int i = 0; i < 15; i++) {
    vec3 q = abs(p) / dot(p, p) - 0.53;
    float mag = length(q);
    float w = max(mag - prev, 0.0);
    accum += w * w * w;
    tw += 1.0;
    prev = mag;

    p = q * 1.35 + vec3(
      sin(uPhaseBass * 0.02 + float(i) * 0.12) * 0.08,
      cos(uPhaseMid * 0.015 + float(i) * 0.1) * 0.06,
      sin(uPhaseTreble * 0.01 + float(i) * 0.08) * 0.04
    );
  }
  return max(0.0, 5.0 * accum / tw - 0.35);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Gravitational lensing — warp UV toward center
  float dist = length(uv);
  float warpStrength = 0.3 / (dist + 0.3);
  vec2 warpedUV = uv * (1.0 + warpStrength * 0.15);

  // Accretion disk rotation — spiral inward
  float angle = atan(uv.y, uv.x);
  float spiralAngle = angle + warpStrength * 2.0 + uPhaseBass * 0.1;

  vec3 dir = normalize(vec3(warpedUV * 0.8, 1.0));

  // Slow rotation — ominous drift
  float rotA = uPhaseBass * 0.015;
  float c = cos(rotA);
  float s = sin(rotA);
  dir.xz = mat2(c, s, -s, c) * dir.xz;

  vec3 from = vec3(
    sin(uPhaseMid * 0.02) * 0.3,
    cos(uPhaseBass * 0.015) * 0.2,
    uPhaseBass * 0.08
  );

  // Volumetric raymarch
  vec3 col = vec3(0.0);
  float totalDensity = 0.0;
  float fade = 0.06;

  for (int r = 0; r < 55; r++) {
    float t = float(r) * 0.25;
    vec3 p = from + dir * t;

    // Gravitational spiral — rotate sample point around center
    float pDist = length(p.xy);
    float pAngle = atan(p.y, p.x);
    float spiral = uPhaseBass * 0.3 / (pDist + 0.5);
    p.xy = vec2(cos(pAngle + spiral), sin(pAngle + spiral)) * pDist;

    float field = nebulaField(p);
    float density = field * fade;
    fade *= 0.985;

    // Color: ominous palette — hot near center, cold far
    float distFromCenter = length(p.xy) / (t + 1.0);
    vec3 hotCol = vec3(0.8, 0.25, 0.08);    // brighter red-orange
    vec3 coldCol = vec3(0.12, 0.15, 0.35);   // cold blue
    vec3 midCol = vec3(0.5, 0.12, 0.3);      // purple

    vec3 gasCol;
    if (distFromCenter < 0.3) {
      gasCol = mix(hotCol, midCol, distFromCenter / 0.3);
    } else {
      gasCol = mix(midCol, coldCol, min((distFromCenter - 0.3) / 0.7, 1.0));
    }

    // Beat drives hot glow
    gasCol += hotCol * pow(uBeat, 1.5) * exp(-distFromCenter * 3.0) * 0.5;

    col += density * gasCol;
    totalDensity += density;

    if (totalDensity > 3.0) break;
  }

  // The void — absolute black hole at center
  float holeMask = smoothstep(0.08, 0.15, dist);
  col *= holeMask;

  // Accretion disk ring — bright ring just outside the event horizon
  float ringDist = abs(dist - 0.18);
  float ring = exp(-ringDist * ringDist * 800.0);
  // Ring color shifts with phase
  vec3 ringCol = mix(vec3(0.8, 0.3, 0.1), vec3(0.5, 0.15, 0.4), sin(uPhaseMid * 0.08) * 0.5 + 0.5);
  ring *= (0.4 + uBass * 0.6);
  col += ringCol * ring * 1.2;

  // Photon ring — very thin bright line at the edge
  float photonRing = exp(-abs(dist - 0.12) * abs(dist - 0.12) * 5000.0);
  col += vec3(1.0, 0.7, 0.3) * photonRing * 0.3 * (1.0 + uBeat * 2.0);

  // Stars behind — dimmed by gas
  vec2 starUV = dir.xy / (dir.z + 1.0) * 200.0;
  vec2 starId = floor(starUV);
  vec2 starF = fract(starUV) - 0.5;
  float starR = length(starF - (vec2(
    fract(sin(dot(starId, vec2(12.9898, 78.233))) * 43758.5453),
    fract(sin(dot(starId, vec2(93.9898, 67.345))) * 24634.6345)
  ) - 0.5) * 0.7);
  float star = smoothstep(0.08, 0.0, starR) *
    step(0.94, fract(sin(dot(starId, vec2(45.678, 89.012))) * 12345.6789));
  col += vec3(0.8, 0.85, 1.0) * star * max(0.0, 1.0 - totalDensity * 0.5) * holeMask * 0.6;

  // Beat: ominous deep pulse
  col += uBeat * vec3(0.03, 0.01, 0.02);

  // Tone map
  col = col / (1.0 + col * 0.15);
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
