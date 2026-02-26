/**
 * @liminal gen5-hyperloop
 * @generation 5
 * @parents tunnel + warp + "kishimisu, logarithmic, repetition"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/4XVGWh
 * @mutation Adapted from "Hyperloop" by @kishimisu (2024). CC BY-NC-SA 4.0.
 *          Logarithmic scaling creates scale-invariant space repetition.
 *          Multiple rotation matrices fold the ray through atan-quantized
 *          angular cells. Exponential depth layers with per-cell sizing.
 *          Distance field creates glowing structural elements. Continuous
 *          zoom through an infinite fractal tunnel.
 *
 * The tunnel folds in on itself. Scale is meaningless. You're always arriving.
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

#define PI 3.14159265

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, s, -s, c);
}

// tanh approximation for compatibility
float tnh(float x) {
  float e2 = exp(2.0 * clamp(x, -10.0, 10.0));
  return (e2 - 1.0) / (e2 + 1.0);
}

void main() {
  vec2 F = vUV * uResolution;
  vec3 H = vec3(uResolution, 1.0);

  // Audio-driven time — bass is the throttle
  float E = uPhaseBass * 0.15 + uPhaseMid * 0.04;

  // Bass zooms in (speed feeling)
  float speedScale = 1.0 + uBass * 0.3;

  vec4 O = vec4(0.0);
  vec3 P;
  float R, L = 0.1, o = 0.0;

  for (float i = 0.0; i < 50.0; i++) {
    o = i;
    P = vec3(F + F - H.xy, H.y);
    float lp = length(P.xy);

    P *= L / lp;
    P.z -= 1.0;

    // Rotation layers — treble adds more spin
    float rotSpeed = 0.3 + uTreble * 0.2;
    P.xz *= rot(rotSpeed);
    P.zy *= rot(1.0);

    // Angular quantization — mid shifts the angular cells
    float angOffset = E * 0.2 + uMid * 0.1;
    float ang = round((atan(P.y, P.x) + angOffset) * 1.91) / 1.91 - angOffset;
    P.yx *= rot(ang);

    // Logarithmic depth layers
    vec3 Y = vec3(0.0);
    Y.x = pow(0.67, floor(E * speedScale - log(P.x) / 0.4) - E * speedScale);

    // Distance field — three components
    float d1 = length(P.xy);                    // tube wall
    float d2 = length(P - Y) - Y.x * 0.2;      // structural elements
    float d3 = length(P - Y * 0.67) - Y.x * 0.134; // inner details

    R = min(min(d1, d2), d3) * 0.8;
    L += R;

    // Accumulate color — distance-based glow
    float glow = tnh(R * 1000.0) + 2.0 - 2.0 * tnh(length(P.xy) * 7.0);

    // Color cycling — per-depth hue with mid-driven palette shift
    float hueBase = log(L * L) + o * 0.07 - E;
    vec4 hueCol = 0.8 + cos(hueBase + uPhaseMid * 0.08 + vec4(0.0, 1.0, 2.0, 0.0));

    O += 0.02 * glow * hueCol / (++R);
  }

  vec3 col = O.rgb;

  // Bass boosts overall brightness
  col *= 1.0 + uBass * 0.5;

  // Beat: zoom flash + brightness surge
  float beatFlash = pow(uBeat, 1.5);
  col += beatFlash * vec3(0.12, 0.08, 0.15);
  col *= 1.0 + beatFlash * 0.4;

  // Treble adds sharpness/contrast
  col = mix(col, col * col, uTreble * 0.3);

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
