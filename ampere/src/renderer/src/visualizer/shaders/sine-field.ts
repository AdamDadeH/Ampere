/**
 * Cumulative sine wave field with grid — 50 sine waves that stack into
 * a single evolving flow line, each wave adding to the previous position.
 * Grid overlay underneath.
 * @source https://www.shadertoy.com/view/4sX3W7
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = wave amplitude / energy, mid = color palette shift,
 * treble = wave speed / shimmer, beat = brightness pulse.
 * Phase-bass drives wave phase animation.
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

float noise(float r) {
    return fract(sin(dot(vec2(r,-r)*0.001, vec2(24.12357, 36.789))) * 12345.123);
}

float noise2(vec2 pos) {
    return fract(sin(dot(pos*0.001, vec2(24.12357, 36.789))) * 12345.123);
}

float wave(float amplitude, float offset, float frequency, float phase, float t) {
    return offset + amplitude * sin(t * frequency + phase);
}

void main() {
    vec2 fragCoord = vUV * uResolution;
    float colorSin = 0.0;
    float colorLine = 0.0;
    const int nSini = 50;
    const int nLinei = 30;

    float nSin = float(nSini);
    float nLine = float(nLinei);

    // Bass-reactive center position
    float centerX = 0.5 * uResolution.x;
    float centerY = 0.1 * uResolution.y + uBass * 0.3 * uResolution.y;

    // Cumulative flowing line — each wave adds to the position
    float line = centerY;
    for (int ii = 0; ii < nSini; ii++) {
        float i = float(ii);
        float amplitude = centerX * noise(i * 0.2454)
                        * sin(uPhaseBass * 0.3 + noise(i) * 100.0)
                        * (0.5 + uBass * 1.5);
        float offset = centerY;
        float frequency = 0.1 * noise(i * 100.2454);
        float phase = 0.02 * i * noise(i * 10.2454) * 10.0
                    * (uPhaseBass * 0.2 + uPhaseTreble * 0.1)
                    * centerX / uResolution.x;
        line += i * 0.003 * wave(amplitude, offset, frequency, phase, fragCoord.x);
        colorSin += 0.5 / abs(line - fragCoord.y);
    }

    // Grid overlay
    for (int ii = 0; ii < nLinei; ii++) {
        float i = float(ii);
        float lx = (i / nLine) * (uResolution.x + 10.0);
        float ly = (i / nLine) * (uResolution.y + 10.0);
        colorLine += 0.07 / abs(fragCoord.x - lx);
        colorLine += 0.07 / abs(fragCoord.y - ly);
    }

    // Mid shifts color palette
    float midShift = uPhaseMid * 0.1;
    vec3 waveCol = vec3(
        0.2654 + sin(midShift) * 0.15,
        0.4578 + sin(midShift + 2.0) * 0.15,
        0.654 + sin(midShift + 4.0) * 0.15
    );
    vec3 gridCol = vec3(
        0.254 + cos(midShift) * 0.1,
        0.6578 + cos(midShift + 1.5) * 0.1,
        0.554 + cos(midShift + 3.0) * 0.1
    );

    vec3 c = colorSin * waveCol;
    c += colorLine * gridCol;

    // Beat brightness pulse
    c *= 1.0 + pow(uBeat, 1.5) * 0.6;

    // Bass intensity
    c *= 1.0 + uBass * 0.2;

    fragColor = vec4(c, 1.0);
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
