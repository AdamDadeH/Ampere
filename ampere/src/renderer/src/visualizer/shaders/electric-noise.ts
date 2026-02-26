/**
 * @liminal gen5-electric-noise
 * @generation 5
 * @parents plasma + stormclouds + "electric, turbulent, nimitz"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/ldlXRS
 * @mutation Adapted from "Noise animation - Electric" by nimitz.
 *          Dual FBM domain displacement with ridged (turbulent) noise.
 *          Two rotated FBM calls displace the domain, then a third
 *          FBM colors it. Concentric ring modulation creates the
 *          electric focal point. Deep purple/magenta palette.
 *
 * Electric turbulence. The noise folds in on itself.
 * Original uses a texture for noise — we use procedural hash noise.
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

#define TAU 6.2831853

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

// Procedural value noise (replaces texture lookup)
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

mat2 makem2(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat2(c, -s, s, c);
}

// Ridged (turbulent) FBM
float fbm(vec2 p) {
  float z = 2.0;
  float rz = 0.0;
  for (float i = 1.0; i < 6.0; i++) {
    rz += abs((noise(p) - 0.5) * 2.0) / z;
    z *= 2.0;
    p *= 2.0;
  }
  return rz;
}

// Dual FBM — domain displaced by two rotated FBM calls
// displaceAmt and rotSpeed are driven by audio
float dualfbm(vec2 p, float t, float displaceAmt, float rotSpeed) {
  vec2 p2 = p * 0.7;
  vec2 basis = vec2(
    fbm(p2 - t * 1.6),
    fbm(p2 + t * 1.7)
  );
  basis = (basis - 0.5) * displaceAmt;
  p += basis;

  return fbm(p * makem2(t * rotSpeed));
}

// Concentric ring modulation
float circ(vec2 p) {
  float r = length(p);
  r = log(sqrt(r));
  return abs(mod(r * 4.0, TAU) - 3.14159) * 3.0 + 0.2;
}

void main() {
  vec2 p = vUV - 0.5;
  p.x *= uResolution.x / uResolution.y;

  // Bass breathes the scale — zooms in on hits
  float scale = 4.0 - uBass * 1.5;
  p *= scale;

  // Audio-driven time — mid adds drift variation
  float t = uPhaseBass * 0.12 + uPhaseMid * 0.03;

  // Bass drives the domain displacement strength (core visual change)
  float displaceAmt = 0.15 + uBass * 0.4;
  // Treble spins the FBM rotation faster — adds turbulent energy
  float rotSpeed = 0.15 + uTreble * 0.25;

  float rz = dualfbm(p, t, displaceAmt, rotSpeed);

  // Ring modulation — beat pulses the ring expansion
  float ringPhase = t * 10.0 + uBeat * 3.0;
  vec2 ringP = p / exp(mod(ringPhase, 3.14159));
  rz *= pow(abs(0.1 - circ(ringP)), 0.9);

  // Color: bass shifts from cool purple to hot magenta/pink
  vec3 coolCol = vec3(0.15, 0.1, 0.45);
  vec3 hotCol = vec3(0.45, 0.05, 0.35);
  vec3 tint = mix(coolCol, hotCol, uBass);

  // Mid rotates hue over time
  float hueShift = uPhaseMid * 0.15;
  tint += vec3(
    0.08 * sin(hueShift),
    0.05 * sin(hueShift + 2.1),
    0.06 * sin(hueShift + 4.2)
  );

  vec3 col = tint / rz;
  col = pow(abs(col), vec3(0.99));

  // Treble adds visible brightness and sharpness
  col *= 1.0 + uTreble * 0.6;

  // Beat: strong flash — white-hot center pulse
  float beatFlash = pow(uBeat, 1.5);
  col += beatFlash * vec3(0.3, 0.15, 0.4);
  // Beat also brightens everything momentarily
  col *= 1.0 + beatFlash * 0.5;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.25, vc * 0.25);
  col *= vig;

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
