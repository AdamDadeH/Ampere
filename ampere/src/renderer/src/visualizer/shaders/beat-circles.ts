/**
 * Beat Circles — BPM-synced radial distortion rings with wave interference.
 * Concentric pulse waves expand from center, modulated by angular distortion
 * and beat-synced timing. Procedural noise replaces texture channel.
 * @source Shadertoy (beat circles / BPM distortion)
 * @generation 6
 * @status SEED
 *
 * Audio: bass = ring expansion speed, mid = angular distortion amount,
 * treble = wave frequency, beat = direct ring pulse driver.
 * Phase-bass replaces BPM timing for continuous beat-locked motion.
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

float saturate(float a) {
    return clamp(a, 0.0, 1.0);
}

float hash(float a) {
    return fract(sin(a * 87654.321) * 54321.123);
}

float hash2d(vec2 p) {
    float h = dot(p, vec2(127.1, 311.7));
    return fract(sin(h) * 43758.5453123);
}

// Procedural noise replacement for texture lookup
float procNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2d(i);
    float b = hash2d(i + vec2(1.0, 0.0));
    float c = hash2d(i + vec2(0.0, 1.0));
    float d = hash2d(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float pulse(float a) {
    return sin(saturate(a) * 3.14159);
}

void main() {
    vec2 uv = vUV - 0.5;
    uv.x *= uResolution.x / uResolution.y;

    // Beat-driven timing from audio uniforms
    float beatH2 = fract(uPhaseBass * 0.5) * 2.0;
    float beat4 = fract(uPhaseBass * 4.0) * 0.25;
    float measure4 = floor(uPhaseBass * 2.0);
    float measure8 = floor(uPhaseBass * 4.0);

    // Wave distortion — mid controls amount
    vec2 waveUV = uv;
    float distAmt = 1.0 + uMid * 0.5;
    if (hash(measure8) >= 0.5)
        waveUV += pulse(sin(uv.y * 18.0 + uTime * 70.0)) * 0.02 * distAmt;
    else
        waveUV += pulse(sin(uv.x * 8.0 + uTime * 10.0)) * 0.005 * distAmt;

    float a = atan(uv.x, uv.y) + uTime;
    if (hash(measure4 + 0.2) > 0.5)
        waveUV -= sin(a * 1.0) * 0.5 * pulse(beatH2);
    if (hash(measure4 + 0.1) > 0.5)
        waveUV -= sin(a * 32.0) * 0.01 * pulse(beat4);

    // Ring distance — beat drives ring pulse
    float dist = pow(length(waveUV) - 0.2 - pulse(beatH2 * 8.0) * 0.02, 0.2);

    // Procedural noise instead of texture
    float noiseWave = procNoise(waveUV * (length(waveUV)) * 8.0 + uTime * 7.5973);
    noiseWave *= 1.0 - saturate(pow(length(waveUV) - beatH2, 0.3));
    dist -= noiseWave * 0.2;

    // Color from audio
    vec3 col = vec3(dist);

    // Beat adds color tint
    col += uBeat * vec3(0.08, 0.04, 0.12);

    // Bass glow
    col *= 1.0 + uBass * 0.2;

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
