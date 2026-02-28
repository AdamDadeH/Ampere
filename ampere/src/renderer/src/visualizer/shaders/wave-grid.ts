/**
 * Oscilloscope sine wave field with grid overlay — 50 sine waves with
 * per-wave random amplitude, frequency, and phase. Grid lines underneath.
 * @source https://www.shadertoy.com/view/XdX3W7
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = wave amplitude / thickness, mid = color palette shift,
 * treble = wave count activity / shimmer, beat = brightness pulse.
 * Phase-bass drives phase animation, phase-mid shifts grid color.
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

void main() {
    vec2 fragCoord = vUV * uResolution;
    float colorSin = 0.0;
    float colorLine = 0.0;
    const float nSin = 50.0;
    const float nLine = 30.0;

    // Sin waves — bass drives amplitude, phase-bass drives animation
    for (float i = 0.0; i < nSin; i++) {
        // Bass-reactive amplitude
        float amplitude = uResolution.x * 0.5 * noise(i * 0.2454)
                        * sin(uPhaseBass * 0.3 + noise(i) * 100.0)
                        * (0.5 + uBass * 1.5);

        float offset = 0.5 * uResolution.y;
        float frequency = 0.1 * noise(i * 10.2454);

        // Phase-bass + treble drives wave phase speed
        float phase = noise(i * 10.2454) * (uPhaseBass * 0.2 + uPhaseTreble * 0.1);

        float line = offset + amplitude * sin(fragCoord.x * frequency + phase);

        // Treble sharpens the waves (thinner = more defined)
        float thickness = 0.5 + uTreble * 0.3;
        colorSin += thickness / abs(line - fragCoord.y);
    }

    // Grid overlay
    for (float i = 0.0; i < nLine; i++) {
        float lx = (i / nLine) * (uResolution.x + 10.0);
        float ly = (i / nLine) * (uResolution.y + 10.0);
        colorLine += 0.07 / abs(fragCoord.x - lx);
        colorLine += 0.07 / abs(fragCoord.y - ly);
    }

    // Wave color — mid shifts the palette
    float midShift = uPhaseMid * 0.1;
    vec3 waveCol = vec3(
        0.2654 + sin(midShift) * 0.15,
        0.4578 + sin(midShift + 2.0) * 0.15,
        0.654 + sin(midShift + 4.0) * 0.15
    );

    // Grid color — complementary shift
    vec3 gridCol = vec3(
        0.254 + cos(midShift) * 0.1,
        0.6578 + cos(midShift + 1.5) * 0.1,
        0.554 + cos(midShift + 3.0) * 0.1
    );

    vec3 c = colorSin * waveCol;
    c += colorLine * gridCol;

    // Beat brightness pulse
    c *= 1.0 + pow(uBeat, 1.5) * 0.6;

    // Bass overall intensity
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
