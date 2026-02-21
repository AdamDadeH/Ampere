/** CRT post-processing — scanlines, barrel distortion, chromatic aberration, vignette */

export const fragmentSource = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uBeat;

// Barrel distortion for CRT curvature
vec2 barrelDistort(vec2 uv) {
  vec2 cc = uv - 0.5;
  float dist = dot(cc, cc);
  return uv + cc * dist * 0.12;
}

void main() {
  vec2 uv = barrelDistort(vUV);

  // Out-of-bounds check after distortion
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Chromatic aberration — increases with bass
  float aberration = (0.002 + uBass * 0.004) * (1.0 + uBeat * 2.0);
  vec2 offset = (uv - 0.5) * aberration;
  float r = texture(uScene, uv + offset).r;
  float g = texture(uScene, uv).g;
  float b = texture(uScene, uv - offset).b;
  vec3 col = vec3(r, g, b);

  // Scanlines
  float scanline = sin(uv.y * uResolution.y * 1.5) * 0.5 + 0.5;
  scanline = pow(scanline, 0.6);
  col *= 0.7 + scanline * 0.3;

  // Horizontal line flicker
  float flicker = sin(uTime * 8.0 + uv.y * 200.0) * 0.02;
  col += flicker;

  // Vignette
  vec2 vig = uv * (1.0 - uv);
  float vigIntensity = pow(vig.x * vig.y * 15.0, 0.4);
  col *= vigIntensity;

  // Phosphor glow — slight green tint
  col *= vec3(0.95, 1.0, 0.95);

  fragColor = vec4(col, 1.0);
}
`

export const defaultUniforms: Record<string, number> = {
  uBass: 0,
  uBeat: 0,
}
