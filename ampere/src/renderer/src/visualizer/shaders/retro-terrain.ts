/**
 * Retro wireframe terrain — horizontal slices rendered through a perspective
 * matrix with FBM noise heightfield. Scanline wireframe aesthetic with
 * exponential depth fade. Camera bobs and glides forward over the terrain.
 * @source https://www.shadertoy.com/view/XdX3W7
 * @author XBE
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = camera altitude bob / terrain glow intensity,
 * mid = background color shift, treble = wireframe line thickness,
 * beat = brightness flash. Phase-bass drives forward terrain scroll.
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

const float PI = 3.141592654;

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
    vec3 n = h * h * h * h * vec3(dot(a, hash(i + 0.0)), dot(b, hash(i + o)), dot(c, hash(i + 1.0)));

    return dot(n, vec3(70.0));
}

const mat2 m = mat2(0.80, 0.60, -0.60, 0.80);

float fbm4(in vec2 p) {
    float f = 0.0;
    f += 0.5000 * noise(p); p = m * p * 2.02;
    f += 0.2500 * noise(p); p = m * p * 2.03;
    f += 0.1250 * noise(p); p = m * p * 2.01;
    f += 0.0625 * noise(p);
    return f;
}

mat4 CreatePerspectiveMatrix(in float fov, in float aspect, in float near, in float far) {
    mat4 pm = mat4(0.0);
    float angle = (fov / 180.0) * PI;
    float f = 1.0 / tan(angle * 0.5);
    pm[0][0] = f / aspect;
    pm[1][1] = f;
    pm[2][2] = (far + near) / (near - far);
    pm[2][3] = -1.0;
    pm[3][2] = (2.0 * far * near) / (near - far);
    return pm;
}

mat4 CamControl(vec3 eye, float pitch) {
    float cosPitch = cos(pitch);
    float sinPitch = sin(pitch);
    vec3 xaxis = vec3(1.0, 0.0, 0.0);
    vec3 yaxis = vec3(0.0, cosPitch, sinPitch);
    vec3 zaxis = vec3(0.0, -sinPitch, cosPitch);
    mat4 viewMatrix = mat4(
        vec4(xaxis.x,           yaxis.x,           zaxis.x,      0.0),
        vec4(xaxis.y,           yaxis.y,           zaxis.y,      0.0),
        vec4(xaxis.z,           yaxis.z,           zaxis.z,      0.0),
        vec4(-dot(xaxis, eye), -dot(yaxis, eye), -dot(zaxis, eye), 1.0)
    );
    return viewMatrix;
}

void main() {
    vec2 uvCoord = vUV;
    vec2 p = 2.0 * uvCoord - 1.0;
    p.x *= uResolution.x / uResolution.y;

    // Phase-bass drives forward terrain motion
    float motionTime = uPhaseBass * 0.2;

    // Camera — bass drives altitude bob
    vec3 eye = vec3(0.0, 0.25 + 0.25 * cos(0.5 * motionTime) * (1.0 + uBass * 0.4), -1.0);
    float aspect = uResolution.x / uResolution.y;
    mat4 projmat = CreatePerspectiveMatrix(50.0, aspect, 0.1, 10.0);
    mat4 viewmat = CamControl(eye, -5.0 * PI / 180.0);
    mat4 vpmat = viewmat * projmat;

    vec3 col = vec3(0.0);
    vec3 acc = vec3(0.0);
    float d;

    vec4 pos = vec4(0.0);
    float lh = -uResolution.y;
    float off = 0.1 * motionTime;
    float h = 0.0;
    float z = 0.1;
    float zi = 0.05;

    // Treble-reactive wireframe thickness
    float lineScale = 192.0 * (1.0 + uTreble * 1.5);

    for (int i = 0; i < 24; i++) {
        pos = vec4(p.x, 0.5 * fbm4(0.5 * vec2(eye.x + p.x, z + off)), eye.z + z, 1.0);
        h = (vpmat * pos).y - p.y;
        if (h > lh) {
            d = abs(h);
            col = vec3(d < 0.005 ? smoothstep(1.0, 0.0, d * lineScale) : 0.0);
            col *= exp(-0.1 * float(i));
            acc += col;
            lh = h;
        }
        z += zi;
    }

    col = sqrt(clamp(acc, 0.0, 1.0));

    // Bass drives wireframe glow intensity
    col *= 1.0 + uBass * 0.3;

    // Background — mid shifts background color
    vec3 bkg = vec3(
        0.32 + uMid * 0.06,
        0.36 - uMid * 0.04,
        0.4 + uMid * 0.08
    ) + p.y * 0.1;
    col += bkg;

    // Beat flash — additive pulse
    col += vec3(0.05, 0.05, 0.06) * pow(uBeat, 2.0);

    // Vignette
    vec2 r = -1.0 + 2.0 * uvCoord;
    float vb = max(abs(r.x), abs(r.y));
    col *= 0.15 + 0.85 * (1.0 - exp(-(1.0 - vb) * 30.0));

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
