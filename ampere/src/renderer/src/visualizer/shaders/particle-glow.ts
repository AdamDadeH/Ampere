/**
 * Particle glow field — 150 hash-positioned particles with inverse-distance
 * glow, composited through logarithmic sine interference for moiré patterns.
 * @source https://www.shadertoy.com/view/lsXSzH
 * @author inigo quilez (iq)
 * @license CC BY-NC-SA 3.0 Unported
 * @generation 6
 * @status SEED
 *
 * Audio: bass = particle glow intensity / scale, mid = color shift,
 * treble = interference pattern detail, beat = brightness flash.
 * Phase-bass drives particle drift animation.
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

vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
}

float hash(float n) {
    return fract(sin(n) * 43758.5453);
}

float particles(in vec2 x) {
    float d = 0.0;
    for (int i = 0; i <= 150; i++) {
        vec2 particle = hash2(float(i) * vec2(0.323, 0.156));

        // Phase-bass drives particle drift
        particle += 0.05 * sin(uPhaseBass * 0.15 + 6.2831 * particle);

        // Bass makes particles glow brighter
        float w = (3.0 + uBass * 2.0) * hash(float(i) * 0.254);
        d += w / length(particle - x);
    }
    return d;
}

void main() {
    vec2 p = vUV * uResolution / uResolution.x;

    float c = particles(p);

    // Treble controls interference pattern intensity
    float interference = (0.005 + uTreble * 0.003) * c
                       + (1.0 + uTreble * 0.5) * sin(100.0 * log(c))
                       - 3.0 * 1.5;

    float s = interference;

    // Mid shifts the color palette
    float midShift = uPhaseMid * 0.1;
    vec3 col = (0.5 + 0.5 * s) * vec3(
        s * (0.95 + sin(midShift) * 0.2),
        s * (0.35 + sin(midShift + 2.0) * 0.15),
        0.25 + sin(midShift + 4.0) * 0.1
    );

    // Beat brightness flash
    col *= 1.0 + pow(uBeat, 1.5) * 0.5;

    // Bass overall warmth
    col *= 1.0 + uBass * 0.15;

    fragColor = vec4(max(col, 0.0), 1.0);
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
