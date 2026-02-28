/**
 * @seed aurora
 * @technique Layered curtain noise bands with spectral coloring
 * @status SEED
 * @description Northern lights / aurora borealis. Vertical curtain bands
 *              of colored light waving in a dark sky. Stars behind.
 *              Bass sways the curtains, mid shifts colors, treble adds
 *              fine shimmer, beat brightens the display.
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

// Stars
float stars(vec2 uv) {
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float r = hash(id);
  float d = length(f - (vec2(hash(id + 0.1), hash(id + 0.2)) - 0.5) * 0.8);
  float star = smoothstep(0.05, 0.0, d) * step(0.92, r);
  // Twinkle
  star *= 0.5 + 0.5 * sin(uPhaseTreble * 2.0 + r * 30.0);
  return star;
}

// Aurora curtain: a vertical band of light at a given x position
float curtain(vec2 uv, float offset, float speed) {
  // Horizontal wave — bass sways
  float wave = sin(uv.y * 1.5 + uPhaseBass * speed + offset) * 0.3;
  wave += sin(uv.y * 3.0 + uPhaseMid * speed * 0.7 + offset * 2.0) * 0.15;
  wave += sin(uv.y * 7.0 + uPhaseTreble * speed * 0.3 + offset * 3.0) * 0.05;

  float x = uv.x + wave;

  // Curtain shape: gaussian band
  float band = exp(-x * x * 2.0);

  // Vertical fade: aurora appears in upper portion of sky
  float vFade = smoothstep(-0.1, 0.3, uv.y) * smoothstep(1.2, 0.5, uv.y);

  // Fine structure from FBM
  float fine = fbm(vec2(uv.x * 3.0 + offset, uv.y * 5.0 + uPhaseBass * 0.3));
  fine = fine * 0.5 + 0.5;

  return band * vFade * fine * (0.6 + uBass * 0.4);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Shift view upward — we're looking at the sky
  uv.y += 0.1;

  // Dark sky background
  vec3 col = vec3(0.005, 0.01, 0.02);

  // Stars behind the aurora
  float s = stars(uv * 30.0) + stars(uv * 50.0 + 10.0) * 0.5;
  col += vec3(0.8, 0.85, 1.0) * s * 0.6;

  // Aurora color palette — shifts with mid
  float colorShift = sin(uPhaseMid * 0.12) * 0.5 + 0.5;
  vec3 green = vec3(0.1, 0.8, 0.3);
  vec3 teal = vec3(0.1, 0.6, 0.7);
  vec3 purple = vec3(0.5, 0.2, 0.8);
  vec3 pink = vec3(0.8, 0.2, 0.5);

  // Multiple curtain layers
  float c1 = curtain(uv - vec2(0.3, 0.0), 0.0, 0.4);
  float c2 = curtain(uv + vec2(0.2, 0.0), 2.5, 0.35);
  float c3 = curtain(uv - vec2(0.1, 0.0), 5.0, 0.45);
  float c4 = curtain(uv + vec2(0.5, 0.0), 7.5, 0.3);

  // Color each curtain differently, shifting over time
  vec3 col1 = mix(green, teal, colorShift) * c1;
  vec3 col2 = mix(teal, purple, colorShift) * c2;
  vec3 col3 = mix(purple, pink, 1.0 - colorShift) * c3;
  vec3 col4 = mix(green, purple, sin(uPhaseMid * 0.08) * 0.5 + 0.5) * c4;

  vec3 aurora = col1 + col2 + col3 + col4;

  // Height-dependent coloring: green at bottom, purple at top
  float heightMix = smoothstep(0.1, 0.8, uv.y);
  aurora = mix(aurora, aurora * mix(vec3(1.0), vec3(0.7, 0.5, 1.2), heightMix), 0.3);

  // Beat brightens everything
  aurora *= (1.0 + uBeat * 0.6);

  col += aurora;

  // Horizon glow
  float horizon = exp(-abs(uv.y + 0.3) * 5.0);
  col += vec3(0.02, 0.04, 0.03) * horizon;

  // Ground silhouette — dark treeline/mountain (1 above treeline, 0 below)
  float ground = smoothstep(-0.35, -0.25, uv.y + fbm(vec2(uv.x * 2.0, 0.0)) * 0.1);
  col *= ground;

  // Subtle vignette
  float vig = 1.0 - dot(uv * 0.2, uv * 0.2);
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
