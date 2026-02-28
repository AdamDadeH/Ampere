/**
 * Animated dot grid — domain-repeated disks with per-cell orbiting satellites,
 * stop-motion angular stepping, barrel distortion, radial vignette.
 * @source https://www.shadertoy.com/view/Xs2GDd
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = disk pulse size / distortion, mid = color palette shift,
 * treble = orbit speed, beat = brightness flash.
 * Phase-bass drives the angular stepping animation.
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

#define PI 3.14159265359

// Mid shifts the palette
vec3 col1() {
    float s = uPhaseMid * 0.064;
    return vec3(0.216 + sin(s)*0.08, 0.471 + sin(s+2.0)*0.08, 0.698 + sin(s+4.0)*0.08);
}
vec3 col2() {
    float s = uPhaseMid * 0.064;
    return vec3(1.0 + sin(s+1.0)*0.08, 0.329 + sin(s+3.0)*0.08, 0.298 + sin(s+5.0)*0.08);
}
vec3 col3() {
    float s = uPhaseMid * 0.064;
    return vec3(0.867 + sin(s+0.5)*0.08, 0.910 + sin(s+2.5)*0.08, 0.247 + sin(s+4.5)*0.08);
}

float disk(vec2 r, vec2 center, float radius) {
    return 1.0 - smoothstep(radius - 0.008, radius + 0.008, length(r - center));
}

void main() {
    // Bass-driven time
    float t = uPhaseBass * 0.3;

    vec2 r = (2.0 * vUV * uResolution - uResolution) / uResolution.y;

    // Barrel distortion — bass amplifies
    float distort = 0.05 + uBass * 0.024;
    r *= 1.0 + distort * sin(r.x * 5.0 + uTime) + distort * sin(r.y * 3.0 + uTime);
    r *= 1.0 + 0.2 * length(r);

    float side = 0.5;
    vec2 r2 = mod(r, side);
    vec2 r3 = r2 - side / 2.0;
    float i = floor(r.x / side) + 2.0;
    float j = floor(r.y / side) + 4.0;
    float ii = r.x / side + 2.0;
    float jj = r.y / side + 4.0;

    vec3 pix = vec3(1.0);

    float rad, disks;

    // Pulsing center disk — bass drives size
    rad = 0.15 + (0.05 + uBass * 0.024) * sin(t + ii * jj);
    disks = disk(r3, vec2(0.0), rad);
    pix = mix(pix, col2(), disks);

    // Orbiting satellite — treble drives orbit speed
    float speed = 2.0 + uTreble * 2.4;
    float tt = t * speed + 0.1 * i + 0.08 * j;
    float stopEveryAngle = PI / 2.0;
    float stopRatio = 0.7;
    float t1 = (floor(tt) + smoothstep(0.0, 1.0 - stopRatio, fract(tt))) * stopEveryAngle;

    float x = -0.07 * cos(t1 + i);
    float y = 0.055 * (sin(t1 + j) + cos(t1 + i));
    rad = 0.1 + 0.05 * sin(t + i + j);
    disks = disk(r3, vec2(x, y), rad);
    pix = mix(pix, col1(), disks);

    // Glow ring
    rad = 0.2 + 0.05 * sin(t * (1.0 + 0.01 * i));
    disks = disk(r3, vec2(0.0), rad);
    pix += 0.2 * col3() * disks * sin(t + i * j + i);

    // Vignette
    pix -= smoothstep(0.3, 5.5, length(r));

    // Beat flash
    pix *= 1.0 + pow(uBeat, 1.5) * 0.32;

    fragColor = vec4(pix, 1.0);
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
