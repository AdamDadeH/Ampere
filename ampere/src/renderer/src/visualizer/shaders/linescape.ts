/**
 * Linescape — terrain rendered as horizontal slices. Hybrid multi-fractal
 * noise heightfield, slice-based raymarching against horizontal planes,
 * analytical normals, atmospheric fog, sun glow.
 * @source https://www.shadertoy.com/view/XdsSDj
 * @author XBE
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = camera altitude bob / terrain intensity, mid = light direction,
 * treble = terrain detail, beat = sun flash.
 * Phase-bass drives forward flight over the terrain.
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

// Simplex-ish noise (IQ)
vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)),
             dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
    const float K1 = 0.366025404;
    const float K2 = 0.211324865;

    vec2 i = floor(p + (p.x + p.y) * K1);
    vec2 a = p - i + (i.x + i.y) * K2;
    vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 b = a - o + K2;
    vec2 c = a - 1.0 + 2.0 * K2;

    vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
    vec3 n = h * h * h * h * vec3(dot(a, hash(i)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));

    return dot(n, vec3(70.0));
}

float hybridMultiFractal(in vec2 point) {
    float value = 1.0;
    float signal = 0.0;
    float pwHL = pow(3., -0.25);
    float pwr = pwHL;
    float weight = 0.;

    value = pwr * (noise(2.0 * point) + 0.05);
    weight = value;
    point *= 3.0;
    pwr *= pwHL;

    for (int i = 1; i < 4; i++) {
        weight = weight > 1.0 ? 1.0 : weight;
        signal = pwr * (noise(2.0 * point) + 0.05);
        value += weight * signal;
        weight *= signal;
        pwr *= pwHL;
        point *= 3.0;
    }

    return value;
}

float heightfield(in vec2 p) {
    return hybridMultiFractal(0.125 * p);
}

struct Inter {
    vec3 p;
    vec3 n;
    vec3 vd;
    float d;
    float dn;
};

void intPlane(vec3 ro, vec3 rd, vec3 p, vec3 n, inout Inter i) {
    float dpn = dot(rd, n);
    if (abs(dpn) > 0.00001) {
        float d = (dot(n, p) + dot(n, ro)) / dpn;
        if (d > 0.0) {
            vec3 ip = ro + d * rd;
            float no = heightfield(ip.xz);
            float dn = ip.y + no;
            if (dn < 0.01 && i.d < 0.0) {
                i.p = ip;
                i.n = n;
                i.d = d;
                i.dn = abs(dn);
                i.vd = -rd;
            }
        }
    }
}

vec3 raytrace(vec3 ro, vec3 rd, vec3 sky, vec3 ld) {
    Inter i;
    i.p = vec3(0.);
    i.n = vec3(0.);
    i.d = -1.0;
    i.dn = -1.0;
    i.vd = vec3(0.);

    vec3 p = vec3(0., 0., 1.25);
    p.z -= ro.z;
    vec3 n = vec3(0., 0., -1.);
    float inc = 0.125;
    for (int k = 0; k < 36; k++) {
        intPlane(ro, rd, p, n, i);
        if (i.d > 0.0) break;
        p.z += inc;
        inc += 0.01;
    }

    vec3 col;
    if (i.d > 0.0) {
        col = vec3(0.45, 0.25, 0.05) * exp(-2.0 * abs(i.dn - i.p.y))
            + vec3(i.dn < 0.1 ? smoothstep(1., 0., i.dn * 128.) : 0.);

        // Analytical normal
        float n1 = heightfield(vec2(i.p.x - 0.001, i.p.z));
        float n2 = heightfield(vec2(i.p.x + 0.001, i.p.z));
        vec3 norm = normalize(vec3(-(n2 - n1), 0.002, 0.0));
        col *= 0.1 + dot(norm, ld);

        // Atmospheric fog
        col = mix(col, sky, 1.0 - exp(-0.00125 * i.d * i.d * i.d));
    } else {
        col = sky;
    }
    return clamp(col, 0.0, 1.0);
}

void main() {
    vec2 q = vUV;
    vec2 p = -1.0 + 2.0 * q;
    p.x *= uResolution.x / uResolution.y;

    // Camera — phase-bass drives forward flight
    float t = uPhaseBass * 0.2;
    vec3 ro = vec3(0., 1.25, -1.);
    vec3 ta = vec3(0.0, 0.9, 0.0);

    // Bass bobs the camera
    ro.y += (0.25 + uBass * 0.15) * sin(t * 1.5);
    // Mid sways look-at
    ta.x += 0.25 * cos(t * 1.2 + uPhaseMid * 0.05);

    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(0.0, 1.0, 0.0);
    vec3 cu = normalize(cross(cw, cp));
    vec3 cv = normalize(cross(cu, cw));
    vec3 rd = normalize(p.x * cu + p.y * cv + 2.5 * cw);

    ro.z += t;

    // Light direction — mid phase shifts sun position
    vec3 lig = normalize(vec3(-2.0 + sin(uPhaseMid * 0.03), 2.0, 1.0));

    // Sky with sun glow — beat amplifies sun
    vec3 sky = vec3(0.86, 0.86, 0.88) - rd.y * 0.6;
    float sun = clamp(dot(rd, lig), 0.0, 1.0);
    sky += 0.5 * vec3(1.0, 0.8, 0.4) * 0.5 * pow(sun, 10.0);
    sky += pow(uBeat, 1.5) * vec3(0.2, 0.15, 0.08) * pow(sun, 4.0);
    sky *= 0.9;

    vec3 col = raytrace(ro, rd, sky, lig);

    // Vignette
    vec2 r = -1.0 + 2.0 * q;
    float vb = max(abs(r.x), abs(r.y));
    col *= 0.05 + 0.95 * (1.0 - exp(-(1.0 - vb) * 30.0));

    // Bass overall brightness
    col *= 1.0 + uBass * 0.1;

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
