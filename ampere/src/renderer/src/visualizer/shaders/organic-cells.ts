/**
 * @liminal gen5-organic-cells
 * @generation 5
 * @parents voronoi + bioluminescent + "metaballs, organic, floating"
 * @source https://www.shadertoy.com/view/MdfGDr
 * @status ACTIVE
 * @mutation Adapted from metaball field shader on Shadertoy.
 *          Domain-repeated random spheres with per-cell hash positioning
 *          and radius. Camera avoidance pushes nearby cells away.
 *          Cosine-based shrink animates cells. AO from iteration count.
 *          Depth-based exponential color absorption. Reflected environment
 *          lighting. Like floating through a field of living cells.
 *
 * You're inside the organism. The cells drift past. They avoid you.
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

#define ITERATIONS 64

float rand(vec3 r) {
  return fract(sin(dot(r.xy, vec2(1.38984 * sin(r.z), 1.13233 * cos(r.z)))) * 653758.5453);
}

vec3 camera;

float celldist(vec3 ipos, vec3 pos) {
  vec3 c = ipos + vec3(rand(ipos), rand(ipos + 0.1), rand(ipos + 0.2));
  float dist = length(c - pos);

  // Bass makes cells pulse larger
  float radius = (rand(ipos + 0.3) * 0.3 + 0.2) * (1.0 + uBass * 0.25);

  // Cosine shrink animation — cells breathe
  float shrink = 1.0 - (1.0 + cos(c.x)) * (1.0 + cos(c.y)) * (1.0 + cos(c.z)) / 8.0;

  // Camera avoidance — cells push away as you approach
  float avoid = max(0.0, 0.5 - length(c - camera));

  return dist - radius * shrink + avoid;
}

float distfunc(vec3 pos) {
  vec3 ipos = floor(pos) - 0.5;

  // Check all 8 neighboring cells
  float d1 = celldist(ipos + vec3(0.0, 0.0, 0.0), pos);
  float d2 = celldist(ipos + vec3(0.0, 0.0, 1.0), pos);
  float d3 = celldist(ipos + vec3(0.0, 1.0, 0.0), pos);
  float d4 = celldist(ipos + vec3(0.0, 1.0, 1.0), pos);
  float d5 = celldist(ipos + vec3(1.0, 0.0, 0.0), pos);
  float d6 = celldist(ipos + vec3(1.0, 0.0, 1.0), pos);
  float d7 = celldist(ipos + vec3(1.0, 1.0, 0.0), pos);
  float d8 = celldist(ipos + vec3(1.0, 1.0, 1.0), pos);

  return min(0.5, min(min(min(d1, d2), min(d3, d4)), min(min(d5, d6), min(d7, d8))));
}

vec3 calcGradient(vec3 pos) {
  const float eps = 0.001;
  float mid = distfunc(pos);
  return vec3(
    distfunc(pos + vec3(eps, 0.0, 0.0)) - mid,
    distfunc(pos + vec3(0.0, eps, 0.0)) - mid,
    distfunc(pos + vec3(0.0, 0.0, eps)) - mid
  );
}

void main() {
  vec2 coords = (2.0 * vUV - 1.0);
  coords.x *= uResolution.x / uResolution.y;

  // Audio-driven time — bass is the main drift
  float t = uPhaseBass * 0.2 + uPhaseMid * 0.05;

  vec3 ray_dir = normalize(vec3(coords, 1.0));

  // Camera drifts forward through the cell field
  float driftSpeed = 3.0;
  vec3 ray_pos = vec3(0.0, -driftSpeed * t, 0.0);
  camera = ray_pos;

  // Rotation — slow orbit driven by bass phase, treble adds wobble
  float a = t * 0.25 + uPhaseTreble * 0.02;
  float ca = cos(a), sa = sin(a);
  ray_dir = ray_dir * mat3(
    ca, 0.0, sa,
    0.0, 1.0, 0.0,
    -sa, 0.0, ca
  );

  // Raymarch
  float iter = float(ITERATIONS);
  for (int j = 0; j < ITERATIONS; j++) {
    float dist = distfunc(ray_pos);
    ray_pos += dist * ray_dir;
    if (abs(dist) < 0.001) {
      iter = float(j);
      break;
    }
  }

  vec3 normal = normalize(calcGradient(ray_pos));

  // AO from iteration count — more iterations = deeper in crevice
  float ao = 1.0 - iter / float(ITERATIONS);

  // Fresnel-like lighting
  float what = pow(max(0.0, dot(normal, -ray_dir)), 0.5);

  float light = ao * what;

  // Depth-based color absorption — mid shifts the palette
  float z = length(ray_pos.xz);
  float midShift = uPhaseMid * 0.08;

  // Color palette: exponential depth absorption with mid-driven shift
  vec3 col = exp(-vec3(
    z / 5.0 + 0.1 + sin(midShift) * 0.3,
    z / 30.0 + cos(midShift) * 0.1,
    z / 10.0 + 0.1 + sin(midShift + 2.0) * 0.2
  ));

  // Reflected environment
  vec3 reflected = reflect(ray_dir, normal);
  vec3 env = vec3(clamp(reflected.y * 4.0, 0.0, 1.0));

  vec3 result = col * light + 0.1 * env * ao;

  // Treble adds specular highlight sharpness
  float spec = pow(max(0.0, dot(reflected, vec3(0.0, 1.0, 0.0))), 8.0 + uTreble * 24.0);
  result += vec3(0.15, 0.12, 0.18) * spec * ao * uTreble;

  // Beat: brightness flash
  float beatFlash = pow(uBeat, 1.5);
  result += beatFlash * vec3(0.08, 0.06, 0.1);
  result *= 1.0 + beatFlash * 0.3;

  // Bass brightens overall
  result *= 1.0 + uBass * 0.2;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.25, vc * 0.25);
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
