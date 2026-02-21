/**
 * Infinite tunnel zoom — polar coordinate warp.
 * Phase-driven speed, smooth twist. atan seam fixed via abs(x) mirror.
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

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  float radius = length(uv);
  float invR = 1.0 / max(radius, 0.001);

  // Fix atan seam: compute angle from mirrored positive side
  float angle = atan(uv.y, abs(uv.x));
  // Restore sign for full [-pi, pi] without discontinuity in texture
  if (uv.x < 0.0) angle = 3.14159 - angle;

  // Phase-driven zoom — smooth, no lurching
  float depth = invR + uPhaseBass * 1.5;

  // Twist driven smoothly by treble phase
  float twist = sin(uPhaseTreble * 0.3) * uTreble * 1.5;
  float tunnelAngle = angle + twist;

  // Texture coordinates
  float tx = tunnelAngle / 3.14159;
  float ty = depth;

  // Ring pattern — frequency gently modulated by mid
  float rings = sin(ty * (6.0 + uMid * 4.0)) * 0.5 + 0.5;
  float checker = sin(tx * 8.0 + uPhaseMid * 0.3) * 0.5 + 0.5;
  float pattern = mix(rings, checker, 0.3);

  // Color palette
  vec3 col1 = vec3(0.08, 0.0, 0.2);
  vec3 col2 = vec3(0.0, 0.5, 0.9);
  vec3 col3 = vec3(0.9, 0.15, 0.4);

  vec3 col = mix(col1, col2, pattern);
  col = mix(col, col3, sin(ty * 1.5 + uPhaseMid * 0.2) * 0.5 + 0.5);

  // Depth fog
  col *= smoothstep(0.0, 0.3, radius);
  // Center glow
  col += vec3(0.2, 0.08, 0.35) * (1.0 - smoothstep(0.0, 0.15, radius));

  // Beat flash
  col += uBeat * 0.2;

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
