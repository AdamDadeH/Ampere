/**
 * Volumetric nebula — FBM noise fields raymarched as density volumes.
 * Technique inspired by nimitz (Protean Clouds).
 * Multiple noise octaves at decreasing weight build smooth density.
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

// 3D noise via hash
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.1, 0.1));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                 mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                 mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// FBM — 5 octaves with rotation between layers for less axis-aligned artifacts
float fbm(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat3 rot = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 5; i++) {
    f += amp * noise3(p * freq);
    p = rot * p * 2.01;
    amp *= 0.5;
    freq *= 1.0; // rotation handles frequency increase
  }
  return f;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera drift through nebula — phase-driven
  vec3 ro = vec3(0.0, 0.0, uPhaseBass * 0.6);
  vec3 rd = normalize(vec3(uv, 1.5));

  // Slight rotation from treble phase
  float a = uPhaseTreble * 0.08;
  float ca = cos(a), sa = sin(a);
  rd.xy = mat2(ca, sa, -sa, ca) * rd.xy;

  // Raymarch through volume
  vec3 col = vec3(0.0);
  float t = 0.0;
  float transmittance = 1.0;

  for (int i = 0; i < 40; i++) {
    if (transmittance < 0.01) break;

    vec3 p = ro + rd * t;

    // Density field from FBM — mid modulates turbulence
    float density = fbm(p * 0.3 + vec3(uPhaseMid * 0.1, 0.0, 0.0));
    density = smoothstep(0.35 - uBass * 0.1, 0.65, density);

    if (density > 0.001) {
      // Simple volumetric lighting — sample shifted position
      float lightDensity = fbm((p + vec3(0.5, 1.0, 0.0)) * 0.3);
      float lightAtten = exp(-lightDensity * 2.0);

      // Nebula color palette — shifts with phase
      vec3 nebulaCol = mix(
        vec3(0.3, 0.1, 0.6),   // deep purple
        vec3(0.1, 0.4, 0.8),   // blue
        sin(p.z * 0.1 + uPhaseMid * 0.2) * 0.5 + 0.5
      );
      nebulaCol = mix(nebulaCol, vec3(0.8, 0.2, 0.4), // magenta accent
        sin(p.x * 0.15 + uPhaseTreble * 0.15) * 0.5 + 0.5
      );

      // Accumulate color with extinction
      vec3 radiance = nebulaCol * lightAtten * (0.8 + uTreble * 0.4);
      float alpha = density * 0.08;
      col += transmittance * radiance * alpha;
      transmittance *= 1.0 - alpha;
    }

    t += 0.4 + t * 0.02; // adaptive step — larger steps further out
  }

  // Background: dark space with faint stars
  vec3 bg = vec3(0.01, 0.005, 0.02);
  float starField = smoothstep(0.98, 1.0, hash3(rd * 400.0));
  bg += starField * 0.5;

  col += transmittance * bg;

  // Beat glow
  col += uBeat * 0.08;

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
