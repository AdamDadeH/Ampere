/**
 * @liminal gen5-plasma-orb
 * @generation 5
 * @parents plasma + clouds + "volumetric sphere, turbulence, energy"
 * @source https://www.shadertoy.com/view/MslGRn
 * @status ACTIVE
 * @mutation Adapted from volumetric noise sphere on Shadertoy.
 *          Ray-sphere intersection defines the volume, then slices
 *          through with 3D FBM turbulence. Sphere falloff creates
 *          bright core fading to edges. Gradient coloring shifts
 *          with radial position. Rotated FBM octaves create swirling
 *          internal structure. Like staring into a plasma ball.
 *
 * A sphere of turbulent energy. It breathes. It pulses. It knows you're watching.
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

#define SLICES 50.0

// Rotation matrix for FBM octaves
mat3 m = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64 );

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(mix(mix(hash(n +   0.0), hash(n +   1.0), f.x),
                 mix(hash(n +  57.0), hash(n +  58.0), f.x), f.y),
             mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
                 mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}

// FBM with rotated octaves — treble adds a 4th octave
float fbm(vec3 p) {
  float f = 0.0;
  f += 0.5000 * noise(p);
  p = m * p * 2.02;
  f += 0.2500 * noise(p);
  p = m * p * 2.03;
  f += 0.1250 * noise(p);
  // Treble unlocks 4th octave — adds fine turbulent detail
  if (uTreble > 0.2) {
    p = m * p * 2.01;
    f += 0.0625 * noise(p) * smoothstep(0.2, 0.6, uTreble);
    return f / 0.9375;
  }
  return f / 0.875;
}

// Color gradient — mid shifts the palette
vec3 gradient(float s) {
  // Original: green-cyan
  vec3 cool = vec3(0.0, max(1.0 - s * 2.0, 0.0), max(s > 0.5 ? 1.0 - (s - 0.5) * 5.0 : 1.0, 0.0));
  // Warm variant: orange-magenta
  vec3 warm = vec3(max(1.0 - s * 2.0, 0.0), 0.0, max(s > 0.5 ? 1.0 - (s - 0.5) * 5.0 : 1.0, 0.0));
  // Mid blends between palettes
  float midMix = sin(uPhaseMid * 0.06) * 0.5 + 0.5;
  return mix(cool, warm, midMix);
}

// Ray-sphere intersection
bool intersectSphere(vec3 origin, vec3 direction, float radius, out float tmin, out float tmax) {
  float a = dot(direction, direction);
  float b = 2.0 * dot(origin, direction);
  float c = dot(origin, origin) - radius * radius;
  float disc = b * b - 4.0 * a * c;
  tmin = tmax = 0.0;
  if (disc > 0.0) {
    float sdisc = sqrt(disc);
    float t0 = (-b - sdisc) / (2.0 * a);
    float t1 = (-b + sdisc) / (2.0 * a);
    tmax = t1;
    if (t0 >= 0.0) tmin = t0;
    return true;
  }
  return false;
}

vec2 rot(vec2 x, float y) {
  return vec2(cos(y) * x.x - sin(y) * x.y, sin(y) * x.x + cos(y) * x.y);
}

void main() {
  vec2 p = vUV * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;

  // Audio-driven time
  float t = uPhaseBass * 0.075 + uPhaseMid * 0.02;

  // Beat pulses the sphere radius
  float radius = 0.5 + pow(uBeat, 1.5) * 0.08;

  // Camera: audio-driven orbit instead of mouse
  float camDist = 1.0 - uBass * 0.15;
  vec3 oo = vec3(0.0, 0.0, camDist);
  vec3 od = normalize(vec3(p.x, p.y, -2.0));

  // Rotation driven by bass phase (slow orbit)
  float rotAngle = uPhaseBass * 0.1 + uPhaseTreble * 0.03;
  float tiltAngle = sin(uPhaseMid * 0.04) * 0.3;

  vec3 o, d;
  o.xz = rot(oo.xz, rotAngle);
  o.y = oo.y + sin(tiltAngle) * 0.2;
  d.xz = rot(od.xz, rotAngle);
  d.y = od.y;

  vec4 col = vec4(0.0);
  float tmin, tmax;

  if (intersectSphere(o, d, radius, tmin, tmax)) {
    // Bass drives turbulence amplitude — more bass = more violent
    float startAmplitude = 0.01 + uBass * 0.015;
    // Bass also drives base frequency
    float startFrequency = 1.25 + uBass * 0.5;

    float sliceCount = SLICES;

    for (float i = 0.0; i < SLICES; i += 1.0) {
      float tt = tmin + i / sliceCount;
      if (tt > tmax) break;

      vec3 curpos = o + d * tt;

      // Sphere falloff — bright core, fading edges
      float s = (radius - length(curpos)) * 2.0 / radius;
      s *= s;

      // Turbulence accumulation with FBM
      float a = startAmplitude;
      float b = startFrequency;
      float dens = 0.0;
      for (int j = 0; j < 3; j++) {
        dens += 0.5 / abs((fbm(5.0 * curpos * b + t / b) * 2.0 - 1.0) / a);
        b *= 2.0;
        a /= 2.0;
      }

      col.rgb += gradient(s) * max(dens * s, 0.0);
    }
  }

  vec3 result = col.rgb;

  // Beat: brightness flash
  float beatFlash = pow(uBeat, 1.5);
  result += beatFlash * vec3(0.15, 0.1, 0.2);
  result *= 1.0 + beatFlash * 0.3;

  // Subtle outer glow around the sphere
  float sphereDist = length(p);
  float outerGlow = 0.02 / (abs(sphereDist - radius * 2.0) + 0.05);
  vec3 glowCol = gradient(0.3) * outerGlow * 0.3;
  result += glowCol;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.2, vc * 0.2);
  result *= vig;

  fragColor = vec4(clamp(result, 0.0, 1.0), 1.0);
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
