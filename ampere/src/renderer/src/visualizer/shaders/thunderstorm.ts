/**
 * @liminal gen1-thunderstorm
 * @generation 1
 * @parents gen0-ocean
 * @status ACTIVE
 * @mutation Ocean + volumetric storm clouds above, lightning on beat,
 *          dark storm palette, lower camera angle, choppier waves.
 *          Human direction: "children of ocean — adapt towards thundercloud"
 *
 * Storm ocean — FBM water surface (from Seascape) with raymarched
 * volumetric cloud layer above. Lightning illuminates the clouds on beat.
 * Dark greens, deep greys, electric white.
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

// --- Noise ---
float hash(vec2 p) {
  float h = dot(p, vec2(127.1, 311.7));
  return fract(sin(h) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return -1.0 + 2.0 * mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 3D noise for volumetric clouds
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.1, 0.1));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
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

// FBM for clouds — 4 octaves with rotation
float fbm(vec3 p) {
  float f = 0.0;
  float amp = 0.5;
  mat3 rot = mat3(
     0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
  );
  for (int i = 0; i < 4; i++) {
    f += amp * noise3(p);
    p = rot * p * 2.01;
    amp *= 0.5;
  }
  return f;
}

// --- Water surface (Seascape) ---
float seaOctave(vec2 uv, float choppy) {
  uv += noise(uv);
  vec2 wv = 1.0 - abs(sin(uv));
  vec2 swv = abs(cos(uv));
  wv = mix(wv, swv, wv);
  return pow(1.0 - pow(wv.x * wv.y, 0.65), choppy);
}

float map(vec3 p, int iters) {
  float seaTime = uPhaseBass * 0.8;
  float freq = 0.16;
  float amp = 0.8 + uBass * 0.3;    // choppier than original
  float choppy = 5.0 + uTreble * 3.0; // more aggressive

  vec2 uv = p.xz;
  float h = 0.0;

  mat2 octaveM = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    if (i >= iters) break;
    float d = seaOctave((uv + seaTime) * freq, choppy);
    d += seaOctave((uv - seaTime) * freq, choppy);
    h += d * amp;
    uv *= octaveM;
    freq *= 1.9;
    amp *= 0.22;
    choppy = mix(choppy, 1.0, 0.2);
  }
  return p.y - h;
}

vec3 getNormal(vec3 p, float eps) {
  vec3 n;
  n.y = map(p, 5);
  n.x = map(vec3(p.x + eps, p.y, p.z), 5) - n.y;
  n.z = map(vec3(p.x, p.y, p.z + eps), 5) - n.y;
  n.y = eps;
  return normalize(n);
}

float heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {
  float tm = 0.0;
  float tx = 200.0;
  float hx = map(ori + dir * tx, 3);
  if (hx > 0.0) { p = ori + dir * tx; return tx; }
  float hm = map(ori + dir * tm, 3);
  float tmid = 0.0;
  for (int i = 0; i < 8; i++) {
    tmid = mix(tm, tx, hm / (hm - hx));
    p = ori + dir * tmid;
    float hmid = map(p, 3);
    if (hmid < 0.0) {
      tx = tmid;
      hx = hmid;
    } else {
      tm = tmid;
      hm = hmid;
    }
  }
  return tmid;
}

// --- Lightning ---
float lightning(vec2 uv, float t) {
  // Jagged bolt shape via layered noise
  float bolt = 0.0;
  float x = uv.x + noise(vec2(t * 3.0, uv.y * 2.0)) * 0.3;
  x += noise(vec2(t * 7.0, uv.y * 8.0)) * 0.08;
  bolt = smoothstep(0.04, 0.0, abs(x)) * smoothstep(0.0, 0.3, uv.y);
  // Branches
  float bx = uv.x + noise(vec2(t * 5.0 + 10.0, uv.y * 4.0)) * 0.4;
  bolt += smoothstep(0.06, 0.0, abs(bx - 0.1)) * smoothstep(0.1, 0.4, uv.y) * 0.5;
  return bolt;
}

// --- Storm sky color ---
vec3 getStormSky(vec3 dir, float lightningFlash) {
  // Dark storm gradient
  float y = max(dir.y, 0.0);
  vec3 skyBase = mix(vec3(0.08, 0.09, 0.07), vec3(0.02, 0.03, 0.04), y);

  // Cloud layer — volumetric-ish via FBM sampled along ray
  float cloudDensity = 0.0;
  vec3 cloudLight = vec3(0.0);

  // March a few steps through the cloud layer (y = 5 to 15)
  for (int i = 0; i < 6; i++) {
    float cloudT = (5.0 + float(i) * 2.0) / max(dir.y, 0.05);
    vec3 cloudPos = dir * cloudT;
    cloudPos.xz += uPhaseMid * vec2(0.3, 0.1); // wind drift

    float density = fbm(cloudPos * 0.08 + vec3(0.0, 0.0, uPhaseBass * 0.1));
    density = smoothstep(0.3, 0.7, density);

    if (density > 0.01) {
      // Cloud lit from above (dim) + lightning flash from within
      float lit = 0.15 + lightningFlash * 1.5 * exp(-float(i) * 0.3);
      vec3 cloudCol = vec3(0.3, 0.32, 0.35) * lit;
      // Warm lightning tint
      cloudCol += vec3(0.5, 0.45, 0.6) * lightningFlash * exp(-float(i) * 0.5);

      float alpha = density * 0.25;
      cloudLight += (1.0 - cloudDensity) * cloudCol * alpha;
      cloudDensity += (1.0 - cloudDensity) * alpha;
    }
  }

  vec3 sky = skyBase * (1.0 - cloudDensity) + cloudLight;

  // Lightning bolt geometry
  if (lightningFlash > 0.1) {
    float boltVis = lightning(dir.xz / max(dir.y, 0.1) * 0.3, uTime);
    sky += vec3(0.7, 0.75, 1.0) * boltVis * lightningFlash;
  }

  return sky;
}

// --- Storm sea color ---
vec3 getStormSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist, float flash) {
  float fresnel = clamp(1.0 - dot(n, -eye), 0.0, 1.0);
  fresnel = pow(fresnel, 3.0) * 0.5;

  // Dark storm water base
  vec3 seaBase = vec3(0.0, 0.05, 0.08);
  vec3 seaWater = vec3(0.15, 0.25, 0.2);

  vec3 reflected = getStormSky(reflect(eye, n), flash);
  vec3 refracted = seaBase + seaWater * 0.15 * max(dot(n, l), 0.0);

  vec3 color = mix(refracted, reflected, fresnel);
  float atten = max(1.0 - dot(dist, dist) * 0.001, 0.0);
  color += vec3(0.05) * (p.y - 0.6) * atten * seaWater;

  // Specular from lightning
  float spec = pow(max(dot(reflect(eye, n), l), 0.0), 80.0);
  color += vec3(0.6, 0.65, 0.8) * spec * (0.3 + flash * 0.7);

  // Foam on wave peaks
  float foam = smoothstep(0.6, 1.2, p.y - 0.3) * noise(p.xz * 6.0 + uPhaseBass) * 0.3;
  color += vec3(0.4, 0.42, 0.4) * max(foam, 0.0);

  return color;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Lightning flash — triggered by beat, fast decay
  float flash = pow(uBeat, 2.0) * 1.5;

  // Camera — lower to the water than original ocean, more dramatic
  float phase = uPhaseMid * 0.3;
  vec3 ori = vec3(0.0, 2.2, phase * 5.0);   // lower than ocean's 3.5
  vec3 ang = vec3(sin(phase * 0.2) * 0.15, sin(phase * 0.15) * 0.08 + 0.25, phase * 0.5);

  // View matrix
  vec3 dir = normalize(vec3(uv, -2.0));
  float ca = cos(ang.x), sa = sin(ang.x);
  float cb = cos(ang.y), sb = sin(ang.y);
  dir = vec3(
    dir.x * cb + dir.z * sb,
    dir.y * ca - (dir.z * cb - dir.x * sb) * sa,
    dir.y * sa + (dir.z * cb - dir.x * sb) * ca
  );

  // Light — dim, from above with slight angle. Brightens on lightning
  vec3 light = normalize(vec3(0.0, 1.0, 0.3));

  // Raymarch water
  vec3 p;
  heightMapTracing(ori, dir, p);
  vec3 dist = p - ori;
  vec3 n = getNormal(p, dot(dist, dist) * 0.001);

  // Color
  vec3 color = mix(
    getStormSky(dir, flash),
    getStormSeaColor(p, n, light, dir, dist, flash),
    pow(smoothstep(0.0, -0.02, dir.y), 0.2)
  );

  // Rain streaks — subtle vertical lines
  float rain = smoothstep(0.98, 1.0, hash(vec2(floor(uv.x * 80.0), floor(uTime * 15.0))));
  color += vec3(0.15) * rain * smoothstep(-0.5, 0.5, uv.y);

  // Overall flash illumination
  color += flash * vec3(0.06, 0.06, 0.08);

  // Desaturate slightly for storm mood
  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(color, vec3(grey), 0.2);

  fragColor = vec4(pow(color, vec3(0.7)), 1.0);
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
