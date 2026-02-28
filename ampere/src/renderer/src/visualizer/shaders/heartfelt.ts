/**
 * Rain on glass — drops sliding down a foggy windshield with trails cutting
 * through the condensation. Procedural bokeh city lights behind the glass.
 * @source https://www.shadertoy.com/view/ltffzl
 * @author Martijn Steinrucken (BigWings)
 * @license CC BY-NC-SA 3.0 Unported
 * @generation 6
 * @status SEED
 *
 * Audio: bass = rain intensity / glass fog, mid = background color shift,
 * treble = lightning flash intensity, beat = lightning strikes.
 * Adapted from Shadertoy — replaced iChannel0 texture lookup with
 * procedural bokeh background since we have no texture channels.
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

#define S(a, b, t) smoothstep(a, b, t)

vec3 N13(float p) {
    vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float N(float t) {
    return fract(sin(t*12345.564)*7658.76);
}

float Saw(float b, float t) {
    return S(0., b, t)*S(1., b, t);
}

vec2 DropLayer2(vec2 uv, float t) {
    vec2 UV = uv;

    uv.y += t*0.75;
    vec2 a = vec2(6., 1.);
    vec2 grid = a*2.;
    vec2 id = floor(uv*grid);

    float colShift = N(id.x);
    uv.y += colShift;

    id = floor(uv*grid);
    vec3 n = N13(id.x*35.2+id.y*2376.1);
    vec2 st = fract(uv*grid)-vec2(.5, 0);

    float x = n.x-.5;

    float y = UV.y*20.;
    float wiggle = sin(y+sin(y));
    x += wiggle*(.5-abs(x))*(n.z-.5);
    x *= .7;
    float ti = fract(t+n.z);
    y = (Saw(.85, ti)-.5)*.9+.5;
    vec2 p = vec2(x, y);

    float d = length((st-p)*a.yx);

    float mainDrop = S(.4, .0, d);

    float r = sqrt(S(1., y, st.y));
    float cd = abs(st.x-x);
    float trail = S(.23*r, .15*r*r, cd);
    float trailFront = S(-.02, .02, st.y-y);
    trail *= trailFront*r*r;

    y = UV.y;
    float trail2 = S(.2*r, .0, cd);
    float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
    y = fract(y*10.)+(st.y-.5);
    float dd = length(st-vec2(x, y));
    droplets = S(.3, 0., dd);
    float m = mainDrop+droplets*r*trailFront;

    return vec2(m, trail);
}

float StaticDrops(vec2 uv, float t) {
    uv *= 40.;

    vec2 id = floor(uv);
    uv = fract(uv)-.5;
    vec3 n = N13(id.x*107.45+id.y*3543.654);
    vec2 p = (n.xy-.5)*.7;
    float d = length(uv-p);

    float fade = Saw(.025, fract(t+n.z));
    float c = S(.3, 0., d)*fract(n.z*10.)*fade;
    return c;
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
    float s = StaticDrops(uv, t)*l0;
    vec2 m1 = DropLayer2(uv, t)*l1;
    vec2 m2 = DropLayer2(uv*1.85, t)*l2;

    float c = s+m1.x+m2.x;
    c = S(.3, 1., c);

    return vec2(c, max(m1.y*l0, m2.y*l1));
}

// Procedural bokeh city lights — replaces iChannel0 texture
vec3 ProceduralBackground(vec2 uv, float blur) {
    vec3 col = vec3(0.);

    // Bokeh lights at various positions — pulse with bass/beat
    for (float i = 0.; i < 20.; i++) {
        vec3 n = N13(i*73.15);
        vec2 p = (n.xy - 0.5) * vec2(1.8, 1.0);
        // Lights drift gently with phase
        p += 0.02 * vec2(sin(uPhaseMid * 0.05 + i), cos(uPhaseBass * 0.03 + i * 1.7));
        float d = length(uv - p);
        float size = 0.03 + blur * 0.02 + n.z * 0.02;
        // Beat makes lights bloom larger
        size *= 1.0 + uBeat * 0.4 * n.z;
        float m = S(size, size * 0.3, d);

        // Varied warm colors — mid shifts hue
        vec3 lightCol = mix(
            vec3(1., .7 + uMid * 0.15, .3 - uMid * 0.1),
            vec3(.8, .8, 1.),
            n.z
        );
        lightCol = mix(lightCol, vec3(1., .3, .2), step(.7, n.x));
        // Bass pulses brightness
        float brightness = (0.3 + n.z * 0.4) * (1.0 + uBass * 0.5);
        col += m * lightCol * brightness;
    }

    // Dim ambient — bass adds warmth
    col += vec3(0.02 + uBass * 0.015, 0.015, 0.025);

    // Blur simulation — soften with blur amount
    col *= 1.0 + blur * 0.5;

    return col;
}

void main() {
    vec2 uv = (vUV - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec2 UV = vUV;
    float T = uTime;

    // Drop speed responds to treble — more treble = faster drops
    float dropSpeed = 0.2 + uTreble * 0.15;
    float t = T * dropSpeed;

    // Bass controls rain amount (more bass = more rain)
    float rainAmount = 0.5 + uBass * 0.5;

    float maxBlur = mix(3., 6., rainAmount);
    float minBlur = 2.;

    // Gentle zoom drift from mid phase
    float zoom = -cos(T * 0.2 + uPhaseMid * 0.05);
    uv *= .7 + zoom * .3;
    UV = (UV - .5) * (.9 + zoom * .1) + .5;

    float staticDrops = S(-.5, 1., rainAmount) * 2.;
    float layer1 = S(.25, .75, rainAmount);
    float layer2 = S(.0, .5, rainAmount);

    vec2 c = Drops(uv, t, staticDrops, layer1, layer2);

    // Normals from drop height
    vec2 e = vec2(.001, 0.);
    float cx = Drops(uv+e, t, staticDrops, layer1, layer2).x;
    float cy = Drops(uv+e.yx, t, staticDrops, layer1, layer2).x;
    vec2 n = vec2(cx-c.x, cy-c.x);

    float focus = mix(maxBlur-c.y, minBlur, S(.1, .2, c.x));

    // Procedural background with drop distortion
    vec3 col = ProceduralBackground(UV - 0.5 + n * 0.5, focus);

    // Post processing
    float colFade = sin(t * 0.2 + uPhaseMid * 0.1) * 0.5 + 0.5;
    col *= mix(vec3(1.), vec3(.8, .9, 1.3), colFade);

    // Lightning on beat — beat directly drives flash intensity
    float lightning = uBeat * uBeat;
    col *= 1.0 + lightning * 2.5;

    // Bass pulses the focus/blur for a breathing effect
    float breathe = sin(uPhaseBass * 0.15) * 0.5 + 0.5;
    col *= 0.9 + breathe * 0.15 * uBass;

    // Vignette
    vec2 vc = UV - 0.5;
    col *= 1.0 - dot(vc, vc);

    // Bass overall warmth
    col *= 1.0 + uBass * 0.1;

    fragColor = vec4(col, 1.);
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
