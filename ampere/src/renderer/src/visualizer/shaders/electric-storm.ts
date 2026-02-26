/**
 * @liminal gen6-electric-storm
 * @generation 6
 * @evolution large-mutation
 * @parents electricNoise
 * @status ACTIVE
 * @mutation LARGE MUTATION of electric-noise. Same dual FBM core but
 *          adds: (1) lightning bolts traced along FBM ridge peaks with
 *          bright white-purple cores, (2) three layered depth planes
 *          at different Z offsets creating parallax depth, (3) vertical
 *          rain streaks via high-freq UV modulation, (4) storm cloud
 *          base layer using low-freq FBM. The electric focal point
 *          becomes a storm eye.
 *
 * The storm has a center. Lightning finds the ridges. Rain falls through.
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

#define TAU 6.2831853

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

mat2 makem2(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat2(c, -s, s, c);
}

// Ridged turbulent FBM
float fbm(vec2 p) {
  float z = 2.0;
  float rz = 0.0;
  for (float i = 1.0; i < 6.0; i++) {
    rz += abs((noise(p) - 0.5) * 2.0) / z;
    z *= 2.0;
    p *= 2.0;
  }
  return rz;
}

// Dual FBM domain displacement
float dualfbm(vec2 p, float t, float displaceAmt, float rotSpeed) {
  vec2 p2 = p * 0.7;
  vec2 basis = vec2(
    fbm(p2 - t * 1.6),
    fbm(p2 + t * 1.7)
  );
  basis = (basis - 0.5) * displaceAmt;
  p += basis;
  return fbm(p * makem2(t * rotSpeed));
}

// Ring modulation for storm eye
float circ(vec2 p) {
  float r = length(p);
  r = log(sqrt(r));
  return abs(mod(r * 4.0, TAU) - 3.14159) * 3.0 + 0.2;
}

// MUTATION: Lightning bolt detection — traces along FBM ridges
float lightning(vec2 p, float t) {
  // High-frequency ridged FBM to find sharp peaks
  float z = 2.0;
  float rz = 0.0;
  vec2 lp = p * 3.0;
  for (float i = 1.0; i < 8.0; i++) {
    float n = abs((noise(lp + t * vec2(1.3, -0.7) * i * 0.1) - 0.5) * 2.0);
    // Sharp ridge: values very close to 0 become bright
    rz += exp(-n * 12.0 / z) / z;
    z *= 1.8;
    lp *= 2.2;
    lp *= makem2(0.4);
  }
  return rz;
}

// MUTATION: Rain streaks
float rain(vec2 uv, float t) {
  float r = 0.0;
  for (float i = 0.0; i < 4.0; i++) {
    vec2 ruv = uv * vec2(40.0 + i * 15.0, 1.0);
    ruv.y += t * (8.0 + i * 3.0);
    float col = hash(floor(ruv));
    float streak = smoothstep(0.98, 1.0, col) * smoothstep(0.0, 0.3, fract(ruv.y));
    r += streak * (0.3 - i * 0.05);
  }
  return r;
}

void main() {
  vec2 p = vUV - 0.5;
  p.x *= uResolution.x / uResolution.y;

  float scale = 4.0 - uBass * 1.5;
  p *= scale;

  float t = uPhaseBass * 0.12 + uPhaseMid * 0.03;
  float displaceAmt = 0.15 + uBass * 0.4;
  float rotSpeed = 0.15 + uTreble * 0.25;

  // MUTATION: Three depth layers with parallax
  vec3 col = vec3(0.0);

  for (float layer = 0.0; layer < 3.0; layer++) {
    float depth = 1.0 - layer * 0.25;
    float layerOffset = layer * 0.7;
    vec2 lp = p * depth + vec2(layerOffset, -layerOffset * 0.3);

    float rz = dualfbm(lp, t + layer * 0.5, displaceAmt, rotSpeed);

    // Storm eye ring modulation
    float ringPhase = t * 10.0 + uBeat * 3.0;
    vec2 ringP = lp / exp(mod(ringPhase, 3.14159));
    rz *= pow(abs(0.1 - circ(ringP)), 0.9);

    // Layer color — deeper layers are darker, cooler
    vec3 coolCol = vec3(0.12, 0.08, 0.35) * depth;
    vec3 hotCol = vec3(0.4, 0.05, 0.3) * depth;
    vec3 tint = mix(coolCol, hotCol, uBass);

    float hueShift = uPhaseMid * 0.15 + layer * 1.0;
    tint += vec3(
      0.06 * sin(hueShift),
      0.04 * sin(hueShift + 2.1),
      0.05 * sin(hueShift + 4.2)
    );

    vec3 layerCol = tint / rz;
    layerCol = pow(abs(layerCol), vec3(0.99));

    // Back layers are more transparent
    float layerAlpha = 1.0 - layer * 0.3;
    col += layerCol * layerAlpha * 0.45;
  }

  // MUTATION: Lightning bolts along ridges
  float bolt = lightning(p * 0.5, t * 2.0);
  // Treble makes lightning more visible
  float boltIntensity = bolt * (0.5 + uTreble * 1.5);
  // Beat triggers bright lightning strikes
  boltIntensity += bolt * pow(uBeat, 1.0) * 3.0;
  // White-purple lightning core
  vec3 boltCol = vec3(0.7, 0.5, 1.0) * boltIntensity;
  // Bright white center of bolts
  boltCol += vec3(1.0) * pow(boltIntensity, 3.0) * 0.5;
  col += boltCol;

  // MUTATION: Rain streaks
  float rainAmt = rain(vUV, uPhaseBass * 0.5);
  // Treble drives rain visibility
  col += vec3(0.3, 0.35, 0.5) * rainAmt * (0.3 + uTreble * 0.7);

  // MUTATION: Storm cloud base layer (low-freq FBM)
  float cloudBase = fbm(p * 0.3 + t * vec2(0.2, 0.1));
  vec3 cloudCol = vec3(0.05, 0.04, 0.08) * cloudBase;
  col = max(col, cloudCol);

  // Treble brightness
  col *= 1.0 + uTreble * 0.6;

  // Beat flash
  float beatFlash = pow(uBeat, 1.5);
  col += beatFlash * vec3(0.25, 0.15, 0.35);
  col *= 1.0 + beatFlash * 0.5;

  // Vignette
  vec2 vc = vUV * 2.0 - 1.0;
  float vig = 1.0 - dot(vc * 0.25, vc * 0.25);
  col *= vig;

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
