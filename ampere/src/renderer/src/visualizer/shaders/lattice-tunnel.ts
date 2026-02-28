/**
 * Infinite lattice tunnel — domain-repeated rounded boxes with negative
 * space cuts, flying through at speed. Depth-based fog renders as silhouette.
 * @source (uncredited Shadertoy)
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = forward speed / tunnel scale, mid = fog color warmth,
 * treble = detail sharpness (iteration cutoff), beat = brightness pulse.
 * Phase-bass drives forward motion through the lattice.
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

float rbox(vec3 p, vec3 b, float r) {
    return length(max(abs(p) - b, 0.0)) - r;
}

float Map(vec3 p) {
    // Phase-bass drives forward flight
    p.z -= uPhaseBass * 0.4;

    p = mod(p, 2.5) - 0.5 * 2.5;

    vec3 p2 = p;

    float d1 = rbox(p2, vec3(0.25, 0.25, 2.25), 0.5);
    float d2 = rbox(p2, vec3(0.15, 0.15, 1.25), 0.5);
    d1 = max(-d2, d1);

    p.x += 0.3;
    p.z += 0.5;
    d2 = rbox(p, vec3(0.01, 0.5, 0.01), 0.02);

    p.x -= 0.65;
    p.z -= 0.8;
    float d3 = rbox(p, vec3(0.01, 0.5, 0.01), 0.02);
    d1 = -log(exp(-6.0 * d1) + exp(-6.0 * min(d2, d3))) / 6.0;

    d2 = rbox(p2, vec3(0.05, 5.0, 0.05), 0.4);
    float res = max(-d2, d1);

    p2 = vec3(sin(-0.3) * p2.x - p2.y, p2.y, p2.z);
    p2.z -= 0.8;
    d2 = rbox(p2, vec3(0.05, 5.0, 0.05), 0.4);

    return max(-d2, res);
}

void main() {
    vec2 p = vUV * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;

    vec3 ro = vec3(1.2);
    vec3 rd = normalize(vec3(p, -1.0));

    // Slight camera sway from mid phase
    float a = uPhaseMid * 0.02;
    float ca = cos(a), sa = sin(a);
    rd.xy = mat2(ca, sa, -sa, ca) * rd.xy;

    float h = 1.0;
    float t = 0.0;

    for (int i = 0; i < 64; i++) {
        if (h < 0.001) break;
        h = Map(rd * t + ro);
        t += h;
    }

    // Depth fog — mid shifts warmth
    float fog = t * 0.18;
    vec3 col = mix(
        vec3(fog),
        vec3(fog * 1.1, fog * 0.9, fog * 0.75),
        uMid * 0.5
    );

    // Bass brightens
    col *= 1.0 + uBass * 0.2;

    // Beat pulse
    col += pow(uBeat, 2.0) * vec3(0.06, 0.05, 0.04);

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
