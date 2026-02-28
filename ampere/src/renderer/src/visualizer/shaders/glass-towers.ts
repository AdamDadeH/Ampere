/**
 * Glass Towers — DDA grid march through rotating glass columns with
 * animated internal light beams. Each tower cell has procedural color,
 * rotation offset, and a vertical light column. Fresnel reflections,
 * neighbor bounce lighting, depth-attenuated compositing.
 * @source https://www.shadertoy.com/view/MdSXDh
 * @license Shadertoy default
 * @generation 6
 * @status SEED
 *
 * Audio: bass = light column intensity + glow, mid = color warmth shift,
 * treble = tower rotation speed, beat = glow flash pulse.
 * Phase-bass drives g_time for light animation.
 * Three texture channels replaced with procedural hash functions.
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

#define PI 3.14159
#define TWO_PI 6.28318
#define PI_OVER_TWO 1.570796
#define REALLY_SMALL_NUMBER 0.0001

float g_time = 0.0;
float g_cellsize = 1.0;

// --- Math utilities ---

vec3 fresnel(vec3 I, vec3 N, float eta) {
    float ro = (1.0 - eta) / (1.0 + eta);
    ro *= ro;
    float fterm = pow(1.0 - dot(-I, N), 5.0);
    return vec3(ro + (1.0 - ro) * fterm);
}

float sawtooth(float x) {
    float xmod = mod(x + 3.0, 4.0);
    return abs(xmod - 2.0) - 1.0;
}

float sinstep(float x) {
    return (sin(TWO_PI * x - PI) + (TWO_PI * x - PI) + PI) / TWO_PI;
}

float periodicsmoothstep(float x) {
    float mx = mod(x, 4.0);
    return smoothstep(0.0, 0.2, mx) - smoothstep(2.0, 2.2, mx);
}

// --- Procedural hash replacements for texture channels ---

float hashCell(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec3 hashColor(vec2 p) {
    float h1 = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    float h2 = fract(sin(dot(p, vec2(269.5, 183.3))) * 76543.2345);
    float h3 = fract(sin(dot(p, vec2(419.2, 371.9))) * 21345.6789);
    return vec3(h1, h2, h3);
}

vec3 hashColor2(vec2 p) {
    float h1 = fract(cos(dot(p, vec2(97.3, 223.1))) * 34567.123);
    float h2 = fract(cos(dot(p, vec2(351.7, 119.5))) * 56789.345);
    float h3 = fract(cos(dot(p, vec2(173.9, 467.3))) * 12345.678);
    return vec3(h1, h2, h3);
}

// --- Intersection ---

void intersect_tower(vec3 ro, vec3 rd, float hd,
                     out vec4 plane1r, out vec4 plane2r) {
    vec2 pn = -sign(rd.xz);
    vec2 po = vec2(hd) * pn;
    vec2 ddn = -rd.xz * pn;

    vec2 t = (pn * (ro.xz - po)) / ddn;
    vec2 ip = ro.zx + rd.zx * t;

    vec2 fw = vec2(0.05);
    vec2 amask = smoothstep(vec2(hd) + fw, vec2(hd), abs(ip));

    plane1r = vec4(amask.x, t.x, vec2(pn.x, 0.0));
    plane2r = vec4(amask.y, t.y, vec2(0.0, pn.y));
}

// --- Procedural tower properties ---

vec3 tower_lightcolor(vec2 coords) {
    // Mid shifts warmth of tower colors
    vec3 c1 = hashColor(coords * 0.1);
    vec3 c2 = hashColor2(coords * 0.1);
    vec3 mixed = mix(c1, c2, periodicsmoothstep(0.05 * g_time - 0.005 * (coords.x + coords.y) - 1.0));
    return mixed * vec3(1.0 + uMid * 0.2, 1.0, 1.0 - uMid * 0.15);
}

vec3 tower_lightpos(vec2 cell_coords, vec3 tower_color) {
    float mask = step(REALLY_SMALL_NUMBER, abs(dot(cell_coords, vec2(1.0))));
    return vec3(0.0, mod(5.0 * g_time + 200.0 * tower_color.r, 110.0) - 100.0, 0.0);
}

float tower_rotoffset(vec2 coords) {
    return hashCell(coords * 0.1 + 0.5);
}

// --- Lighting ---

vec3 neighbor_light(vec3 hp, vec3 n, vec3 neighbor_cell_coord) {
    vec3 neighbor_color = tower_lightcolor(neighbor_cell_coord.xz);
    vec3 light_pos = tower_lightpos(neighbor_cell_coord.xz, neighbor_color);
    light_pos += g_cellsize * vec3(neighbor_cell_coord.x + 0.5, 0.0, neighbor_cell_coord.z + 0.5);
    vec3 l = hp - light_pos;
    float llen = length(l);
    return neighbor_color * max(0.0, dot(-normalize(l), n)) * pow(1.0 / llen, 0.3);
}

vec3 neighbors_diffuse(vec3 hp, vec3 n, vec3 cell_coord) {
    vec3 rs = sign(n);
    vec3 bounce = vec3(0.0);
    bounce += neighbor_light(hp, n, cell_coord + vec3(0.0, 0.0, rs.z));
    bounce += neighbor_light(hp, n, cell_coord + vec3(rs.x, 0.0, rs.z));
    bounce += neighbor_light(hp, n, cell_coord + vec3(rs.x, 0.0, 0.0));

    if (abs(n.z) > abs(n.x)) {
        bounce += neighbor_light(hp, n, cell_coord + vec3(-rs.x, 0.0, rs.z));
    } else {
        bounce += neighbor_light(hp, n, cell_coord + vec3(rs.x, 0.0, -rs.z));
    }

    return bounce;
}

void shade_tower_side(vec3 rro, vec3 rrd, mat3 rrt, vec3 lcol,
                      float hd, vec3 cell_coords, vec4 pr,
                      inout vec4 scene_col) {
    if (pr.x > 0.05) {
        vec3 hp = rro + rrd * pr.y;
        hp.y = -abs(hp.y);

        vec3 lpos = tower_lightpos(cell_coords.xz, lcol);
        float fo = max(0.0, 1.0 - 0.08 * length(lpos - hp));
        fo *= fo;
        vec3 n = vec3(pr.z, 0.0, pr.w);
        vec3 r = refract(rrd, n, 0.5);
        vec3 fr = fresnel(rrd, n, 0.3);

        // glow — bass amplifies
        float glowBase = 15.0 * (1.0 - fr.r) * smoothstep(0.1, 0.0, abs(hp.y - lpos.y)) + 0.08 * fo;
        float glow = glowBase * (1.0 + uBass * 0.5);

        // ambient
        float amb = 0.05 + 0.1 * pow(smoothstep(0.0, 0.1, min(abs(hp.x), abs(hp.z))), 4.0);

        // transmissive
        float trans = 20.0 * fo * (1.0 - fr.r) * pow(max(0.0, dot(normalize(hp - lpos), -r)), 2.0);

        // diffuse
        float diff = 10.8 * fo * max(0.0, abs(dot(normalize(hp - lpos), n)));

        // depth
        vec2 pn = -sign(rrd.xz);
        vec2 ddn = rrd.xz * pn;
        vec2 po = hd * -pn;
        vec2 t = -(pn * (hp.xz - po)) / ddn;
        float depth = max(0.0, min(t.x, t.y));

        float depth_glow = 0.5 * min(3.0, 0.5 * depth);

        // neighbors bounce
        vec3 ghp = g_cellsize * vec3(cell_coords.x + 0.5, 0.0, cell_coords.z + 0.5) + rrt * hp;
        vec3 gn = rrt * n;
        vec3 neighbors = 1.5 * neighbors_diffuse(ghp, gn, cell_coords);

        float darken = exp(-0.2 * pr.y);
        float alpha = pr.x * mix(0.2, 1.0, 0.2 * depth);

        // Beat glow pulse
        float beatGlow = 1.0 + uBeat * 0.4;

        scene_col.rgb += (1.0 - scene_col.a) * alpha * darken * beatGlow *
            (neighbors + lcol * (depth_glow + trans + diff + glow + amb));

        scene_col.a += (1.0 - scene_col.a) * alpha;
    }
}

vec4 shade_cell(vec3 ray_origin, vec3 ray_direction, vec3 cell_coords) {
    vec3 lcol = tower_lightcolor(cell_coords.xz);
    // Treble speeds up rotation
    float ang = (0.5 + uTreble * 0.3) * g_time + 180.0 * tower_rotoffset(cell_coords.xz);

    float ca = cos(ang);
    float sa = sin(ang);
    mat3 rt = mat3(ca, 0.0, sa, 0.0, 1.0, 0.0, -sa, 0.0, ca);
    mat3 rrt = mat3(ca, 0.0, -sa, 0.0, 1.0, 0.0, sa, 0.0, ca);

    vec3 rro = rt * ray_origin;
    vec3 rrd = rt * ray_direction;

    float hd = 0.1;
    vec4 p1r = vec4(0.0), p2r = vec4(0.0);
    intersect_tower(rro, rrd, hd, p1r, p2r);
    vec4 result = vec4(0.0);

    shade_tower_side(rro, rrd, rrt, lcol, hd, cell_coords, p1r, result);
    shade_tower_side(rro, rrd, rrt, lcol, hd, cell_coords, p2r, result);

    return result;
}

// --- DDA march ---

float dda_march(vec3 ro, vec3 rd, float maxdist, out vec4 scene_rgba) {
    vec3 cell_coord = floor(ro / g_cellsize);
    cell_coord.y = 0.0;
    vec3 rs = sign(rd);

    vec2 deltaDist = g_cellsize / rd.xz;
    vec2 sideDist = ((cell_coord.xz - ro.xz) / g_cellsize + 0.5 + rs.xz * 0.5) * deltaDist;

    scene_rgba = vec4(0.0);

    float t = 0.0;
    vec3 pos = ro;
    vec3 cell_pos = mod(ro, g_cellsize) - 0.5 * g_cellsize;
    vec3 mm = vec3(0.0);

    for (int i = 0; i < 32; i++) {
        mm.xz = step(sideDist.xy, sideDist.yx);

        cell_coord += mm * rs * vec3(1.0, 0.0, 1.0);

        vec3 ddn = rd * -rs;
        vec3 po = 0.5 * g_cellsize * rs;
        vec3 plane_t = (rs * (cell_pos - po)) / ddn;
        float cell_extent = min(plane_t.x, plane_t.z);
        pos += cell_extent * rd;

        cell_pos = pos - g_cellsize * cell_coord - 0.5 * g_cellsize;

        vec4 cell_res = shade_cell(cell_pos, rd, cell_coord);

        t = length(pos - ro);

        scene_rgba.rgb += cell_res.rgb * cell_res.a * exp(-0.05 * t + 1.0);
        scene_rgba.a += (1.0 - scene_rgba.a) * cell_res.a;

        sideDist += mm.xz * rs.xz * deltaDist;
    }

    return t;
}

void main() {
    g_time = uPhaseBass * 0.15 + 5.0;

    vec3 camera_origin = vec3(0.0, 0.0, 0.0);

    float xang = 0.1 * g_time;
    float yang = (PI_OVER_TWO - 0.1) * sinstep(sawtooth(0.05 * g_time + 4.0));

    // Phase-mid shifts camera angle
    xang += uPhaseMid * 0.01;

    vec3 camera_points_at = 10.0 * vec3(cos(xang) * cos(yang), sin(yang), sin(xang) * cos(yang));

    float inv_aspect_ratio = uResolution.y / uResolution.x;
    vec2 image_plane_uv = vUV - 0.5;
    image_plane_uv.y *= inv_aspect_ratio;

    vec3 iu = vec3(0.0, 1.0, 0.0);
    vec3 iz = normalize(camera_points_at - camera_origin);
    vec3 ix = normalize(cross(iz, iu));
    vec3 iy = cross(ix, iz);

    vec3 ray_look_direction = normalize(image_plane_uv.x * ix + image_plane_uv.y * iy + 0.8 * iz);

    vec4 scene_rgba = vec4(0.0);
    dda_march(camera_origin, ray_look_direction, 100.0, scene_rgba);

    // Gamma correct
    scene_rgba.rgb = pow(scene_rgba.rgb, vec3(0.5));

    // Saturate
    scene_rgba.rgb = clamp(mix(vec3(dot(vec3(0.2125, 0.7154, 0.0721), scene_rgba.rgb)),
                               scene_rgba.rgb, 1.5), 0.0, 1.0);

    fragColor = vec4(scene_rgba.rgb, 1.0);
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
