/**
 * Topologica (blue variant) — volumetric ray-marched cosmic fog filaments.
 * Procedural 3D hash noise; density from `0.1 / abs(final * final * other)`.
 * Larger scale noise (0.06125) produces vast galactic-looking structures.
 * Camera orbits slowly through the volume.
 * @source https://www.shadertoy.com/view/4djXzz
 * @author Otavio Good (variant)
 * @license CC0
 * @generation 6
 * @status SEED
 *
 * Audio: bass = density brightness / volume glow, mid = color hue shift
 * from blue toward cyan/violet, treble = noise evolution speed,
 * beat = brightness flash pulse.
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

float PI = 3.14159265;

float Density(vec3 p) {
    // Treble subtly animates the noise field
    float final0 = noise(p * 0.06125 + uPhaseTreble * 0.005);
    float other = noise(p * 0.06125 + 1234.567 + uPhaseTreble * 0.003);
    other -= 0.5;
    final0 -= 0.5;
    final0 = 0.1 / (abs(final0 * final0 * other));
    final0 += 0.5;
    return final0 * 0.0001;
}

void main() {
    // Set up camera rays for ray marching
    vec2 uv = vUV * 2.0 - 1.0;
    uv.x *= uResolution.x / uResolution.y;

    // Camera up vector
    vec3 camUp = vec3(0.0, 1.0, 0.0);

    // Camera lookat
    vec3 camLookat = vec3(0.0, 0.0, 0.0);

    // Phase-bass drives camera orbit (replaces iTime + iMouse)
    float mx = uPhaseBass * 0.15 * 0.01 + PI * 0.5;
    float my = sin(uPhaseBass * 0.15 * 0.03) * 0.2 + 0.2;
    vec3 camPos = vec3(cos(my) * cos(mx), sin(my), cos(my) * sin(mx)) * 200.2;

    // Camera setup
    vec3 camVec = normalize(camLookat - camPos);
    vec3 sideNorm = normalize(cross(camUp, camVec));
    vec3 upNorm = cross(camVec, sideNorm);
    vec3 worldFacing = camPos + camVec;
    vec3 worldPix = worldFacing + uv.x * sideNorm * (uResolution.x / uResolution.y) + uv.y * upNorm;
    vec3 relVec = normalize(worldPix - camPos);

    // Ray marching
    float t = 0.0;
    float inc = 0.02;
    float maxDepth = 70.0;
    vec3 pos = vec3(0.0);
    float density = 0.0;

    for (int i = 0; i < 37; i++) {
        if (t > maxDepth) break;
        pos = camPos + relVec * t;
        float temp = Density(pos);

        inc = 1.9 + temp * 0.05;
        density += temp * inc;
        t += inc;
    }

    // Bass drives overall density brightness
    density *= 1.0 + uBass * 0.5;

    // Color — base blue, mid shifts toward cyan/violet
    vec3 baseColor = vec3(
        0.01 + uMid * 0.08,
        0.1 + uMid * 0.12,
        1.0 - uMid * 0.1
    );
    vec3 finalColor = baseColor * density * 0.2;

    // Beat flash — additive pulse
    finalColor += vec3(0.02, 0.03, 0.06) * pow(uBeat, 2.0);

    // Gamma correction (sqrt) with clamp
    fragColor = vec4(sqrt(clamp(finalColor, 0.0, 1.0)), 1.0);
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
