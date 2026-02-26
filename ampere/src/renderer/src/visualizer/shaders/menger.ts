/**
 * @seed menger-halls
 * @technique Iterated Function System (IFS) raymarching
 * @status SEED
 * @description Infinite fractal architecture — Menger sponge interior.
 *              Endlessly repeating corridors and rooms at all scales.
 *              Camera drifts through. Bass modulates fold parameters,
 *              treble adds detail iterations, beat flashes lighting.
 *              Technique from "Menger Journey" family on Shadertoy.
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

// Infinitely tiled Menger sponge (Menger Journey technique)
float mengerSDF(vec3 z) {
  // Tile space infinitely — camera always inside the fractal
  z = abs(1.0 - mod(z, 2.0));

  float d = 1000.0;
  float scale = 1.0;
  vec3 offset = vec3(0.92858, 0.92858, 0.32858);

  for (int i = 0; i < 7; i++) {
    // Rotation — bass modulates slowly
    float a = uPhaseBass * 0.02 + float(i) * 0.5;
    float ca = cos(a);
    float sa = sin(a);
    z.xy = vec2(ca * z.xy.x + sa * z.xy.y, -sa * z.xy.x + ca * z.xy.y);

    // Sort axes: ensures consistent folding
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.y < z.z) z.yz = z.zy;
    if (z.x < z.y) z.xy = z.yx;

    // Scale and offset
    float s = 3.0;
    z = z * s - offset * (s - 1.0);
    scale *= s;

    if (z.z < -0.5 * offset.z * (s - 1.0))
      z.z += offset.z * (s - 1.0);

    d = min(d, length(z) * pow(s, -float(i) - 1.0));
  }
  return d - 0.001;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.002, 0.0);
  float d = mengerSDF(p);
  return normalize(vec3(
    mengerSDF(p + e.xyy) - d,
    mengerSDF(p + e.yxy) - d,
    mengerSDF(p + e.yyx) - d
  ));
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i);
    float d = mengerSDF(p + n * h);
    occ += (h - d) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: drifting slowly through the infinite fractal
  float path = uPhaseBass * 0.15;
  vec3 ro = vec3(0.5 + path, 0.5, path * 0.5);

  // Look direction with drift
  vec3 target = ro + vec3(1.0, 0.0, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 camUp = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(fwd, camUp));
  vec3 up = cross(right, fwd);

  // Non-linear perspective twist for trippy feel
  float twist = uv.y * cos(uPhaseMid * 0.05) * 0.15;
  vec3 rd = normalize(fwd + (uv.x * right + uv.y * up) * 0.9);
  rd.zy = vec2(
    rd.z * cos(twist) + rd.y * sin(twist),
    -rd.z * sin(twist) + rd.y * cos(twist)
  );

  // Raymarch
  float t = 0.0;
  int hitSteps = 0;
  bool hit = false;

  for (int i = 0; i < 100; i++) {
    vec3 p = ro + rd * t;
    float d = mengerSDF(p);

    if (d < 0.001) {
      hit = true;
      hitSteps = i;
      break;
    }
    if (t > 20.0) break;

    t += d * 0.8;
  }

  vec3 col;

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float ao = ambientOcclusion(p, n);

    // Lighting: distant warm light + cool ambient
    vec3 lightDir = normalize(vec3(0.5, 0.8, -0.3));
    float diff = max(dot(n, lightDir), 0.0);

    // Material: color by normals (Fractal Cartoon technique)
    vec3 matCol = 0.5 + 0.5 * abs(n);

    // Depth-based color variation
    float depthColor = fract(p.z * 0.1 + uPhaseMid * 0.05);
    matCol = mix(matCol, vec3(0.6, 0.4, 0.5), depthColor * 0.3);

    vec3 ambient = vec3(0.2, 0.22, 0.28) * ao;
    vec3 diffuse = vec3(1.0, 0.9, 0.8) * diff * ao;

    col = matCol * (ambient + diffuse * 0.8);

    // Beat flash — light pulse through the fractal
    col += uBeat * vec3(0.15, 0.1, 0.05) * ao;

    // Distance fog
    float fog = 1.0 - exp(-t * 0.08);
    vec3 fogCol = vec3(0.05, 0.06, 0.08);
    col = mix(col, fogCol, fog);

    // Iteration glow — edges glow faintly (step count as proxy)
    float edgeGlow = float(hitSteps) / 100.0;
    col += vec3(0.1, 0.15, 0.2) * edgeGlow * 0.3;
  } else {
    // Far void
    col = vec3(0.02, 0.025, 0.035);
  }

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  col *= vig;

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
