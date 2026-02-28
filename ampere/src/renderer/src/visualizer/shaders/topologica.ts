/**
 * Topologica (red variant) — volumetric ray-marched glowing noise lines.
 * Procedural 3D hash noise creates a density field; thin bright filaments
 * emerge from `0.1 / abs(final * other * other)`. Camera orbits the origin.
 * @source https://www.shadertoy.com/view/4djXzz
 * @author Otavio Good (variant)
 * @license CC0
 * @generation 6
 * @status SEED
 *
 * Audio: bass = density brightness / glow intensity, mid = color hue shift,
 * treble = noise detail animation, beat = brightness flash.
 * Phase-bass drives camera orbit. Procedural noise path (Hash3d).
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

const float line_strength = 0.005;

// Procedural 3D hash noise (Otavio Good)
float Hash3d(vec3 uv) {
    float f = uv.x + uv.y * 37.0 + uv.z * 521.0;
    return fract(cos(f * 3.333) * 100003.9);
}

float mixP(float f0, float f1, float a) {
    return mix(f0, f1, a * a * (3.0 - 2.0 * a));
}

const vec2 zeroOne = vec2(0.0, 1.0);

float noise(vec3 uv) {
    vec3 fr = fract(uv.xyz);
    vec3 fl = floor(uv.xyz);
    float h000 = Hash3d(fl);
    float h100 = Hash3d(fl + zeroOne.yxx);
    float h010 = Hash3d(fl + zeroOne.xyx);
    float h110 = Hash3d(fl + zeroOne.yyx);
    float h001 = Hash3d(fl + zeroOne.xxy);
    float h101 = Hash3d(fl + zeroOne.yxy);
    float h011 = Hash3d(fl + zeroOne.xyy);
    float h111 = Hash3d(fl + zeroOne.yyy);
    return mixP(
        mixP(mixP(h000, h100, fr.x), mixP(h010, h110, fr.x), fr.y),
        mixP(mixP(h001, h101, fr.x), mixP(h011, h111, fr.x), fr.y),
        fr.z);
}

float Density(vec3 p) {
    // Treble adds subtle animation to noise sampling position
    float final0 = noise(p * 0.57115 + uPhaseTreble * 0.02);
    float other = noise(p * 2.07137 + uPhaseTreble * 0.01);
    final0 -= 0.5;
    final0 = 0.1 / (abs(final0 * other * other));
    return final0 * line_strength;
}

void main() {
    // Set up camera rays for ray marching
    vec2 uv = vUV * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    // Camera up vector
    vec3 camUp = vec3(0.0, 1.0, 0.0);

    // Camera lookat
    vec3 camLookat = vec3(0.0, 0.0, 0.0);

    // Phase-bass drives camera orbit (replaces iTime)
    float mx = uPhaseBass * 0.15 * 0.002;
    float my = sin(uPhaseBass * 0.15 * 0.006) * 0.2 + 0.2;
    vec3 camPos = vec3(cos(my) * cos(mx), sin(my), cos(my) * sin(mx)) * 200.2;

    // Camera setup
    vec3 camVec = normalize(camLookat - camPos);
    vec3 sideNorm = normalize(cross(camUp, camVec));
    vec3 upNorm = cross(camVec, sideNorm);
    vec3 worldFacing = camPos + camVec;
    vec3 worldPix = worldFacing + uv.x * sideNorm * (uResolution.x / uResolution.y) + uv.y * upNorm;
    vec3 relVec = normalize(worldPix - camPos);

    // Ray marching
    float t = -5.0;
    float inc;
    float maxDepth = 70.0;
    float density = 0.0;
    float temp;

    for (int i = 0; i < 15; i++) {
        if (t > maxDepth) break;

        temp = Density(camPos + relVec * t);
        inc = 1.9 + temp * 0.05;
        density += temp * inc;

        t += inc;
    }

    // Bass drives overall density brightness
    density *= 1.0 + uBass * 0.6;

    // Color — base red/orange, mid shifts hue toward amber/magenta
    vec3 baseColor = vec3(
        0.6 + uMid * 0.15,
        0.09 + uMid * 0.08,
        0.01 + uMid * 0.12
    );
    vec3 finalColor = baseColor * density * 0.075;

    // Beat flash — additive white pulse
    finalColor += vec3(0.04, 0.03, 0.02) * pow(uBeat, 2.0);

    // Gamma correction (sqrt)
    fragColor = vec4(pow(finalColor, vec3(0.5)), 1.0);
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
