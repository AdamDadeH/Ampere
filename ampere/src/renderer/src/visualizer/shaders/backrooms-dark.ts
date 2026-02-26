/**
 * @liminal gen6-backrooms-dark
 * @generation 6
 * @evolution perturbation
 * @parents backrooms
 * @status ACTIVE
 * @mutation PERTURBATION of backrooms audio reactivity.
 *          Same corridor SDF and geometry. Completely rewired audio:
 *          Bass drives camera LURCH speed (sudden forward motion on kicks).
 *          Treble drives fluorescent FLICKER (rapid on/off, horror feel).
 *          Mid shifts wall color between warm yellow and sickly green.
 *          Beat triggers momentary BLACKOUT (power cut) — light drops
 *          to near-zero then snaps back. The geometry is identical to
 *          backrooms but the audio mapping creates a horror atmosphere.
 *
 * The lights are failing. Every bass hit lurches you forward.
 * You can't control your movement. The fluorescents won't stop buzzing.
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

#define FAR 200.0
#define INVFOV 0.35
#define REP 3.5
#define REP2 (REP * 0.5)

float rand2(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 co) {
  vec2 P = floor(co);
  vec2 t = fract(co);
  float l0 = mix(rand2(P - vec2(1.0, 0.0)), rand2(P), smoothstep(0.0, 1.0, t.x));
  float l1 = mix(rand2(P - vec2(1.0, 1.0)), rand2(P - vec2(0.0, 1.0)), smoothstep(0.0, 1.0, t.x));
  return mix(l1, l0, smoothstep(0.0, 1.0, t.y));
}

float map(vec3 p) {
  float cellrnd = noise(floor(p.xz / REP) - REP2);
  p.xz = mod(p.xz, REP) - REP2;

  float cl = abs(p.y - 0.5);
  float fl = abs(p.y + 0.5);
  vec3 q = abs(p * vec3(1.0, 0.1, 1.0)) - 0.55 * cellrnd;
  float bx = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  return min(bx, min(cl, fl));
}

vec4 trace(vec3 o, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < 250; i++) {
    float d = map(o);
    if (abs(d) < 0.001)
      return vec4(o, t);
    o += rd * d;
    t += d;
    if (t > FAR) break;
  }
  return vec4(o, FAR);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.02;
  return normalize(vec3(
    map(vec3(p.x + e, p.y, p.z)) - map(vec3(p.x - e, p.y, p.z)),
    map(vec3(p.x, p.y + e, p.z)) - map(vec3(p.x, p.y - e, p.z)),
    map(vec3(p.x, p.y, p.z + e)) - map(vec3(p.x, p.y, p.z - e))
  ));
}

float turb(float t) {
  return sin(1.7 * t) + 0.39 * sin(2.9 * t) + 0.19 * sin(7.9 * t) + 0.071 * sin(17.9 * t);
}

void main() {
  vec2 uv = (vUV - 0.5) * 2.0;
  uv.y *= uResolution.y / uResolution.x;

  // PERTURBATION: Bass drives slow camera lurch — creeping dread, not panic
  float baseSpeed = 0.04;
  float lurchSpeed = baseSpeed + uBass * 0.08;
  float STime = uPhaseBass * lurchSpeed;

  vec3 o = vec3(
    0.1 * turb(STime * 1.2),
    0.0 + 0.03 * abs(sin(8.0 * STime)),
    STime * -4.0 + 1.0 * turb(STime * 0.5)
  );

  float LR = -0.5 + smoothstep(0.35, 0.65, 0.5 + 0.5 * sin(STime * 2.0) * sin(STime * 0.7));
  vec3 front = normalize(vec3(
    (2.15 + 0.4 * turb(STime * 0.8)) * LR,
    0.1 * turb(STime * 1.5),
    -1.0
  ));
  vec3 right = normalize(vec3(front.z, 0.03 * turb(4.0 * STime), -front.x));
  vec3 up = cross(front, right);
  vec3 rd = normalize(front + uv.x * INVFOV * right + uv.y * INVFOV * up);

  vec4 s = trace(o, rd);
  vec3 n = calcNormal(s.xyz);
  if (dot(rd, n) > 0.0)
    n *= -1.0;

  vec3 l = o + vec3(-0.3, 0.0, -0.3);
  l.y = 0.445;

  vec3 color = vec3(0.0);
  float ldist = length(l - s.xyz);

  // PERTURBATION: Treble drives slow fluorescent flicker — uneasy, not strobing
  float flickerBase = sin(uPhaseTreble * 8.0) * sin(uPhaseTreble * 13.0);
  float flickerIntensity = uTreble * 0.4;
  float flicker = 1.0 - flickerIntensity * max(0.0, flickerBase);

  // PERTURBATION: Beat triggers brownout — lights sag, don't fully cut
  float blackout = 1.0 - pow(uBeat, 2.0) * 0.45;

  float lightPower = flicker * blackout;

  if (trace(s.xyz + 0.01 * n, normalize(l - s.xyz)).a > ldist - 0.01) {
    float aoe = 0.3;
    float ad = map(s.xyz + aoe * n);
    float ao = ad / aoe;

    if (n.y < -0.999) {
      float gran = 3.0;
      float gridX = smoothstep(0.46, 0.5, fract(gran * s.x)) * smoothstep(0.54, 0.5, fract(gran * s.x));
      float gridZ = smoothstep(0.46, 0.5, fract(gran * s.z)) * smoothstep(0.54, 0.5, fract(gran * s.z));
      float grid = clamp(gridX + gridZ, 0.0, 1.0);

      // PERTURBATION: Mid shifts color — warm yellow to sickly green
      vec3 warmCol = vec3(1.0, 0.8, 0.3);
      vec3 sickCol = vec3(0.6, 0.9, 0.25);
      vec3 tileBase = mix(warmCol, sickCol, uMid);

      vec3 tileCol = mix(25.3, 20.0, grid) * tileBase;
      color += tileCol * lightPower * max(0.0, 1.0 / pow(ldist * 15.25, 1.3));

      float gran2 = 0.2;
      float g2X = smoothstep(0.95, 0.92, fract(gran2 * s.x)) * smoothstep(0.98, 0.95, fract(gran2 * s.x));
      float g2Z = smoothstep(0.8, 0.77, fract(gran2 * s.z)) * smoothstep(0.83, 0.8, fract(gran2 * s.z));
      float grid2 = clamp(g2X + g2Z, 0.0, 1.0);
      color = mix(color, vec3(1.0), vec3(1.0 - grid2) / pow(ldist * 0.25, 1.1) * lightPower);

      color -= 0.1 * pow(1.0 - ao, 4.0);
    } else {
      // Mid shifts wall color too
      vec3 warmWall = 2.2 * vec3(1.0, 0.8, 0.3);
      vec3 sickWall = 2.2 * vec3(0.6, 0.85, 0.25);
      vec3 matCol = mix(warmWall, sickWall, uMid);

      if (n.y > 0.99) {
        vec3 carpetWarm = vec3(1.0, 0.65, 0.2);
        vec3 carpetSick = vec3(0.5, 0.6, 0.15);
        vec3 carpetCol = mix(carpetWarm, carpetSick, uMid);
        matCol = mix(0.9, 1.2, smoothstep(0.3, 0.8, noise(1.3 * s.xz) + noise(2.3 * s.xz)))
               * mix(0.5, 1.2, noise(50.0 * s.xz) / ldist)
               * carpetCol;
      }

      color += matCol * lightPower
             * max(0.0, -dot(normalize(s.xyz - l), n))
             / pow(ldist * 0.25, 1.4);

      color -= 0.1 * pow(1.0 - ao, 4.0);
    }
  }

  // During blackout, add faint red emergency glow
  float emergencyGlow = (1.0 - blackout) * 0.3;
  color += vec3(0.08, 0.01, 0.0) * emergencyGlow;

  // Fake bloom — dimmed by flicker/blackout
  float glowDist = length(s.xyz - l);
  vec3 warmCol = mix(vec3(1.0, 0.8, 0.3), vec3(0.6, 0.9, 0.25), uMid);
  color += warmCol * 0.08 * lightPower / (1.0 + glowDist * glowDist * 0.5);

  // Distance haze — slightly green-shifted by mid
  vec3 hazeCol = mix(vec3(0.06, 0.04, 0.015), vec3(0.03, 0.05, 0.01), uMid);
  float fog = 1.0 - exp(-s.a * 0.006);
  color = mix(color, hazeCol, fog);

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
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
