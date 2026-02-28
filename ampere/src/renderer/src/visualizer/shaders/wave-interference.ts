/**
 * Wave interference pattern from 23 point sources arranged in a grid.
 * Energy mode: time-integrated squared wave superposition reveals
 * constructive/destructive interference fringes.
 * @source Shadertoy (wave interference, 23 sources)
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = wave intensity scaling, mid = output color hue shift,
 * treble = source count detail (unused, reserved), beat = flash.
 * MODE 5 (grid distribution), POW 1.0, DISPLAY false (energy mode).
 * iMouse replaced with audio-driven animated phase reference point.
 * iChannel2 keyboard texture removed -- controls hardcoded.
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

#define N 23

const float PI2 = 2.0 * 3.14159;

float rnd(float i) {
  return mod(4000.0 * sin(23464.345 * i + 45.345), 1.0);
}
float srnd(float i) { return 2.0 * rnd(i) - 1.0; }

void main() {
  vec2 fragCoord = vUV * uResolution;
  vec2 R = uResolution.xy;
  vec2 uv = (2.0 * fragCoord - R) / R.y;

  // Treble controls wavelength — more treble = tighter fringes
  float wavelength = 0.04 - uTreble * 0.015;
  float k = PI2 / wavelength;

  // Bass drives wave propagation speed
  float c = 0.1 + uBass * 0.08;

  float t = uPhaseBass * 0.2;

  // Animated phase reference — mid drives orbit pattern
  vec2 mouse = vec2(
    sin(uPhaseBass * 0.3 + uPhaseMid * 0.1),
    cos(uPhaseBass * 0.2 + uPhaseMid * 0.08)
  );

  // Grid source distribution setup
  float x = -0.75;
  float y = -0.7;
  const float stp = 1.54 / float(N);

  float Phi[N];
  float D2[N];

  for (int i = 0; i < N; i++) {
    vec2 P;

    // MODE 5: grid distribution
    P = vec2(2.0 * x, y);
    x += 1.4 * sqrt(stp);
    if (x > 0.7) { x = -0.7; y += sqrt(1.4 * stp); }

    // Sources wobble with bass — the grid breathes
    float fi = float(i);
    P += 0.03 * uBass * vec2(sin(fi * 2.1 + t * 3.0), cos(fi * 1.7 + t * 2.5));

    // Beat makes sources jump outward
    P *= 1.0 + uBeat * 0.08;

    // Wave phase
    float dm = length(mouse - P);
    float phim = dm;
    float d = length(uv - P);
    float phi = d - c * t;
    Phi[i] = k * (phi - phim);
    D2[i] = pow(d, 1.0);

    // Draw source point — beat makes them glow brighter
    if (d < 0.01) {
      fragColor = vec4(0.0, uBeat * 0.5, 1.0, 1.0);
      return;
    }
  }

  // Energy mode: time-integrated squared superposition
  float v = 0.0;
  for (int i = 0; i < N; i++) {
    for (int j = 0; j < N; j++) {
      v += cos(Phi[j] - Phi[i]) / (D2[i] * D2[j]);
    }
  }
  v = sqrt(v / 2.0);

  v = v * 4.5 / float(N);

  // Bass drives overall intensity
  v *= (1.0 + uBass * 0.8);

  // Beat pulses the fringes brighter
  v *= 1.0 + uBeat * 0.6;

  // Color: mid shifts from warm amber to cool cyan
  float midShift = uMid * 0.5;
  vec3 warmCol = vec3(1.0, 0.5, 0.25);
  vec3 coolCol = vec3(0.3, 0.7, 1.0);
  vec3 baseColor = mix(warmCol, coolCol, midShift);

  vec3 col = v * baseColor;

  // Treble adds edge sharpness glow
  col += uTreble * 0.05 * vec3(0.5, 0.3, 0.8) * v;

  // Beat flash
  col += uBeat * vec3(0.15, 0.1, 0.06);

  // Vignette
  float vig = 1.0 - 0.3 * dot(uv, uv);
  col *= vig;

  fragColor = vec4(col, 1.0);
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
