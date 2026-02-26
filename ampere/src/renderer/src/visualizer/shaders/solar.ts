/**
 * @seed solar-surface
 * @technique FBM convection cells + prominence arcs
 * @status SEED
 * @description Surface of a star. Roiling convection cells of hot plasma,
 *              solar prominences arcing off the limb. Bass drives the
 *              convection intensity, treble adds granulation detail,
 *              beat triggers bright flares.
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

float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float f = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    f += amp * noise(p);
    p = rot * p * 2.03;
    amp *= 0.5;
  }
  return f;
}

// Voronoi for convection cells
vec2 voronoiCell(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 res = vec2(8.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 b = vec2(float(x), float(y));
      vec2 r = b + vec2(hash(i + b), hash(i + b + 0.5)) - f;
      float d = dot(r, r);
      if (d < res.x) {
        res.y = res.x;
        res.x = d;
      } else if (d < res.y) {
        res.y = d;
      }
    }
  }
  return sqrt(res);
}

// Solar color ramp: dark red → orange → yellow → white hot
vec3 solarColor(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.4, 0.05, 0.0);   // dark
  vec3 c1 = vec3(0.8, 0.2, 0.0);    // red-orange
  vec3 c2 = vec3(1.0, 0.6, 0.1);    // orange
  vec3 c3 = vec3(1.0, 0.9, 0.5);    // yellow
  vec3 c4 = vec3(1.0, 1.0, 0.95);   // white

  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Spherical mapping — we're looking at a star
  float r = length(uv);
  vec3 col = vec3(0.0);

  if (r < 0.95) {
    // On the solar surface
    // Map to sphere surface coordinates
    vec2 sphereUV = uv / 0.95;
    float z = sqrt(max(1.0 - dot(sphereUV, sphereUV), 0.0));

    // Rotate surface slowly
    vec2 surfaceCoord = sphereUV * 4.0;
    surfaceCoord += vec2(uPhaseBass * 0.15, uPhaseMid * 0.08);

    // Convection cells — voronoi pattern
    vec2 cells = voronoiCell(surfaceCoord * 2.5);
    float cellEdge = cells.y - cells.x;

    // Granulation from FBM
    float gran = fbm(surfaceCoord * 6.0 + vec2(uPhaseBass * 0.3, 0.0));
    gran += fbm(surfaceCoord * 12.0) * 0.3 * (1.0 + uTreble * 0.5);

    // Temperature: hotter at cell centers, cooler at edges
    float temp = 0.4 + cellEdge * 0.4 + gran * 0.3;
    temp += uBass * 0.15;

    // Sunspots — dark patches
    float spot = fbm(surfaceCoord * 1.5 + 10.0);
    spot = smoothstep(0.7, 0.75, spot);
    temp -= spot * 0.5;

    // Limb darkening — edges of sphere are darker
    float limb = pow(z, 0.4);
    temp *= limb;

    col = solarColor(temp) * (1.2 + uBass * 0.3);

    // Beat: bright flare
    col += uBeat * vec3(0.3, 0.15, 0.05) * limb;
  }
  else {
    // Corona / atmosphere around the star
    float corona = 0.95 / r;
    corona = pow(corona, 3.0);

    // Streaky corona using FBM in polar coords
    float angle = atan(uv.y, uv.x);
    float coronaNoise = fbm(vec2(angle * 3.0, r * 5.0 + uPhaseBass * 0.2));

    corona *= (0.5 + coronaNoise * 0.8);
    corona *= (1.0 + uBass * 0.5);

    col = vec3(1.0, 0.5, 0.1) * corona * 0.5;

    // Solar prominences — arcs off the limb
    float promAngle = sin(uPhaseMid * 0.05) * 3.14;
    vec2 promDir = vec2(cos(promAngle), sin(promAngle));
    float promDist = abs(dot(uv, vec2(-promDir.y, promDir.x)));
    float promR = length(uv);
    float prom = smoothstep(0.08, 0.0, promDist) *
                 smoothstep(0.95, 1.0, promR) *
                 smoothstep(1.5, 1.1, promR);
    prom *= (0.5 + fbm(vec2(angle * 5.0, uPhaseBass)) * 0.8);
    col += vec3(1.0, 0.4, 0.1) * prom * (1.0 + uBeat * 2.0);

    // Background: very dark space
    col += vec3(0.002, 0.003, 0.005) * (1.0 - corona);
  }

  // Tone map
  col = col / (1.0 + col * 0.2);
  col = pow(col, vec3(0.9));

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
