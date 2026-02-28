/**
 * Chrome metaballs — 7 raymarched metaballs with perlin-driven orbits,
 * analytical gradients for normals, procedural environment reflections.
 * @source https://www.shadertoy.com/view/4dj3zV
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = metaball size pulsing, mid = environment color shift,
 * treble = reflection sharpness, beat = brightness flash.
 * Phase-bass drives orbital motion. Replaced iChannel cubemap
 * lookups with procedural gradient environment.
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
#define METABALLS 7
#define METABALLS_TRESHOLD 1.0

vec2 V;
#define rot(a) mat2(V = sin(vec2(1.57, 0) + a), -V.y, V.x)

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec4 balls[METABALLS];

float blerp(float x, float y0, float y1, float y2, float y3) {
    float a = y3 - y2 - y0 + y1;
    float b = y0 - y1 - a;
    float c = y2 - y0;
    float d = y1;
    return a * x * x * x + b * x * x + c * x + d;
}

float perlin(float x, float h) {
    float a = floor(x);
    return blerp(mod(x, 1.0),
        hash12(vec2(a-1.0, h)), hash12(vec2(a, h)),
        hash12(vec2(a+1.0, h)), hash12(vec2(a+2.0, h)));
}

float metaballs(vec3 p) {
    float value = 0.0;
    for (int i = 0; i < METABALLS; i++) {
        vec3 temp = p - balls[i].xyz;
        value += balls[i].w / dot(temp, temp);
    }
    return METABALLS_TRESHOLD - value;
}

vec3 gradient(vec3 p) {
    vec3 value = vec3(0.0);
    for (int i = 0; i < METABALLS; i++) {
        vec3 a = p - balls[i].xyz;
        float b = dot(a, a);
        value += 2.0 * balls[i].w * (a / (b * b));
    }
    return value;
}

// Procedural environment — replaces cubemap texture
vec3 envMap(vec3 dir) {
    // Gradient sky
    float y = dir.y * 0.5 + 0.5;
    vec3 sky = mix(vec3(0.1, 0.05, 0.15), vec3(0.3, 0.4, 0.7), y);

    // Mid shifts environment hue
    float midShift = uPhaseMid * 0.08;
    sky = mix(sky, vec3(0.4 + sin(midShift)*0.2, 0.2, 0.5 + cos(midShift)*0.2), 0.3);

    // Bright spots (fake lights)
    float sun = pow(max(0.0, dot(dir, normalize(vec3(1.0, 0.5, 0.3)))), 16.0);
    sky += vec3(1.0, 0.8, 0.5) * sun;

    float sun2 = pow(max(0.0, dot(dir, normalize(vec3(-0.5, -0.3, 0.8)))), 8.0);
    sky += vec3(0.3, 0.5, 1.0) * sun2 * 0.5;

    // Treble adds specular sharpness in reflections
    sky *= 1.0 + uTreble * 0.24;

    return sky;
}

void main() {
    // Bass-driven time for orbital motion
    float t = uPhaseBass * 0.15;

    // Update ball positions via perlin noise
    for (int i = 0; i < METABALLS; i++) {
        float h = float(i) * float(METABALLS);
        // Bass makes balls bigger
        float size = (float(i*i) * 0.3 + 1.0) * (1.0 + uBass * 0.24);
        float x = perlin(t * 1.412 / size, h + 1.0) * 15.0 - 7.5;
        float y = perlin(t * 1.641 / size, h + 2.0) * 15.0 - 7.5;
        float z = perlin(t * 1.293 / size, h + 3.0) * 12.0 - 6.0;
        balls[i] = vec4(x, y, z, size);
    }

    vec2 uv = vUV * 2.0 - 1.0;
    uv.y *= uResolution.y / uResolution.x;

    vec3 from = vec3(-20.0, 0.0, 0.0);
    vec3 dir = normalize(vec3(uv * 1.1, 1.0));
    dir.xz *= rot(PI * 0.5);

    // Camera rotation — phase-driven instead of mouse
    vec2 rotv = vec2(t * 0.7, sin(t * 2.0 + uPhaseMid * 0.04) * 0.2);

    mat2 rot1 = rot(rotv.x);
    mat2 rot2 = rot(-rotv.y);
    dir.xy *= rot2;
    from.xy *= rot2;
    dir.xz *= rot1;
    from.xz *= rot1;

    // Raymarch with dithering
    bool hit = false;
    float totdist = 0.0;
    totdist += metaballs(from) * hash12(vUV * uResolution);
    for (int i = 0; i < 50; i++) {
        if (hit) continue;
        vec3 p = from + totdist * dir;
        float dist = metaballs(p) * 2.0;
        totdist += max(0.05, dist);
        if (dist < 0.01) {
            hit = true;
        }
    }

    vec3 color = vec3(0.0);

    if (hit) {
        vec3 p = from + totdist * dir;
        vec3 norm = normalize(gradient(p));
        // Chrome reflection
        color = envMap(reflect(dir, norm));
        // Fresnel
        float fresnel = pow(1.0 - max(0.0, dot(-dir, norm)), 3.0);
        color = mix(color * 0.8, color * 1.5, fresnel);
    } else {
        color = envMap(dir) * 0.5;
    }

    // Beat brightness flash
    color *= 1.0 + pow(uBeat, 1.5) * 0.4;

    // Bass overall intensity
    color *= 1.0 + uBass * 0.08;

    fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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
