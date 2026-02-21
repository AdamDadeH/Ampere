/**
 * Voronoi cells — classic demoscene effect.
 * Animated cell centers with smooth distance field coloring.
 * Audio drives cell motion speed, edge glow, and color evolution.
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

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Cell grid scale — mid modulates density
  float scale = 4.0 + uMid * 2.0;
  vec2 p = uv * scale;

  vec2 ip = floor(p);
  vec2 fp = fract(p);

  // Find two closest cell centers for smooth edges
  float d1 = 8.0; // closest distance
  float d2 = 8.0; // second closest
  vec2 closestId = vec2(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 cellId = ip + neighbor;
      vec2 h = hash2(cellId);

      // Animate cell centers — phase-driven orbits
      vec2 cellCenter = neighbor + 0.5 + 0.4 * sin(
        uPhaseBass * (0.5 + h * 0.5) + h * 6.28
      ) - fp;

      float dist = length(cellCenter);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        closestId = cellId;
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  // Edge detection: difference between closest and second-closest
  float edge = d2 - d1;

  // Cell color from hash — evolves with treble phase
  vec2 ch = hash2(closestId);
  float hue = ch.x + uPhaseTreble * 0.05;

  // HSV-like coloring
  vec3 cellCol = 0.5 + 0.5 * cos(6.28 * (hue + vec3(0.0, 0.33, 0.67)));

  // Darken cell interiors, bright edges
  float edgeGlow = smoothstep(0.0, 0.15 + uTreble * 0.1, edge);
  vec3 col = cellCol * (0.3 + edgeGlow * 0.7);

  // Edge highlight — white/bright glow at cell boundaries
  float edgeLine = 1.0 - smoothstep(0.0, 0.05, edge);
  col += vec3(0.8, 0.9, 1.0) * edgeLine * (0.5 + uBass * 0.5);

  // Inner glow at cell centers
  float centerGlow = exp(-d1 * 3.0) * uBass * 0.6;
  col += cellCol * centerGlow;

  // Beat pulse on edges
  col += edgeLine * uBeat * 0.4;

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
