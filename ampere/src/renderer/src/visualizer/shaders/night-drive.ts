/**
 * Rainy night drive — bokeh traffic lights through a rain-streaked windshield.
 * Street lamps, headlights, taillights, brake lights, blinkers, environment glow.
 * Rain drops slide down glass with sawtooth motion and trail droplets.
 * @source https://www.shadertoy.com/view/MdfBRX
 * @author Martijn Steinrucken (BigWings)
 * @license CC BY-NC-SA 3.0 Unported
 * @generation 6
 * @status SEED
 *
 * Audio: bass = camera shake / road bumps, mid = color warmth / camera sway,
 * treble = rain intensity, beat = headlight & brake light flare.
 * Phase-bass adds forward driving momentum.
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

#define S(x, y, z) smoothstep(x, y, z)
#define sat(x) clamp(x,0.,1.)

#define streetLightCol vec3(1., .7, .3)
#define headLightCol vec3(.8, .8, 1.)
#define tailLightCol vec3(1., .1, .1)
#define LANE_BIAS .5

vec3 ro, rd;

float N(float t) {
    return fract(sin(t*10234.324)*123423.23512);
}

vec3 N31(float p) {
    vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float DistLine(vec3 ro, vec3 rd, vec3 p) {
    return length(cross(p-ro, rd));
}

float Remap(float a, float b, float c, float d, float t) {
    return ((t-a)/(b-a))*(d-c)+c;
}

float BokehMask(vec3 ro, vec3 rd, vec3 p, float size, float blur) {
    float d = DistLine(ro, rd, p);
    float m = S(size, size*(1.-blur), d);
    m *= mix(.7, 1., S(.8*size, size, d));
    return m;
}

float SawTooth(float t) {
    return cos(t+cos(t))+sin(2.*t)*.2+sin(4.*t)*.02;
}

float DeltaSawTooth(float t) {
    return 0.4*cos(2.*t)+0.08*cos(4.*t) - (1.-sin(t))*sin(t+cos(t));
}

vec2 GetDrops(vec2 uv, float seed, float m) {
    float t = uTime + m*30.;
    vec2 o = vec2(0.);

    uv.y += t*.05;
    uv *= vec2(10., 2.5)*2.;
    vec2 id = floor(uv);
    vec3 n = N31(id.x + (id.y+seed)*546.3524);
    vec2 bd = fract(uv);

    bd -= .5;
    bd.y *= 4.;
    bd.x += (n.x-.5)*.6;

    t += n.z * 6.28;
    float slide = SawTooth(t);

    float ts = 1.5;
    vec2 trailPos = vec2(bd.x*ts, (fract(bd.y*ts*2.-t*2.)-.5)*.5);

    bd.y += slide*2.;

    float dropShape = bd.x*bd.x;
    dropShape *= DeltaSawTooth(t);
    bd.y += dropShape;

    float d = length(bd);

    float trailMask = S(-.2, .2, bd.y);
    trailMask *= bd.y;
    float td = length(trailPos*max(.5, trailMask));

    float mainDrop = S(.2, .1, d);
    float dropTrail = S(.1, .02, td);

    dropTrail *= trailMask;
    o = mix(bd*mainDrop, trailPos, dropTrail);

    return o;
}

void CameraSetup(vec2 uv, vec3 pos, vec3 lookat, float zoom, float m) {
    ro = pos;
    vec3 f = normalize(lookat-ro);
    vec3 r = cross(vec3(0., 1., 0.), f);
    vec3 u = cross(f, r);
    float t = uTime;

    // Rain drop distortion on windshield — treble controls intensity
    float rainIntensity = 0.5 + uTreble * 0.5;

    vec2 dropUv = uv;
    float x = (sin(t*.1)*.5+.5)*.5;
    x = -x*x;
    float s = sin(x);
    float c = cos(x);
    mat2 rot = mat2(c, -s, s, c);
    dropUv = uv*rot;
    dropUv.x += -sin(t*.1)*.5;

    vec2 offs = GetDrops(dropUv, 1., m) * rainIntensity;
    offs += GetDrops(dropUv*1.4, 10., m) * rainIntensity;
    offs += GetDrops(dropUv*2.4, 25., m) * rainIntensity;

    float ripple = sin(t+uv.y*3.1415*30.+uv.x*124.)*.5+.5;
    ripple *= .005;
    offs += vec2(ripple*ripple, ripple) * rainIntensity;

    vec3 center = ro + f*zoom;
    vec3 i = center + (uv.x-offs.x)*r + (uv.y-offs.y)*u;

    rd = normalize(i-ro);
}

vec3 HeadLights(float i, float t) {
    float z = fract(-t*2.+i);
    vec3 p = vec3(-.3, .1, z*40.);
    float d = length(p-ro);

    float size = mix(.03, .05, S(.02, .07, z))*d;
    float m = 0.;
    float blur = .1;
    m += BokehMask(ro, rd, p-vec3(.08, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p+vec3(.08, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p+vec3(.1, 0., 0.), size, blur);
    m += BokehMask(ro, rd, p-vec3(.1, 0., 0.), size, blur);

    float distFade = max(.01, pow(1.-z, 9.));

    blur = .8;
    size *= 2.5;
    float r = 0.;
    r += BokehMask(ro, rd, p+vec3(-.09, -.2, 0.), size, blur);
    r += BokehMask(ro, rd, p+vec3(.09, -.2, 0.), size, blur);
    r *= distFade*distFade;

    // Beat flares headlights
    float beatFlare = 1.0 + uBeat * 0.5;

    return headLightCol*(m+r)*distFade*beatFlare;
}

vec3 TailLights(float i, float t) {
    t = t*1.5+i;

    float id = floor(t)+i;
    vec3 n = N31(id);

    float laneId = S(LANE_BIAS, LANE_BIAS+.01, n.y);

    float ft = fract(t);
    float z = 3.-ft*3.;

    laneId *= S(.2, 1.5, z);
    float lane = mix(.6, .3, laneId);
    vec3 p = vec3(lane, .1, z);
    float d = length(p-ro);

    float size = .05*d;
    float blur = .1;
    float m = BokehMask(ro, rd, p-vec3(.08, 0., 0.), size, blur) +
              BokehMask(ro, rd, p+vec3(.08, 0., 0.), size, blur);

    float bs = n.z*3.;
    float brake = S(bs, bs+.01, z);
    brake *= S(bs+.01, bs, z-.5*n.y);

    m += (BokehMask(ro, rd, p+vec3(.1, 0., 0.), size, blur) +
          BokehMask(ro, rd, p-vec3(.1, 0., 0.), size, blur))*brake;

    float refSize = size*2.5;
    m += BokehMask(ro, rd, p+vec3(-.09, -.2, 0.), refSize, .8);
    m += BokehMask(ro, rd, p+vec3(.09, -.2, 0.), refSize, .8);
    vec3 col = tailLightCol*m*ft;

    // Beat pulses brake lights
    col *= 1.0 + uBeat * 0.8;

    float b = BokehMask(ro, rd, p+vec3(.12, 0., 0.), size, blur);
    b += BokehMask(ro, rd, p+vec3(.12, -.2, 0.), refSize, .8)*.2;

    vec3 blinker = vec3(1., .7, .2);
    blinker *= S(1.5, 1.4, z)*S(.2, .3, z);
    blinker *= sat(sin(t*200.)*100.);
    blinker *= laneId;
    col += blinker*b;

    return col;
}

vec3 StreetLights(float i, float t) {
    float side = sign(rd.x);
    float offset = max(side, 0.)*(1./16.);
    float z = fract(i-t+offset);
    vec3 p = vec3(2.*side, 2., z*60.);
    float d = length(p-ro);
    float blur = .1;
    float distFade = Remap(1., .7, .1, 1.5, 1.-pow(1.-z,6.));
    distFade *= (1.-z);
    float m = BokehMask(ro, rd, p, .05*d, blur)*distFade;

    // Mid warms street light color
    vec3 col = mix(streetLightCol, vec3(1., .85, .5), uMid * 0.3);

    return m*col;
}

vec3 EnvironmentLights(float i, float t) {
    float n = N(i+floor(t));

    float side = sign(rd.x);
    float offset = max(side, 0.)*(1./16.);
    float z = fract(i-t+offset+fract(n*234.));
    float n2 = fract(n*100.);
    vec3 p = vec3((3.+n)*side, n2*n2*n2*1., z*60.);
    float d = length(p-ro);
    float blur = .1;
    float distFade = Remap(1., .7, .1, 1.5, 1.-pow(1.-z,6.));
    float m = BokehMask(ro, rd, p, .05*d, blur);
    m *= distFade*distFade*.5;

    m *= 1.-pow(sin(z*6.28*20.*n)*.5+.5, 20.);
    vec3 randomCol = vec3(fract(n*-34.5), fract(n*4572.), fract(n*1264.));
    vec3 col = mix(tailLightCol, streetLightCol, fract(n*-65.42));
    col = mix(col, randomCol, n);
    return m*col*.2;
}

void main() {
    float t = uTime;
    vec3 col = vec3(0.);
    vec2 uv = vUV;

    uv -= .5;
    uv.x *= uResolution.x/uResolution.y;

    // Audio-driven camera sway
    float audioDrift = uPhaseMid * 0.02;

    vec3 pos = vec3(.3, .15, 0.);

    // Bass drives road bumps
    float camShake = 0.5 + uBass * 2.0;
    float bt = t * 5.;
    float h1 = N(floor(bt));
    float h2 = N(floor(bt+1.));
    float bumps = mix(h1, h2, fract(bt))*.1;
    bumps = bumps*bumps*bumps*camShake;

    pos.y += bumps;
    float lookatY = pos.y+bumps;
    vec3 lookat = vec3(0.3, lookatY, 1.);
    vec3 lookat2 = vec3(0., lookatY, .7);
    lookat = mix(lookat, lookat2, sin(t*.1 + uPhaseMid * 0.05)*.5+.5);

    uv.y += bumps*4.;
    CameraSetup(uv, pos, lookat, 2., audioDrift);

    t *= .03;
    t += audioDrift;

    // Phase-bass adds forward driving momentum
    t += uPhaseBass * 0.01;

    const float stp = 1./8.;

    for(float i=0.; i<1.; i+=stp) {
        col += StreetLights(i, t);
    }

    for(float i=0.; i<1.; i+=stp) {
        float n = N(i+floor(t));
        col += HeadLights(i+n*stp*.7, t);
    }

    for(float i=0.; i<1.; i+=stp) {
        col += EnvironmentLights(i, t);
    }

    col += TailLights(0., t);
    col += TailLights(.5, t);

    // Sky — mid shifts warmth
    vec3 skyCol = mix(vec3(.6, .5, .9), vec3(.7, .5, .7), uMid * 0.5);
    col += sat(rd.y)*skyCol;

    // Bass overall brightness
    col *= 1.0 + uBass * 0.15;

    // Beat flash
    col += pow(uBeat, 2.0) * vec3(0.08, 0.06, 0.1);

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
