/**
 * @seed warp-speed
 * @technique Radial volumetric streaks with depth layers
 * @status SEED
 * @description Hyperspace warp tunnel. Stars streak past as you accelerate
 *              through space. Layers of depth with parallax. Color shifts
 *              from white to blue at edges. Bass drives speed, treble adds
 *              star density, beat triggers warp flash.
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

// Star streak layer
float starLayer(vec2 uv, float speed, float density, float seed) {
  float stars = 0.0;
  float z = uPhaseBass * speed;

  // Tile space
  vec2 tileSize = vec2(0.15 / density);
  vec2 id = floor(uv / tileSize);
  vec2 f = fract(uv / tileSize);

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 cid = id + vec2(float(dx), float(dy));
      float rnd = hash(cid + seed);

      if (rnd > density) continue;

      // Star position within cell
      vec2 starPos = vec2(hash(cid * 1.1 + seed), hash(cid * 1.3 + seed + 5.0));
      vec2 d = f - vec2(float(dx), float(dy)) - starPos;

      // Streak: elongated toward center (radial)
      vec2 centerDir = normalize(uv);
      float radial = abs(dot(d * tileSize, centerDir));
      float tangential = abs(dot(d * tileSize, vec2(-centerDir.y, centerDir.x)));

      // Streak length proportional to speed and distance from center
      float streakLen = (0.01 + speed * 0.02 * (1.0 + uBass * 1.5)) * length(uv);
      float star = smoothstep(streakLen, 0.0, radial) * smoothstep(0.003, 0.0, tangential);

      // Brightness variation
      star *= (0.5 + rnd * 0.5);
      stars += star;
    }
  }

  return stars;
}

void main() {
  vec2 uv = vUV * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  // Warp center shifts slightly
  vec2 center = vec2(
    sin(uPhaseMid * 0.1) * 0.1,
    cos(uPhaseMid * 0.08) * 0.05
  );
  vec2 cuv = uv - center;

  float dist = length(cuv);
  float angle = atan(cuv.y, cuv.x);

  // Background: deep space with subtle nebula
  vec3 col = vec3(0.0);
  float bgNebula = sin(angle * 3.0 + uPhaseMid * 0.05) * 0.5 + 0.5;
  bgNebula *= smoothstep(0.8, 0.2, dist);
  col += vec3(0.02, 0.01, 0.04) * bgNebula;

  // Multiple star layers at different depths
  float speed1 = 3.0 + uBass * 4.0;
  float speed2 = 5.0 + uBass * 6.0;
  float speed3 = 8.0 + uBass * 10.0;

  float density = 0.4 + uTreble * 0.3;

  float s1 = starLayer(cuv, speed1, density * 0.5, 0.0);
  float s2 = starLayer(cuv, speed2, density * 0.7, 100.0);
  float s3 = starLayer(cuv, speed3, density, 200.0);

  // Color: closer = warmer, farther = cooler
  col += vec3(0.5, 0.6, 1.0) * s1 * 0.3;   // far: blue
  col += vec3(0.8, 0.8, 1.0) * s2 * 0.5;   // mid: white-blue
  col += vec3(1.0, 0.95, 0.9) * s3 * 0.8;  // near: white-warm

  // Radial speed lines — continuous streaks
  float lines = 0.0;
  for (int i = 0; i < 40; i++) {
    float a = float(i) / 40.0 * 6.283;
    float aDiff = abs(mod(angle - a + 3.14, 6.283) - 3.14);
    float line = smoothstep(0.015, 0.0, aDiff);
    line *= smoothstep(0.1, 0.5, dist); // fade near center
    line *= (0.2 + hash(vec2(float(i), 0.0)) * 0.8); // random brightness
    lines += line;
  }
  col += vec3(0.3, 0.35, 0.5) * lines * 0.05 * (1.0 + uBass * 0.5);

  // Center glow — warp core
  float coreGlow = exp(-dist * dist * 8.0);
  vec3 coreCol = mix(vec3(0.3, 0.4, 1.0), vec3(1.0, 0.8, 0.5), uBass * 0.5);
  col += coreCol * coreGlow * (0.2 + uBass * 0.3);

  // Beat: warp flash — bright ring expanding from center
  float ring = abs(dist - uBeat * 1.5);
  float flash = smoothstep(0.1, 0.0, ring) * uBeat;
  col += vec3(0.5, 0.6, 1.0) * flash * 0.5;

  // Overall beat brightness
  col += uBeat * vec3(0.02, 0.02, 0.04);

  // Chromatic aberration at edges
  float chromatic = dist * 0.1;
  col.r += col.r * chromatic * 0.3;
  col.b -= col.b * chromatic * 0.1;

  // Vignette — light, mostly for framing
  float vig = 1.0 - dot(uv * 0.2, uv * 0.2);
  col *= vig;

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
