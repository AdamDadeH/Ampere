/**
 * @seed crystal-cave
 * @technique Raymarched crystal SDFs with reflection
 * @status SEED
 * @description Underground crystal cave. Geometric crystal formations
 *              catch and scatter colored light. Reflective surfaces.
 *              Bass drives pulsing internal glow, mid shifts refraction
 *              colors, treble adds sparkle, beat triggers prismatic flash.
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

// Crystal prism SDF — elongated hexagonal prism
float crystalSDF(vec3 p, float height, float radius) {
  // Hexagonal cross-section
  vec3 k = vec3(-0.866, 0.5, 0.577);
  p.xz = abs(p.xz);
  float hex = dot(p.xz, k.xy);
  p.xz -= 2.0 * min(hex, 0.0) * k.xy;
  float d2 = length(p.xz - vec2(clamp(p.x, -k.z * radius, k.z * radius), radius)) - 0.01;
  float dY = abs(p.y) - height;
  return max(d2, dY);
}

// Scene: cave with crystal clusters
float sceneSDF(vec3 p) {
  // Cave shell — inverted sphere with noise
  float cave = -(length(p) - 8.0 - noise(p.xz * 0.3) * 2.0);

  // Floor
  float floor_ = p.y + 2.0 + noise(p.xz * 0.5) * 0.5;
  cave = max(cave, -floor_);

  // Crystal clusters — dense formations from floor
  float crystals = 1e5;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float angle = fi * 0.55 + uPhaseMid * 0.02;
    float radius = 1.2 + fi * 0.35;
    vec3 cPos = vec3(cos(angle) * radius, -1.5, sin(angle) * radius);

    // Random tilt
    vec3 cp = p - cPos;
    float tiltX = hash(vec2(fi, 0.0)) * 0.6 - 0.3;
    float tiltZ = hash(vec2(fi, 1.0)) * 0.6 - 0.3;
    float cTilt = cos(tiltX);
    float sTilt = sin(tiltX);
    cp.yz = mat2(cTilt, sTilt, -sTilt, cTilt) * cp.yz;
    cTilt = cos(tiltZ);
    sTilt = sin(tiltZ);
    cp.xy = mat2(cTilt, sTilt, -sTilt, cTilt) * cp.xy;

    float h = 1.2 + hash(vec2(fi, 2.0)) * 2.5;
    float r = 0.2 + hash(vec2(fi, 3.0)) * 0.2;

    // Bass makes crystals pulse in size
    r *= (1.0 + uBass * 0.15);

    crystals = min(crystals, crystalSDF(cp, h, r));

    // Two smaller crystal neighbors per cluster
    vec3 cp2 = p - cPos - vec3(0.3, 0.15, 0.2);
    crystals = min(crystals, crystalSDF(cp2, h * 0.6, r * 0.7));
    vec3 cp3 = p - cPos - vec3(-0.2, 0.1, 0.35);
    crystals = min(crystals, crystalSDF(cp3, h * 0.45, r * 0.6));
  }

  // Wall-growing crystals — horizontal formations
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float angle = fi * 1.1 + 0.3;
    vec3 cPos = vec3(cos(angle) * 5.5, 0.5 + fi * 0.4, sin(angle) * 5.5);
    vec3 cp = p - cPos;
    // Tilt outward from wall
    float wallAngle = atan(cPos.z, cPos.x);
    float cw = cos(wallAngle + 1.57);
    float sw = sin(wallAngle + 1.57);
    cp.xz = mat2(cw, sw, -sw, cw) * cp.xz;
    float tiltDown = 0.3 + hash(vec2(fi + 20.0, 0.0)) * 0.4;
    float ct = cos(tiltDown);
    float st = sin(tiltDown);
    cp.yz = mat2(ct, st, -st, ct) * cp.yz;
    float h = 0.8 + hash(vec2(fi + 20.0, 1.0)) * 1.2;
    float r = 0.12 + hash(vec2(fi + 20.0, 2.0)) * 0.1;
    crystals = min(crystals, crystalSDF(cp, h, r));
  }

  // Ceiling stalactite crystals
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float angle = fi * 0.82 + 0.5;
    float radius = 1.0 + fi * 0.55;
    vec3 cPos = vec3(cos(angle) * radius, 3.5, sin(angle) * radius);
    vec3 cp = p - cPos;
    cp.y = -cp.y; // flip for stalactite
    float tiltX = hash(vec2(fi + 10.0, 3.0)) * 0.4 - 0.2;
    float ct = cos(tiltX);
    float st = sin(tiltX);
    cp.xz = mat2(ct, st, -st, ct) * cp.xz;
    float h = 1.0 + hash(vec2(fi + 10.0, 0.0)) * 1.8;
    float r = 0.12 + hash(vec2(fi + 10.0, 1.0)) * 0.15;
    crystals = min(crystals, crystalSDF(cp, h, r));
  }

  return min(cave, crystals);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.003, 0.0);
  float d = sceneSDF(p);
  return normalize(vec3(
    sceneSDF(p + e.xyy) - d,
    sceneSDF(p + e.yxy) - d,
    sceneSDF(p + e.yyx) - d
  ));
}

// Prismatic color from angle
vec3 prismatic(float angle) {
  return vec3(
    0.5 + 0.5 * sin(angle),
    0.5 + 0.5 * sin(angle + 2.094),
    0.5 + 0.5 * sin(angle + 4.189)
  );
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Camera: slowly orbiting inside the cave
  float orbitAngle = uPhaseBass * 0.15;
  float orbitR = 2.0 + sin(uPhaseMid * 0.1) * 0.4;
  vec3 ro = vec3(
    cos(orbitAngle) * orbitR,
    0.5 + sin(uPhaseMid * 0.12) * 0.5,
    sin(orbitAngle) * orbitR
  );

  // Look toward center
  vec3 target = vec3(0.0, 0.0, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(fwd + uv.x * right * 0.7 + uv.y * up * 0.7);

  // Light source: a glowing point in the cave
  vec3 lightPos = vec3(
    sin(uPhaseMid * 0.2) * 1.0,
    1.0 + sin(uPhaseBass * 0.15) * 0.5,
    cos(uPhaseMid * 0.2) * 1.0
  );
  vec3 lightCol = prismatic(uPhaseMid * 0.1) * (4.0 + uBass * 2.0);

  // Raymarch
  float t = 0.0;
  vec3 col = vec3(0.0);
  bool hit = false;

  for (int i = 0; i < 90; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);

    if (d < 0.003) {
      hit = true;
      break;
    }
    if (t > 20.0) break;

    t += d * 0.7;
  }

  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    // Light
    vec3 toLight = lightPos - p;
    float lightDist = length(toLight);
    vec3 lDir = toLight / lightDist;
    float atten = 1.0 / (1.0 + lightDist * 0.1 + lightDist * lightDist * 0.02);

    float diff = max(dot(n, lDir), 0.0);

    // Specular — crystals are shiny
    vec3 viewDir = normalize(ro - p);
    vec3 halfDir = normalize(lDir + viewDir);
    float spec = pow(max(dot(n, halfDir), 0.0), 80.0);

    // Reflection color — prismatic based on angle
    float refAngle = dot(n, rd) * 3.14 + uPhaseMid * 0.1;
    vec3 refCol = prismatic(refAngle);

    // Crystal material vs cave rock
    float isCrystal = smoothstep(0.01, -0.01, sceneSDF(p) - (-(length(p) - 7.5)));
    vec3 rockCol = vec3(0.15, 0.12, 0.1);
    vec3 crystalCol = refCol * 0.3;

    vec3 matCol = mix(rockCol, crystalCol, isCrystal);
    float shininess = mix(0.1, 1.0, isCrystal);

    col = matCol * diff * lightCol * atten;
    col += refCol * spec * shininess * atten * (1.0 + uBeat * 2.0);

    // Self-glow: crystals emit prismatic light
    col += refCol * isCrystal * 0.12 * (1.0 + uBass * 0.5);

    // Ambient — brighter so cave isn't pitch black
    col += matCol * 0.08;
    col += vec3(0.03, 0.04, 0.06) * (1.0 - isCrystal); // cave rock ambient

    // Sparkle on crystals — treble driven
    float sparkle = pow(spec, 4.0) * (0.3 + uTreble * 0.7) * isCrystal;
    col += vec3(1.0) * sparkle * 0.5;

    // Beat: prismatic flash
    col += uBeat * refCol * isCrystal * 0.15;

    // Fog — tinted by light color
    float fog = 1.0 - exp(-t * 0.04);
    vec3 fogCol = lightCol * 0.02 + vec3(0.02, 0.02, 0.04);
    col = mix(col, fogCol, fog);
  } else {
    // Ambient cave glow
    col = lightCol * 0.01 + vec3(0.015, 0.015, 0.025);
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
