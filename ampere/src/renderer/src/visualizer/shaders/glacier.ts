/**
 * @seed glacier
 * @technique Raymarched ice with subsurface scattering
 * @status SEED
 * @description Inside a glacier. Translucent blue ice walls with deep
 *              cracks. Light filters through from above, creating blue
 *              glow. Frozen textures. Bass drives deep rumble (subtle
 *              shake), mid shifts ice color, treble adds crack detail,
 *              beat sends light pulse through ice.
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

float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
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

float fbm3(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    f += amp * noise3(p);
    p = p * 2.03 + vec3(0.3);
    amp *= 0.5;
  }
  return f;
}

// Ice cave SDF
float iceSDF(vec3 p) {
  // Tunnel shape
  float tunnel = -(length(p.xy) - 2.5 - noise(p.xz * 0.3) * 0.8);

  // Ice wall irregularity
  float iceDetail = fbm3(p * 1.5) * 0.3;
  tunnel -= iceDetail;

  // Cracks — sharp ridges in the ice
  float crack = abs(sin(p.x * 3.0 + p.y * 2.0 + noise(p.xz * 2.0) * 2.0));
  crack = smoothstep(0.0, 0.1, crack);
  tunnel += (1.0 - crack) * 0.05 * (1.0 + uTreble * 0.5);

  // Floor
  float floor_ = p.y + 1.5 + noise(p.xz * 0.5) * 0.3;

  return max(tunnel, -floor_);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.005, 0.0);
  float d = iceSDF(p);
  return normalize(vec3(
    iceSDF(p + e.xyy) - d,
    iceSDF(p + e.yxy) - d,
    iceSDF(p + e.yyx) - d
  ));
}

// Subsurface scattering approximation
float sss(vec3 p, vec3 lightDir) {
  float scatter = 0.0;
  for (int i = 1; i <= 4; i++) {
    float fi = float(i);
    float d = iceSDF(p + lightDir * fi * 0.15);
    scatter += max(0.0, -d) * exp(-fi * 0.5);
  }
  return scatter;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Bass rumble: tiny camera shake
  vec2 shake = vec2(
    sin(uPhaseBass * 15.0) * uBass * 0.003,
    cos(uPhaseBass * 17.0) * uBass * 0.002
  );
  uv += shake;

  // Camera: moving through ice tunnel
  float walkZ = uPhaseBass * 1.0;
  vec3 ro = vec3(
    sin(uPhaseMid * 0.15) * 0.5,
    -0.5 + sin(uPhaseMid * 0.1) * 0.2,
    walkZ
  );
  vec3 rd = normalize(vec3(uv * 0.7, 1.0));

  // Light from above/ahead — filtered through ice
  vec3 lightDir = normalize(vec3(0.2, 0.8, 0.3));

  // Ice color palette — shifts with mid
  float iceHue = sin(uPhaseMid * 0.08) * 0.5 + 0.5;
  vec3 iceColor = mix(
    vec3(0.4, 0.65, 0.85),   // blue ice
    vec3(0.35, 0.75, 0.7),   // teal ice
    iceHue
  );

  // Raymarch
  float t = 0.0;
  bool hit = false;

  for (int i = 0; i < 80; i++) {
    vec3 p = ro + rd * t;
    float d = iceSDF(p);

    if (d < 0.003) {
      hit = true;
      break;
    }
    if (t > 20.0) break;

    t += d * 0.7;
  }

  vec3 col;

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    // Direct light
    float diff = max(dot(n, lightDir), 0.0);

    // Subsurface scattering — light through ice
    float scatter = sss(p, lightDir);
    vec3 sssCol = iceColor * scatter * 0.8;

    // Fresnel — more reflective at grazing angles
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

    // Ice surface
    col = iceColor * diff * 0.3;
    col += sssCol;
    col += iceColor * fresnel * 0.2;

    // Specular
    vec3 halfDir = normalize(lightDir - rd);
    float spec = pow(max(dot(n, halfDir), 0.0), 40.0);
    col += vec3(0.8, 0.9, 1.0) * spec * 0.3;

    // Deep ice glow — ambient
    col += iceColor * 0.05;

    // Beat: light pulse through ice
    col += uBeat * iceColor * (0.15 + scatter * 0.3);

    // Depth fog — blue haze
    float fog = 1.0 - exp(-t * 0.05);
    vec3 fogCol = iceColor * 0.08;
    col = mix(col, fogCol, fog);
  } else {
    // End of tunnel — dim blue
    col = iceColor * 0.03;
  }

  // Vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  col *= vig;

  col = pow(col, vec3(0.85));
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
