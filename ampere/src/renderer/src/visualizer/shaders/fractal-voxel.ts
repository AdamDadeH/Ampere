/**
 * DDA voxel march through a Kali-style fractal field (abs(p)/mag).
 * Volumetric accumulation through fractal density with ambient occlusion.
 * @source https://www.shadertoy.com/view/ld2SDt
 * @generation 6
 * @status SEED
 *
 * Audio: bass = fractal animation (phase-driven), mid = color hue shift,
 * treble = ray step glow intensity, beat = flash pulse.
 * Adapted from Shadertoy — iTime replaced with uPhaseBass for fractal
 * evolution, camera rotation driven by uPhaseMid.
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

const int MAX_RAY_STEPS = 64;

float field(in vec3 p) {
  float strength = 15.0;
  float accum = 0.0;
  float prev = 0.0;
  float tw = 0.0;
  for (int i = 0; i < 16; ++i) {
    float mag = dot(p, p);
    p = abs(p) / mag + vec3(-0.5, -0.4, -0.8 + (-0.13 * sin(uPhaseBass * 0.15 * 0.1) - 0.4));
    float w = exp(-float(i) / 7.0);
    accum += w * exp(-strength * pow(abs(mag - prev), 2.2));
    tw += w;
    prev = mag;
  }
  return max(0.0, 5.0 * accum / tw - 0.7);
}

float getVoxel(vec3 c) {
  return field(c.yxz * 0.0035);
}

vec2 rotate2d(vec2 v, float a) {
  float sinA = sin(a);
  float cosA = cos(a);
  return vec2(v.x * cosA - v.y * sinA, v.y * cosA + v.x * sinA);
}

void main() {
  vec2 fragCoord = vUV * uResolution;
  vec2 screenPos = (fragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  vec3 cameraDir = vec3(0.0, 0.0, 1.4);
  vec3 cameraPlaneU = vec3(1.0, 0.0, 0.0);
  vec3 cameraPlaneV = vec3(0.0, 1.0, 0.0) * uResolution.y / uResolution.x;
  vec3 rayDir = cameraDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV;
  vec3 rayPos = vec3(120.0, 2.0 * sin(uPhaseBass * 0.15 / 2.7), -12.0);

  // Camera rotation driven by uPhaseMid
  float camRot = uPhaseMid * 0.02;
  rayPos.xz = rotate2d(rayPos.xz, uPhaseBass * 0.15 / 7.0 + camRot);
  rayDir.xz = rotate2d(rayDir.xz, uPhaseBass * 0.15 / 7.0 + camRot);

  vec3 mapPos = vec3(floor(rayPos));
  vec3 deltaDist = abs(vec3(length(rayDir)) / rayDir);
  vec3 rayStep = sign(rayDir);
  vec3 sideDist = (sign(rayDir) * (mapPos - rayPos) + (sign(rayDir) * 0.5) + 0.5) * deltaDist;

  vec3 mask;
  vec3 color = vec3(0.0);
  float dis = 0.08;

  // Mid-driven hue shift
  float hueShift = uMid * 0.5;

  for (int i = 0; i < MAX_RAY_STEPS; i++) {
    float val = pow(getVoxel(mapPos), 1.3);

    // Color accumulation with mid-driven hue shift
    vec3 baseCol = vec3(val, 2.0 * val * val, 2.3 * val);
    // Rotate hue via mid
    float cs = cos(hueShift);
    float sn = sin(hueShift);
    baseCol = vec3(
      baseCol.r * cs - baseCol.g * sn,
      baseCol.r * sn + baseCol.g * cs,
      baseCol.b
    );
    baseCol = max(baseCol, 0.0);

    color += sqrt(dis) * baseCol * 0.05;

    mask = step(sideDist.xyz, sideDist.yzx) * step(sideDist.xyz, sideDist.zxy);
    sideDist += mask * deltaDist;
    mapPos += mask * rayStep;

    dis += 1.0 / float(MAX_RAY_STEPS);
  }

  // Treble adds glow intensity
  color *= 1.0 + uTreble * 0.4;

  // Beat flash
  color += uBeat * vec3(0.08, 0.06, 0.1);

  // Bass intensity boost
  color *= 1.0 + uBass * 0.3;

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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
