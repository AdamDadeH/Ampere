/**
 * Procedural diamond-square terrain heightmap with raymarching.
 * Deterministic terrain generation using recursive subdivision with
 * cosine-hashed displacement. No textures — fully procedural normals
 * from the diamond-square algorithm itself.
 * @source Shadertoy (diamond-square terrain raymarch)
 * @generation 6
 * @status SEED
 *
 * Audio: bass = terrain scroll speed via phase, mid = light direction
 * hue shift, treble = fog clarity, beat = brightness flash.
 * iTime*0.4 replaced with uPhaseBass * 0.1 for continuous terrain motion.
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

float time;
vec3 pln;

float terrain(vec3 p) {
  float nx = floor(p.x) * 10.0 + floor(p.z) * 100.0;
  float center = 0.0;
  float scale = 2.0;
  vec4 heights = vec4(0.0, 0.0, 0.0, 0.0);

  for (int i = 0; i < 5; i += 1) {
    vec2 spxz = step(vec2(0.0), p.xz);
    float corner_height = mix(
      mix(heights.x, heights.y, spxz.x),
      mix(heights.w, heights.z, spxz.x), spxz.y
    );

    vec4 mid_heights = (heights + heights.yzwx) * 0.5;

    heights = mix(
      mix(
        vec4(heights.x, mid_heights.x, center, mid_heights.w),
        vec4(mid_heights.x, heights.y, mid_heights.y, center), spxz.x
      ),
      mix(
        vec4(mid_heights.w, center, mid_heights.z, heights.w),
        vec4(center, mid_heights.y, heights.z, mid_heights.z), spxz.x
      ), spxz.y
    );

    nx = nx * 4.0 + spxz.x + 2.0 * spxz.y;
    center = (center + corner_height) * 0.5 + cos(nx * 20.0) / scale * 30.0;
    p.xz = fract(p.xz) - vec2(0.5);
    p *= 2.0;
    scale *= 2.0;
  }

  float d0 = p.x + p.z;

  vec2 plh = mix(
    mix(heights.xw, heights.zw, step(0.0, d0)),
    mix(heights.xy, heights.zy, step(0.0, d0)),
    step(p.z, p.x)
  );

  pln = normalize(vec3(plh.x - plh.y, 2.0, (plh.x - center) + (plh.y - center)));

  if (p.x + p.z > 0.0)
    pln.xz = -pln.zx;

  if (p.x < p.z)
    pln.xz = pln.zx;

  p.y -= center;
  return dot(p, pln) / scale;
}

void main() {
  time = uPhaseBass * 0.1;

  vec2 uv = (vUV * 2.0 - 1.0);
  uv.x *= uResolution.x / uResolution.y;

  // Camera path driven by phase
  float sc = (time + sin(time * 0.2) * 4.0) * 0.8;
  vec3 camo = vec3(
    sc + cos(time * 0.2) * 0.5,
    0.7 + sin(time * 0.3) * 0.4,
    0.3 + sin(time * 0.4) * 0.8
  );
  vec3 camt = vec3(sc + cos(time * 0.04) * 1.5, -1.5, 0.0);
  vec3 camd = normalize(camt - camo);

  vec3 camu = normalize(cross(camd, vec3(0.5, 1.0, 0.0)));
  vec3 camv = normalize(cross(camu, camd));
  camu = normalize(cross(camd, camv));

  mat3 m = mat3(camu, camv, camd);

  vec3 rd = m * normalize(vec3(uv, 1.8));
  vec3 rp;

  float t = 0.0;
  for (int i = 0; i < 100; i += 1) {
    rp = camo + rd * t;
    float d = terrain(rp);
    if (d < 4e-3)
      break;
    t += d;
  }

  // Light direction shifts with uMid
  vec3 ld = normalize(vec3(
    1.0 + uMid * 0.6,
    0.6 + uMid * 0.3,
    2.0 - uMid * 0.4
  ));

  // Surface color
  vec3 surfCol = mix(
    vec3(0.1, 0.1, 0.5) * 0.4,
    vec3(1.0, 1.0, 0.8),
    pow(0.5 + 0.5 * dot(pln, ld), 0.7)
  );

  // Fog — treble controls clarity
  float fogDensity = 0.02 * (1.0 - uTreble * 0.3);
  vec3 fogCol = vec3(0.5, 0.6, 1.0);
  vec3 col = mix(fogCol, surfCol, exp(-t * fogDensity));

  // Beat flash
  col += uBeat * vec3(0.08, 0.07, 0.05);

  // Bass terrain glow
  col *= 1.0 + uBass * 0.15;

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
