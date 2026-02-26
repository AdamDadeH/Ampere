/**
 * @liminal gen2-stormclouds
 * @generation 2
 * @parents gen0-ocean (technique), gen0-ocean (aesthetic)
 * @status ACTIVE
 * @mutation Take the FBM fluid dynamics that make ocean feel alive and
 *          apply them to volumetric cloud masses. No water surface at all.
 *          Camera inside/below a churning cloud layer. Bass drives density,
 *          treble drives turbulence detail, beat triggers internal lightning
 *          illumination. The clouds should BREATHE like the ocean waves do.
 *          Human direction: "evolving the feel towards cloud fluctuations
 *          instead of water"
 *
 * Stormclouds — volumetric FBM cloud masses with the ocean's soul.
 * You're beneath them. They churn. They glow from within on beat.
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

// --- 3D Noise ---
float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                 mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                 mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}

// FBM with rotation between octaves — the ocean's secret sauce
// Each octave rotates the domain to break axis-alignment
float fbm(vec3 p, int octaves) {
  float f = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  mat3 rot = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    f += amp * noise3(p * freq);
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return f;
}

// Cloud density at a point — this is the equivalent of seaOctave
// Bass inflates the clouds, treble sharpens the edges
float cloudDensity(vec3 p) {
  // Wind drift — phase-driven like ocean's seaTime
  vec3 wind = vec3(uPhaseBass * 0.3, 0.0, uPhaseMid * 0.15);
  p += wind;

  // Base shape — large scale structure
  float base = fbm(p * 0.15, 4);

  // Detail turbulence — treble adds fine structure
  float detail = fbm(p * 0.4 + vec3(uPhaseTreble * 0.1), 6);

  // Combine: base provides mass, detail provides texture
  float density = base * 0.7 + detail * 0.3;

  // Bass controls overall cloud thickness (like ocean's amp)
  float threshold = 0.42 - uBass * 0.08;
  density = smoothstep(threshold, threshold + 0.25, density);

  return density;
}

// Internal lightning illumination
float lightningGlow(vec3 p, float flash) {
  if (flash < 0.05) return 0.0;

  // Lightning source point — moves with time
  vec3 lp = vec3(
    sin(uTime * 1.3) * 3.0,
    2.0 + sin(uTime * 0.7) * 1.0,
    cos(uTime * 0.9) * 3.0 + uPhaseBass * 2.0
  );

  float d = length(p - lp);
  return flash * exp(-d * 0.3) * 2.0;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: below the cloud layer, looking up into them
  float drift = uPhaseMid * 0.2;
  vec3 ro = vec3(
    sin(drift * 0.7) * 2.0,
    -1.0,
    uPhaseBass * 1.5
  );

  // Look direction: mostly up, slight wander
  float lookX = sin(uPhaseTreble * 0.08) * 0.2;
  float lookZ = cos(uPhaseMid * 0.12) * 0.15;
  vec3 rd = normalize(vec3(uv.x * 0.8 + lookX, 0.6 + uv.y * 0.5, 0.4 + lookZ));

  // Lightning flash intensity — beat-driven with fast decay
  float flash = pow(uBeat, 1.5);

  // --- Raymarch through cloud volume ---
  vec3 col = vec3(0.0);
  float transmittance = 1.0;

  // Cloud layer sits between y = 0 and y = 8
  float tStart = max(0.0, (0.0 - ro.y) / max(rd.y, 0.001));
  float tEnd = (8.0 - ro.y) / max(rd.y, 0.001);

  float t = tStart;
  float stepSize = 0.35;

  for (int i = 0; i < 60; i++) {
    if (transmittance < 0.02 || t > tEnd || t > 40.0) break;

    vec3 p = ro + rd * t;

    float density = cloudDensity(p);

    if (density > 0.005) {
      // Lighting: ambient + directional from above + lightning
      float ambientLight = 0.12;

      // Light from above — sample density higher up for self-shadowing
      vec3 lightDir = vec3(0.1, 1.0, 0.0);
      float shadowSample = cloudDensity(p + lightDir * 0.8);
      float directLight = exp(-shadowSample * 2.5) * 0.6;

      // Lightning internal glow
      float lGlow = lightningGlow(p, flash);

      float totalLight = ambientLight + directLight + lGlow;

      // Cloud color — dark base, lit edges, warm lightning
      vec3 cloudCol = vec3(0.25, 0.27, 0.32) * ambientLight;
      cloudCol += vec3(0.6, 0.62, 0.7) * directLight;
      cloudCol += vec3(0.7, 0.65, 0.9) * lGlow; // purple-white lightning tint

      // Mid-frequency adds subtle warm undertone
      cloudCol += vec3(0.08, 0.04, 0.0) * uMid;

      float alpha = density * stepSize * 1.2;
      col += transmittance * cloudCol * alpha;
      transmittance *= exp(-density * stepSize * 1.5);
    }

    // Adaptive step size — smaller in dense regions
    t += stepSize * (0.5 + 0.5 * (1.0 - density));
  }

  // Background: dark sky below clouds
  vec3 skyBelow = vec3(0.02, 0.025, 0.04);
  // Horizon glow
  float horizonGlow = exp(-abs(rd.y) * 3.0) * 0.15;
  skyBelow += vec3(0.1, 0.08, 0.12) * horizonGlow;

  col += transmittance * skyBelow;

  // Overall lightning flash on the scene
  col += flash * vec3(0.04, 0.04, 0.06);

  // Slight desaturation for mood
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(grey), 0.15);

  // Tone map
  col = pow(col, vec3(0.75));

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
