/**
 * @liminal gen5-caustic-pool
 * @generation 5
 * @parents ocean + empty-pool + "underwater light, caustics"
 * @status ACTIVE
 * @source https://www.shadertoy.com/view/MdlXz8
 * @mutation Adapted from Water Turbulence by David Hoskins / joltz0r.
 *          Iterative sin/cos feedback creates animated caustic light
 *          patterns — like looking at the bottom of a swimming pool.
 *          Bass drives the flow speed, mid shifts the color palette
 *          between blue-cyan and teal-green, treble sharpens the
 *          caustic lines, beat flashes brightness.
 *
 * Light through water. The pool is empty or full — you can't tell.
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

#define TAU 6.28318530718
#define MAX_ITER 5

void main() {
  vec2 uv = vUV;
  uv.x *= uResolution.x / uResolution.y;

  // Beat zoom-pulse — momentarily zoom toward center
  vec2 center = vec2(0.5 * uResolution.x / uResolution.y, 0.5);
  float beatZoom = 1.0 - pow(uBeat, 1.5) * 0.15;
  uv = center + (uv - center) * beatZoom;

  // Bass breathes the pattern scale
  float uvScale = 1.0 + uBass * 0.4;
  float time = uPhaseBass * 0.4 + uPhaseMid * 0.1 + 23.0;

  vec2 p = mod(uv * TAU * uvScale, TAU) - 250.0;
  vec2 i = vec2(p);
  float c = 1.0;

  // Bass widens the caustic lines, treble tightens them
  float inten = 0.005 * (1.0 + uBass * 0.8 - uTreble * 0.3);

  for (int n = 0; n < MAX_ITER; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    // Mid offsets each iteration differently — shifts the pattern character
    t += uMid * 0.3 * float(n);
    i = p + vec2(
      cos(t - i.x) + sin(t + i.y),
      sin(t - i.y) + cos(t + i.x)
    );
    c += 1.0 / length(vec2(
      p.x / (sin(i.x + t) / inten),
      p.y / (cos(i.y + t) / inten)
    ));
  }

  c /= float(MAX_ITER);

  // Treble dramatically sharpens the caustic lines
  float sharpness = 1.4 - uTreble * 0.4;
  c = 1.17 - pow(c, sharpness);

  // Bass drives the brightness power curve — more bass = brighter caustics
  float brightPow = 8.0 - uBass * 3.0;
  vec3 colour = vec3(pow(abs(c), brightPow));

  // Color palette — bass warms it, mid shifts between blue and teal
  vec3 coolCol = vec3(0.0, 0.35, 0.5);
  vec3 warmCol = vec3(0.1, 0.25, 0.45);
  vec3 tealCol = vec3(0.05, 0.42, 0.32);
  float midMix = sin(uPhaseMid * 0.08) * 0.5 + 0.5;
  vec3 tint = mix(mix(coolCol, tealCol, midMix), warmCol, uBass * 0.6);
  colour = clamp(colour + tint, 0.0, 1.0);

  // Treble adds white sparkle to bright caustic lines
  float sparkle = smoothstep(0.7, 1.0, colour.g) * uTreble;
  colour += vec3(0.2, 0.25, 0.3) * sparkle;

  // Beat: strong brightness flash + color surge
  float beatFlash = pow(uBeat, 1.5);
  colour += beatFlash * vec3(0.15, 0.25, 0.3);
  colour *= 1.0 + beatFlash * 0.4;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.25, vc * 0.25);
  colour *= vig;

  fragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
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
