/**
 * Shader WGSL del path tracer per GPU: el mateix algorisme que `pathWorker.ts` (CPU), línia per
 * línia on es pot. Si en canvies un, canvia l'altre. Dades: `gpuScene.ts`.
 */
import { BACKDROP_GAIN, COAT_ROUGHNESS } from "./shading"

export const TRACER_WGSL = /* wgsl */ `
const PI = 3.14159265358979;
const LUMA = vec3f(0.2126, 0.7152, 0.0722);
const COAT_ROUGHNESS = ${COAT_ROUGHNESS};
const BACKDROP_GAIN = ${BACKDROP_GAIN};
const INTERNAL = 0x80000000u;

struct Params {
  cam0: vec4f, cam1: vec4f, cam2: vec4f, cam3: vec4f, // cam3.w: descentrament vertical (RenderCamera.shift)
  camInfo: vec4f,  // escala, aspecte, ortogràfica, obertura (m)
  frame: vec4f,    // focus, W, H, primera fila
  sunDir: vec4f,   // direcció, cos del radi
  sunCol: vec4f,   // color, alfa² del sol
  bg: vec4f,       // fons, de dia
  sky: vec4f,      // intensitat del cel, gir de l'HDRI (voltes), 0, relleu de la veta
  clampv: vec4f,   // màx. indirecta, màx. directa, rugositat del camí, vidre a les ombres
  run: vec4u,      // mostres, primera mostra, rebots, AOV
  mode: vec4u,     // llum del cel (0 cosinus, 1 HDRI, 2 finestres), finestres, HDRI, triangles
  offs: vec4u,     // materials, textures, bevel, finestres (vec4 a info)
  envi: vec4u,     // w, h, inici de la marginal, inici de la condicional
  seed: vec4u,     // llavor, files d'aquesta tanda, 2^reduccions de les textures
  lamp: vec4f,     // intensitat de les làmpades (0 = apagades), Σ àrea × luminància, com es veuen des de la càmera
  emit: vec4u,     // inici dels emissors (vec4 a info), quants
}

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> tris: array<vec4f>;
@group(0) @binding(2) var<storage, read> nodes: array<u32>;
@group(0) @binding(3) var<storage, read> info: array<vec4u>;
@group(0) @binding(4) var<storage, read> texels: array<u32>;
@group(0) @binding(5) var<storage, read> envd: array<f32>;
@group(0) @binding(6) var<storage, read_write> accum: array<vec4f>;
@group(0) @binding(7) var<storage, read_write> aux: array<f32>;

fn infoF(i: u32) -> vec4f { return bitcast<vec4f>(info[i]); }

// --- Atzar (PCG) ---------------------------------------------------------------------------
var<private> rs: u32;
fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn rnd() -> f32 {
  rs = pcg(rs);
  return f32(rs >> 8u) * (1.0 / 16777216.0);
}

// --- Materials i textures ------------------------------------------------------------------
struct Mat { color: vec3f, map: i32, e: vec4f, e2: vec2f, rough: f32, metal: f32, opacity: f32, alphaCut: f32, bump: f32, lum: f32, emission: vec3f, translucent: f32, normalMap: i32, roughMap: i32, coat: f32, sheen: f32 }
fn getMat(i: u32) -> Mat {
  let b = P.offs.x + i * 6u;
  let a = infoF(b);
  let c = infoF(b + 1u);
  let d = infoF(b + 2u);
  let e = infoF(b + 3u);
  let f = infoF(b + 4u);
  let g = infoF(b + 5u);
  return Mat(a.xyz, i32(a.w), c, d.xy, d.z, d.w, e.x, e.y, e.z, e.w, f.xyz, f.w, i32(g.x), i32(g.y), g.z, g.w);
}
fn wrapI(x: i32, n: i32, mode: u32) -> i32 {
  if (mode == 2u) { return clamp(x, 0, n - 1); }
  if (mode == 1u) {
    let p = 2 * n;
    var m = x % p;
    if (m < 0) { m += p; }
    return select(p - 1 - m, m, m < n);
  }
  var m = x % n;
  if (m < 0) { m += n; }
  return m;
}
fn texel(t: vec4u, x: i32, y: i32) -> vec4f { return unpack4x8unorm(texels[t.x + u32(y) * t.y + u32(x)]); }
fn toLin(c: vec3f) -> vec3f { return select(pow((c + 0.055) / 1.055, vec3f(2.4)), c / 12.92, c <= vec3f(0.04045)); }
fn sampleTex(ti: i32, uv: vec2f) -> vec3f {
  let t = info[P.offs.y + u32(ti)];
  let w = i32(t.y);
  let h = i32(t.z);
  let ws = t.w & 3u;
  let wt = (t.w >> 2u) & 3u;
  let vv = select(uv.y, 1.0 - uv.y, ((t.w >> 4u) & 1u) == 1u);
  let fx = uv.x * f32(w) - 0.5;
  let fy = vv * f32(h) - 0.5;
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let ax = fx - floor(fx);
  let ay = fy - floor(fy);
  let xa = wrapI(x0, w, ws);
  let xb = wrapI(x0 + 1, w, ws);
  let ya = wrapI(y0, h, wt);
  let yb = wrapI(y0 + 1, h, wt);
  if (((t.w >> 5u) & 1u) == 1u) {
    // Mapes lineals (normals, rugositat): sense la corba sRGB.
    let r0 = mix(texel(t, xa, ya).rgb, texel(t, xb, ya).rgb, ax);
    let r1 = mix(texel(t, xa, yb).rgb, texel(t, xb, yb).rgb, ax);
    return mix(r0, r1, ay);
  }
  let c0 = mix(toLin(texel(t, xa, ya).rgb), toLin(texel(t, xb, ya).rgb), ax);
  let c1 = mix(toLin(texel(t, xa, yb).rgb), toLin(texel(t, xb, yb).rgb), ax);
  return mix(c0, c1, ay);
}
fn texCoord(ti: u32, m: Mat, bu: f32, bv: f32) -> vec2f {
  let a = tris[ti * 5u + 3u];
  let b = tris[ti * 5u + 4u];
  let w = 1.0 - bu - bv;
  let u0 = a.x * w + a.z * bu + b.x * bv;
  let v0 = a.y * w + a.w * bu + b.y * bv;
  return vec2f(m.e.x * u0 + m.e.z * v0 + m.e2.x, m.e.y * u0 + m.e.w * v0 + m.e2.y);
}
fn alphaAt(ti: u32, m: Mat, bu: f32, bv: f32) -> f32 {
  if (m.map < 0) { return 1.0; }
  let t = info[P.offs.y + u32(m.map)];
  let uv = texCoord(ti, m, bu, bv);
  let vv = select(uv.y, 1.0 - uv.y, ((t.w >> 4u) & 1u) == 1u);
  let x = wrapI(i32(floor(uv.x * f32(t.y))), i32(t.y), t.w & 3u);
  let y = wrapI(i32(floor(vv * f32(t.z))), i32(t.z), (t.w >> 2u) & 3u);
  return texel(t, x, y).a;
}

// --- BVH ---------------------------------------------------------------------------------
var<private> hT: f32;
var<private> hTri: i32;
var<private> hU: f32;
var<private> hV: f32;
var<private> crossed: bool;

fn intersect(o: vec3f, d: vec3f, tMax: f32, anyHit: bool) -> bool {
  hT = tMax;
  hTri = -1;
  crossed = false;
  if (P.mode.w == 0u) { return false; }
  let dd = select(d, vec3f(1e-9), abs(d) < vec3f(1e-9));
  let inv = 1.0 / dd;
  var stack: array<u32, 64>;
  var sp = 1u;
  stack[0] = 0u;
  while (sp > 0u) {
    sp -= 1u;
    let n = stack[sp] * 8u;
    let bmin = vec3f(bitcast<f32>(nodes[n]), bitcast<f32>(nodes[n + 1u]), bitcast<f32>(nodes[n + 2u]));
    let bmax = vec3f(bitcast<f32>(nodes[n + 4u]), bitcast<f32>(nodes[n + 5u]), bitcast<f32>(nodes[n + 6u]));
    let t0 = (bmin - o) * inv;
    let t1 = (bmax - o) * inv;
    let lo = min(t0, t1);
    let hi = max(t0, t1);
    let tmin = max(max(lo.x, lo.y), lo.z);
    let tmax = min(min(hi.x, hi.y), hi.z);
    if (tmax < max(tmin, 0.0) || tmin > hT) { continue; }
    let cnt = nodes[n + 7u];
    if (cnt < INTERNAL) {
      let s = nodes[n + 3u];
      for (var i = s; i < s + cnt; i++) {
        let b = i * 5u;
        let v0 = tris[b];
        let e1 = tris[b + 1u].xyz;
        let e2 = tris[b + 2u].xyz;
        let pv = cross(d, e2);
        let det = dot(e1, pv);
        if (abs(det) < 1e-12) { continue; }
        let id = 1.0 / det;
        let tv = o - v0.xyz;
        let u = dot(tv, pv) * id;
        if (u < 0.0 || u > 1.0) { continue; }
        let q = cross(tv, e1);
        let v = dot(d, q) * id;
        if (v < 0.0 || u + v > 1.0) { continue; }
        let t = dot(e2, q) * id;
        if (t > 1e-5 && t < hT) {
          let m = getMat(u32(v0.w));
          if (m.alphaCut > 0.0) {
            if (alphaAt(i, m, u, v) < m.alphaCut) { continue; }
          }
          if (anyHit && m.opacity < 1.0) {
            crossed = true;
            continue;
          }
          hT = t;
          hTri = i32(i);
          hU = u;
          hV = v;
          if (anyHit) { return true; }
        }
      }
    } else if (sp < 62u) {
      let near = n / 8u + 1u;
      let far = nodes[n + 3u];
      if (d[cnt & 3u] < 0.0) {
        stack[sp] = near;
        stack[sp + 1u] = far;
      } else {
        stack[sp] = far;
        stack[sp + 1u] = near;
      }
      sp += 2u;
    }
  }
  return hTri >= 0;
}

fn visible(o: vec3f, d: vec3f, tMax: f32) -> f32 {
  if (intersect(o, d, tMax, true)) { return 0.0; }
  return select(1.0, P.clampv.w, crossed);
}

// --- Cel ---------------------------------------------------------------------------------
fn studioSky(dy: f32) -> vec3f {
  let t = clamp(dy, -1.0, 1.0);
  if (t >= 0.0) { return vec3f(0.55 + 0.25 * t, 0.54 + 0.25 * t, 0.53 + 0.28 * t); }
  return vec3f(0.22, 0.21, 0.2);
}
fn daySky(d: vec3f) -> vec3f {
  let cs = max(0.0, dot(d, P.sunDir.xyz));
  var c: vec3f;
  if (d.y >= 0.0) {
    let k = pow(1.0 - d.y, 2.5);
    c = mix(vec3f(0.32, 0.48, 0.85), vec3f(0.95, 0.97, 1.0), k);
  } else {
    let k = min(1.0, -d.y * 5.0);
    c = mix(vec3f(0.62, 0.64, 0.64), vec3f(0.3, 0.31, 0.26), k);
  }
  let glow = pow(cs, 16.0) * 1.2 + pow(cs, 4.0) * 0.3;
  return c + glow * vec3f(1.0, 0.92, 0.78);
}
fn dirToUv(d: vec3f) -> vec2f {
  let u = fract(atan2(d.x, -d.z) / (2.0 * PI) + 0.5 + P.sky.y);
  return vec2f(u, acos(clamp(d.y, -1.0, 1.0)) / PI);
}
fn envPx(x: u32, y: u32, w: u32) -> vec3f {
  let i = (y * w + x) * 3u;
  return vec3f(envd[i], envd[i + 1u], envd[i + 2u]);
}
// Bilineal (com el CPU): amb el píxel més proper, el cel d'1K es veia a quadres per les finestres.
fn envSky(d: vec3f) -> vec3f {
  let uv = dirToUv(d);
  let w = P.envi.x;
  let h = P.envi.y;
  let fx = uv.x * f32(w) - 0.5;
  let fy = clamp(uv.y * f32(h) - 0.5, 0.0, f32(h - 1u));
  let x0f = floor(fx);
  let tx = fx - x0f;
  let x0 = u32(i32(x0f) + i32(w)) % w;
  let x1 = (x0 + 1u) % w;
  let y0 = u32(floor(fy));
  let y1 = min(h - 1u, y0 + 1u);
  let ty = fy - f32(y0);
  return mix(mix(envPx(x0, y0, w), envPx(x1, y0, w), tx), mix(envPx(x0, y1, w), envPx(x1, y1, w), tx), ty);
}
fn sky(d: vec3f) -> vec3f {
  var c: vec3f;
  if (P.mode.z == 1u) { c = envSky(d); } else if (P.bg.w > 0.5) { c = daySky(d); } else { c = studioSky(d.y); }
  return c * P.sky.x;
}
// Vista per les finestres (CPU: \`backdrop\`): textura P.emit.z − 1 (alfa 0 = cel), amb la llum del cel a l'horitzó.
fn backdrop(d: vec3f, skyL: vec3f) -> vec3f {
  let ti = i32(P.emit.z) - 1;
  let uv = dirToUv(d);
  let t = info[P.offs.y + u32(ti)];
  let w = i32(t.y);
  let h = i32(t.z);
  let fx = uv.x * f32(w) - 0.5;
  let fy = uv.y * f32(h) - 0.5;
  let x0 = i32(floor(fx));
  let y0 = i32(floor(fy));
  let ax = fx - floor(fx);
  let ay = fy - floor(fy);
  let xa = wrapI(x0, w, 0u);
  let xb = wrapI(x0 + 1, w, 0u);
  let ya = wrapI(y0, h, 2u);
  let yb = wrapI(y0 + 1, h, 2u);
  let a = mix(mix(texel(t, xa, ya).a, texel(t, xb, ya).a, ax), mix(texel(t, xa, yb).a, texel(t, xb, yb).a, ax), ay);
  if (!(a > 0.0)) { return skyL; }
  let c = sampleTex(ti, uv);
  let hd = normalize(vec3f(d.x, 0.0, d.z) + vec3f(0.0, 0.1, 0.0));
  let L = dot(sky(hd), LUMA) * BACKDROP_GAIN;
  return mix(skyL, c * L, a);
}
fn envPdf(d: vec3f) -> f32 {
  let uv = dirToUv(d);
  let w = P.envi.x;
  let h = P.envi.y;
  let x = min(w - 1u, u32(floor(uv.x * f32(w))));
  let y = min(h - 1u, u32(floor(uv.y * f32(h))));
  let s = sqrt(max(0.0, 1.0 - d.y * d.y));
  if (s < 1e-6) { return 0.0; }
  let mo = P.envi.z;
  let co = P.envi.w + y * (w + 1u);
  let p = (envd[mo + y + 1u] - envd[mo + y]) * (envd[co + x + 1u] - envd[co + x]);
  return p * f32(w) * f32(h) / (2.0 * PI * PI * s);
}
fn findCdf(off: u32, n: u32, u: f32) -> u32 {
  var lo = 0u;
  var hi = n - 1u;
  while (lo < hi) {
    let mid = (lo + hi) / 2u;
    if (envd[off + mid + 1u] <= u) { lo = mid + 1u; } else { hi = mid; }
  }
  return lo;
}
fn sampleEnv(u1: f32, u2: f32) -> vec4f {
  let w = P.envi.x;
  let h = P.envi.y;
  let mo = P.envi.z;
  let y = findCdf(mo, h, u1);
  let co = P.envi.w + y * (w + 1u);
  let x = findCdf(co, w, u2);
  let m0 = envd[mo + y];
  let m1 = envd[mo + y + 1u];
  let c0 = envd[co + x];
  let c1 = envd[co + x + 1u];
  let fy = select(0.5, (u1 - m0) / (m1 - m0), m1 > m0);
  let fx = select(0.5, (u2 - c0) / (c1 - c0), c1 > c0);
  let u = (f32(x) + clamp(fx, 0.001, 0.999)) / f32(w);
  let v = (f32(y) + clamp(fy, 0.001, 0.999)) / f32(h);
  let phi = (u - 0.5 - P.sky.y) * 2.0 * PI;
  let th = v * PI;
  let st = sin(th);
  let d = vec3f(st * sin(phi), cos(th), -st * cos(phi));
  return vec4f(d, envPdf(d));
}
fn portal(i: u32) -> array<vec3f, 3> {
  let b = P.offs.w + i * 3u;
  return array<vec3f, 3>(infoF(b).xyz, infoF(b + 1u).xyz, infoF(b + 2u).xyz);
}
fn portalPdf(p: vec3f, d: vec3f) -> f32 {
  let np = P.mode.y;
  var pdf = 0.0;
  for (var i = 0u; i < np; i++) {
    let q = portal(i);
    let c = cross(q[1], q[2]);
    let area = length(c);
    let dn = dot(d, c);
    if (abs(dn) < 1e-9 || area < 1e-9) { continue; }
    let t = dot(q[0] - p, c) / dn;
    if (t <= 0.0) { continue; }
    let r = p + d * t - q[0];
    let s = dot(r, q[1]) / dot(q[1], q[1]);
    let k = dot(r, q[2]) / dot(q[2], q[2]);
    if (abs(s) > 0.5 || abs(k) > 0.5) { continue; }
    pdf += t * t / (area * (abs(dn) / area));
  }
  return pdf / f32(np);
}

// --- BSDF ----------------------------------------------------------------------------------
var<private> N: vec3f;
var<private> G: vec3f;
var<private> V: vec3f;
var<private> TT: vec3f;
var<private> BB: vec3f;
var<private> NoV: f32;
var<private> KD: vec3f;
var<private> F0: vec3f;
var<private> A2: f32;
var<private> PS: f32;
var<private> TR: f32;
// Vernís (pes, alfa², Fresnel cap a la càmera, probabilitat de triar-lo) i vellut, com al motor de CPU.
var<private> COAT: f32;
var<private> CA2: f32;
var<private> CFV: f32;
var<private> PC: f32;
var<private> SH: f32;
var<private> acc: vec3f;
var<private> aovA: vec3f;
var<private> aovN: vec3f;

fn basis() {
  let sg = select(-1.0, 1.0, N.z >= 0.0);
  let a = -1.0 / (sg + N.z);
  let b = N.x * N.y * a;
  TT = vec3f(1.0 + sg * N.x * N.x * a, sg * b, -sg * N.x);
  BB = vec3f(b, sg + N.y * N.y * a, -N.y);
}
fn evalBsdf(l: vec3f, a2: f32) -> vec4f {
  let NoL = dot(N, l);
  let back = dot(l, G) < 0.0;
  if (NoL <= 0.0 || back) {
    if (TR > 0.0 && back && NoL < 0.0) { return vec4f(KD * TR * (1.0 - COAT * CFV) / PI, (1.0 - PC) * (1.0 - PS) * TR * -NoL / PI); }
    return vec4f(0.0);
  }
  let hs = l + V;
  let hl = length(hs);
  let h = select(N, hs / hl, hl > 1e-6);
  let NoH = max(0.0, dot(N, h));
  let VoH = clamp(dot(V, h), 1e-4, 1.0);
  let dd = NoH * NoH * (a2 - 1.0) + 1.0;
  let D = a2 / (PI * dd * dd);
  let vis = 0.5 / (NoL * sqrt(NoV * NoV * (1.0 - a2) + a2) + NoV * sqrt(NoL * NoL * (1.0 - a2) + a2));
  let fw = pow(1.0 - VoH, 5.0);
  let Fs = F0 + (1.0 - F0) * fw;
  let kr = (1.0 - TR) / PI;
  var f = Fs * (D * vis) + KD * (1.0 - Fs) * kr;
  if (SH > 0.0) {
    let LoH = max(0.0, dot(l, h));
    f += (SH * pow(1.0 - LoH, 5.0) * (1.0 - TR)) * (0.5 + 0.5 * KD);
  }
  let pdf = PS * D * NoH / (4.0 * VoH) + (1.0 - PS) * NoL * kr;
  if (!(COAT > 0.0)) { return vec4f(f, pdf); }
  let c2 = max(CA2, CA2 + a2 - A2);
  let dc = NoH * NoH * (c2 - 1.0) + 1.0;
  let Dc = c2 / (PI * dc * dc);
  let visc = 0.5 / (NoL * sqrt(NoV * NoV * (1.0 - c2) + c2) + NoV * sqrt(NoL * NoL * (1.0 - c2) + c2));
  let Fc = COAT * (0.04 + 0.96 * fw);
  f = f * (1.0 - COAT * CFV) + vec3f(Fc * Dc * visc);
  return vec4f(f, (1.0 - PC) * pdf + PC * Dc * NoH / (4.0 * VoH));
}
fn addC(c: vec3f, k: i32) {
  let l = dot(c, LUMA);
  if (!(l > 0.0) || !(l < 1e30)) { return; }
  let mx = select(P.clampv.y, P.clampv.x, k >= 1);
  acc += c * min(1.0, mx / l);
}
fn bevelNormal(p: vec3f, n: vec3f, bmin: vec3f, bmax: vec3f, r: f32) -> vec3f {
  var o = n;
  for (var a = 0u; a < 3u; a++) {
    if (abs(n[a]) > 0.5) { continue; }
    let ra = min(r, (bmax[a] - bmin[a]) * 0.25);
    if (!(ra > 0.0)) { continue; }
    let lo = p[a] - bmin[a];
    let hi = bmax[a] - p[a];
    if (lo < ra && lo <= hi) { o[a] = o[a] - (1.0 - max(0.0, lo) / ra); }
    else if (hi < ra) { o[a] = o[a] + (1.0 - max(0.0, hi) / ra); }
  }
  return normalize(o);
}

fn emitter(i: u32) -> array<vec4f, 4> {
  let b = P.emit.x + i * 4u;
  return array<vec4f, 4>(infoF(b), infoF(b + 1u), infoF(b + 2u), infoF(b + 3u));
}
fn pickEmitter(u: f32) -> u32 {
  var lo = 0u;
  var hi = P.emit.y - 1u;
  while (lo < hi) {
    let mid = (lo + hi) / 2u;
    if (infoF(P.emit.x + mid * 4u + 2u).w <= u) { lo = mid + 1u; } else { hi = mid; }
  }
  return lo;
}
fn perturbNormal(n: vec3f, T: vec3f, B: vec3f, ts: vec3f) -> vec3f {
  var t = T - n * dot(n, T);
  let tl = length(t);
  if (!(tl > 1e-12)) { return n; }
  t /= tl;
  var b = cross(n, t);
  if (dot(b, B) < 0.0) { b = -b; }
  return normalize(t * ts.x + b * ts.y + n * ts.z);
}

// Normal d'un vèrtex empaquetada en un float (octaedre, 12 + 12 bits): \`decodeNormal\` de shading.ts.
fn decodeNormal(f: f32) -> vec3f {
  let k = u32(round(f));
  let e = vec2f(f32(k / 4096u), f32(k % 4096u)) / 4094.0 * 2.0 - 1.0;
  var n = vec3f(e.x, e.y, 1.0 - abs(e.x) - abs(e.y));
  let t = max(-n.z, 0.0);
  n.x += select(t, -t, n.x >= 0.0);
  n.y += select(t, -t, n.y >= 0.0);
  return normalize(n);
}
// Normal d'ombrejat: les dels vèrtexs interpolades (\`smoothNormal\`), a la cara de G.
fn smoothNormal(ti: u32, bu: f32, bv: f32) -> vec3f {
  let a = tris[ti * 5u + 2u].w;
  let b = tris[ti * 5u + 4u];
  let n = decodeNormal(a) * (1.0 - bu - bv) + decodeNormal(b.z) * bu + decodeNormal(b.w) * bv;
  let l = length(n);
  if (!(l > 1e-6)) { return G; }
  return select(n / l, -n / l, dot(n, G) < 0.0);
}

fn trace(o0: vec3f, d0: vec3f) -> vec4f {
  var o = o0;
  var d = d0;
  var thr = vec3f(1.0);
  acc = vec3f(0.0);
  var alpha = 1.0;
  var aov = false;
  var vertex = -1;
  var cp = vec3f(0.0);
  var cn = vec3f(0.0);
  var lastPdf = 0.0;
  var delta = false;
  var pathRough = 0.0;
  aovA = vec3f(1.0);
  aovN = vec3f(0.0);
  for (var bounce = 0u; bounce < P.run.z; bounce++) {
    if (!intersect(o, d, 1e9, false)) {
      if (bounce == 0u) {
        // El fons segueix la llum del cel (al vespre, fosc).
        acc += P.bg.xyz * P.sky.x;
        alpha = 0.0;
        break;
      }
      var L = sky(d);
      // Per un vidre sense haver tocat res: la vista de fora (jardí, mar) davant del cel.
      if (vertex < 0 && P.emit.z > 0u) { L = backdrop(d, L); }
      var w = 1.0;
      if (vertex >= 0 && !delta) {
        var pn = 0.0;
        if (P.mode.x == 2u) { pn = portalPdf(cp, d); } else if (P.mode.x == 1u) { pn = envPdf(d); } else { pn = max(0.0, dot(cn, d)) / PI; }
        w = lastPdf * lastPdf / (lastPdf * lastPdf + pn * pn);
      }
      addC(thr * L * w, max(0, vertex));
      break;
    }
    let ti = u32(hTri);
    let v0 = tris[ti * 5u];
    let e1 = tris[ti * 5u + 1u];
    let e2 = tris[ti * 5u + 2u].xyz;
    let m = getMat(u32(v0.w));
    G = normalize(cross(e1.xyz, e2));
    if (dot(G, d) > 0.0) { G = -G; }
    let hp = o + d * hT;
    var al = m.color;
    var rough = m.rough;
    N = smoothNormal(ti, hU, hV);
    // Llum vista d'un emissor amb textura (pantalla de lli): la de la textura respecte de la mitjana (es veu la tela).
    var emK = 1.0;
    if (m.map >= 0) {
      let uv = texCoord(ti, m, hU, hV);
      let tc = sampleTex(m.map, uv);
      al *= tc;
      emK = dot(tc, LUMA) / max(0.02, m.lum);
      if (m.roughMap >= 0) { rough = clamp(rough * sampleTex(m.roughMap, uv).y, 0.02, 1.0); }
      if (m.normalMap >= 0) {
        let A = tris[ti * 5u + 3u];
        let Bq = tris[ti * 5u + 4u];
        let U0 = m.e.x * A.x + m.e.z * A.y + m.e2.x;
        let V0 = m.e.y * A.x + m.e.w * A.y + m.e2.y;
        let U1 = m.e.x * A.z + m.e.z * A.w + m.e2.x;
        let V1 = m.e.y * A.z + m.e.w * A.w + m.e2.y;
        let U2 = m.e.x * Bq.x + m.e.z * Bq.y + m.e2.x;
        let V2 = m.e.y * Bq.x + m.e.w * Bq.y + m.e2.y;
        let du1 = U1 - U0;
        let dv1 = V1 - V0;
        let du2 = U2 - U0;
        let dv2 = V2 - V0;
        let det = du1 * dv2 - du2 * dv1;
        if (abs(det) > 1e-12) {
          let r = 1.0 / det;
          let T = (e1.xyz * dv2 - e2 * dv1) * r;
          let B = (e2 * du1 - e1.xyz * du2) * r;
          N = perturbNormal(N, T, B, sampleTex(m.normalMap, uv) * 2.0 - 1.0);
        }
      }
      if (m.bump > 0.0) {
        let t = info[P.offs.y + u32(m.map)];
        let l0 = dot(tc, LUMA);
        let gu = dot(sampleTex(m.map, uv + vec2f(1.0 / (f32(t.y) * f32(P.seed.z)), 0.0)), LUMA) - l0;
        let gv = dot(sampleTex(m.map, uv + vec2f(0.0, 1.0 / (f32(t.z) * f32(P.seed.z)))), LUMA) - l0;
        let avg = max(0.02, m.lum);
        rough = clamp(rough * (1.0 + 0.5 * (avg - l0) / avg), 0.05, 1.0);
        let A = tris[ti * 5u + 3u];
        let Bq = tris[ti * 5u + 4u];
        let U0 = m.e.x * A.x + m.e.z * A.y + m.e2.x;
        let V0 = m.e.y * A.x + m.e.w * A.y + m.e2.y;
        let U1 = m.e.x * A.z + m.e.z * A.w + m.e2.x;
        let V1 = m.e.y * A.z + m.e.w * A.w + m.e2.y;
        let U2 = m.e.x * Bq.x + m.e.z * Bq.y + m.e2.x;
        let V2 = m.e.y * Bq.x + m.e.w * Bq.y + m.e2.y;
        let du1 = U1 - U0;
        let dv1 = V1 - V0;
        let du2 = U2 - U0;
        let dv2 = V2 - V0;
        let det = du1 * dv2 - du2 * dv1;
        if (abs(det) > 1e-12) {
          let r = 1.0 / det;
          let T = normalize((e1.xyz * dv2 - e2 * dv1) * r);
          let B = normalize((e2 * du1 - e1.xyz * du2) * r);
          N = normalize(N - P.sky.w * m.bump * (gu * T + gv * B));
        }
      }
    }
    let bi = i32(e1.w);
    if (bi >= 0) {
      let q = P.offs.z + u32(bi) * 5u;
      let r0 = infoF(q);
      let r1 = infoF(q + 1u);
      let r2 = infoF(q + 2u);
      let bmn = infoF(q + 3u);
      let bmx = infoF(q + 4u);
      let lp = vec3f(dot(r0.xyz, hp) + r0.w, dot(r1.xyz, hp) + r1.w, dot(r2.xyz, hp) + r2.w);
      let ln = normalize(vec3f(dot(r0.xyz, N), dot(r1.xyz, N), dot(r2.xyz, N)));
      let rn = bevelNormal(lp, ln, bmn.xyz, bmx.xyz, bmn.w);
      N = normalize(r0.xyz * rn.x + r1.xyz * rn.y + r2.xyz * rn.z);
    }
    V = -d;
    NoV = dot(N, V);
    if (NoV < 0.05) {
      N = normalize(N + V * (0.05 - NoV));
      NoV = max(1e-3, dot(N, V));
    }
    if (P.lamp.x > 0.0 && P.emit.y > 0u) {
      let el = dot(m.emission, LUMA);
      if (el > 0.0) {
        var w = 1.0;
        if (vertex >= 0 && !delta) {
          let cosL = abs(dot(d, G));
          let pl = select(0.0, el / P.lamp.y * hT * hT / cosL, cosL > 1e-6);
          w = lastPdf * lastPdf / (lastPdf * lastPdf + pl * pl);
        }
        // Vistes des de la càmera, ×lampView (es veu la tela); la llum que fan, igual.
        let view = select(1.0, P.lamp.z, vertex < 0);
        addC(thr * m.emission * (P.lamp.x * w * emK * view), max(0, vertex));
      }
    }
    if (m.opacity < 1.0) {
      let c = abs(dot(d, G));
      let F = 0.04 + 0.96 * pow(1.0 - c, 5.0);
      if (rnd() < F) {
        d = d - 2.0 * dot(d, G) * G;
        o = hp + G * 1e-4;
        delta = true;
      } else {
        o = hp - G * 1e-4;
        thr *= 1.0 - m.opacity * (1.0 - al);
      }
      continue;
    }
    if (!aov) {
      aov = true;
      aovA = al;
      aovN = N;
    }
    vertex += 1;
    delta = false;
    let p = hp + G * 1e-4;
    let q = hp - G * 1e-4;
    TR = m.translucent;
    let metal = clamp(m.metal, 0.0, 1.0);
    KD = al * (1.0 - metal);
    F0 = mix(vec3f(0.04), al, metal);
    let re = select(rough, max(rough, pathRough), vertex > 0);
    A2 = max(1e-4, re * re * re * re);
    COAT = clamp(m.coat, 0.0, 1.0);
    SH = clamp(m.sheen, 0.0, 1.0);
    {
      let rc = select(COAT_ROUGHNESS, max(COAT_ROUGHNESS, pathRough), vertex > 0);
      CA2 = max(1e-5, rc * rc * rc * rc);
      CFV = 0.04 + 0.96 * pow(1.0 - NoV, 5.0);
      PC = select(0.0, COAT * min(0.5, 0.15 + CFV), COAT > 0.0);
    }
    {
      let fw = pow(1.0 - NoV, 5.0);
      let ws = dot(F0, LUMA) * (1.0 - fw) + fw;
      let wd = dot(KD, LUMA) * (1.0 - ws);
      PS = select(clamp(ws / (ws + wd), 0.05, 0.95), 1.0, wd < 1e-4);
    }
    basis();
    // Sol.
    {
      let u1 = rnd();
      let u2 = rnd();
      let ct = 1.0 - u1 * (1.0 - P.sunDir.w);
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let ph = 2.0 * PI * u2;
      let s = P.sunDir.xyz;
      let sg = select(-1.0, 1.0, s.z >= 0.0);
      let a = -1.0 / (sg + s.z);
      let b = s.x * s.y * a;
      let ux = vec3f(1.0 + sg * s.x * s.x * a, sg * b, -sg * s.x);
      let wx = vec3f(b, sg + s.y * s.y * a, -s.y);
      let l = ux * (cos(ph) * st) + wx * (sin(ph) * st) + s * ct;
      let front = dot(l, G) > 0.0;
      if (front || TR > 0.0) {
        let NoL = abs(dot(N, l));
        let f = evalBsdf(l, A2 + P.sunCol.w).xyz;
        if (f.x + f.y + f.z > 0.0) {
          let T = visible(select(q, p, front), l, 1e9);
          if (T > 0.0) { addC(thr * f * P.sunCol.xyz * (NoL * T), vertex); }
        }
      }
    }
    // Cel.
    {
      var l = vec3f(0.0);
      var pl = 0.0;
      if (P.mode.x == 2u) {
        let np = P.mode.y;
        let q = portal(min(np - 1u, u32(floor(rnd() * f32(np)))));
        let r1 = rnd() - 0.5;
        let r2 = rnd() - 0.5;
        l = normalize(q[0] + r1 * q[1] + r2 * q[2] - p);
        pl = portalPdf(p, l);
      } else if (P.mode.x == 1u) {
        let s = sampleEnv(rnd(), rnd());
        l = s.xyz;
        pl = s.w;
      } else {
        let u1 = rnd();
        let u2 = rnd();
        let rr = sqrt(u1);
        let ph = 2.0 * PI * u2;
        let c = sqrt(1.0 - u1);
        l = TT * (rr * cos(ph)) + BB * (rr * sin(ph)) + N * c;
        pl = c / PI;
      }
      let front = dot(l, G) > 0.0;
      if (pl > 0.0 && (front || TR > 0.0)) {
        let fb = evalBsdf(l, A2);
        let NoL = abs(dot(N, l));
        if (fb.x + fb.y + fb.z > 0.0) {
          let T = visible(select(q, p, front), l, 1e9);
          if (T > 0.0) {
            let w = pl * T * NoL / (pl * pl + fb.w * fb.w);
            addC(thr * fb.xyz * sky(l) * w, vertex);
          }
        }
      }
    }
    // Làmpades.
    if (P.lamp.x > 0.0 && P.emit.y > 0u) {
      let E = emitter(pickEmitter(rnd()));
      let su = sqrt(rnd());
      let r2 = rnd();
      let tp = E[0].xyz + E[1].xyz * (su * (1.0 - r2)) + E[2].xyz * (su * r2);
      var l = tp - p;
      let dist = max(1e-9, length(l));
      l /= dist;
      let c = cross(E[1].xyz, E[2].xyz);
      let cosL = abs(dot(c, l)) / max(1e-20, length(c));
      let front = dot(l, G) > 0.0;
      if (cosL > 1e-4 && (front || TR > 0.0)) {
        let pl = E[3].w / P.lamp.y * dist * dist / cosL;
        let fb = evalBsdf(l, A2);
        let NoL = abs(dot(N, l));
        if (fb.x + fb.y + fb.z > 0.0) {
          let T = visible(select(q, p, front), l, dist * (1.0 - 1e-3));
          if (T > 0.0) {
            let w = P.lamp.x * pl * T * NoL / (pl * pl + fb.w * fb.w);
            addC(thr * fb.xyz * E[3].xyz * w, vertex);
          }
        }
      }
    }
    // Rebot.
    var l: vec3f;
    let coatS = PC > 0.0 && rnd() < PC;
    var spec = coatS;
    if (!coatS) { spec = rnd() < PS; }
    if (coatS) {
      let u1 = rnd();
      let u2 = rnd();
      let ph = 2.0 * PI * u1;
      let ct = sqrt((1.0 - u2) / (1.0 + (CA2 - 1.0) * u2));
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let h = TT * (cos(ph) * st) + BB * (sin(ph) * st) + N * ct;
      l = 2.0 * dot(V, h) * h - V;
    } else if (spec) {
      let u1 = rnd();
      let u2 = rnd();
      let ph = 2.0 * PI * u1;
      let ct = sqrt((1.0 - u2) / (1.0 + (A2 - 1.0) * u2));
      let st = sqrt(max(0.0, 1.0 - ct * ct));
      let h = TT * (cos(ph) * st) + BB * (sin(ph) * st) + N * ct;
      l = 2.0 * dot(V, h) * h - V;
    } else {
      let u1 = rnd();
      let u2 = rnd();
      let rr = sqrt(u1);
      let ph = 2.0 * PI * u2;
      var cz = sqrt(1.0 - u1);
      if (TR > 0.0) {
        if (rnd() < TR) { cz = -cz; }
      }
      l = TT * (rr * cos(ph)) + BB * (rr * sin(ph)) + N * cz;
    }
    let ldg = dot(l, G);
    let nl = dot(N, l);
    if (ldg * nl <= 0.0 || (ldg < 0.0 && (spec || !(TR > 0.0)))) { break; }
    let fb = evalBsdf(l, A2);
    let NoL = abs(nl);
    if (!(fb.w > 1e-8)) { break; }
    thr *= fb.xyz * NoL / fb.w;
    pathRough = max(pathRough, select(select(P.clampv.z, re * 0.5, spec), COAT_ROUGHNESS, coatS));
    cp = p;
    cn = N;
    lastPdf = fb.w;
    d = l;
    o = select(q, p, ldg > 0.0);
    if (bounce >= 2u) {
      let pm = min(0.95, max(thr.x, max(thr.y, thr.z)));
      if (rnd() > pm) { break; }
      thr /= pm;
    }
  }
  return vec4f(acc, alpha);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let W = u32(P.frame.y);
  let H = u32(P.frame.z);
  let x = gid.x;
  let y = gid.y + u32(P.frame.w);
  if (x >= W || y >= H || gid.y >= P.seed.y) { return; }
  let pix = y * W + x;
  var sum = vec4f(0.0);
  var sa = vec3f(0.0);
  var sn = vec3f(0.0);
  let ap = P.camInfo.w;
  for (var s = 0u; s < P.run.x; s++) {
    rs = pcg(pix * 1973u + pcg(P.run.y + s + P.seed.x * 2654435769u));
    let nxp = (f32(x) + rnd()) / f32(W) * 2.0 - 1.0;
    let nyp = 1.0 - (f32(y) + rnd()) / f32(H) * 2.0;
    let lx = nxp * P.camInfo.x * P.camInfo.y;
    let ly = nyp * P.camInfo.x + P.cam3.w;
    var o: vec3f;
    var d: vec3f;
    if (P.camInfo.z > 0.5) {
      o = P.cam3.xyz + P.cam0.xyz * lx + P.cam1.xyz * ly;
      d = -P.cam2.xyz;
    } else {
      d = normalize(P.cam0.xyz * lx + P.cam1.xyz * ly - P.cam2.xyz);
      o = P.cam3.xyz;
      if (ap > 0.0 && P.frame.x > 0.0) {
        let fwd = -dot(d, P.cam2.xyz);
        let t = P.frame.x / max(1e-3, fwd);
        let f = o + d * t;
        let rr = sqrt(rnd()) * ap;
        let ph = rnd() * 2.0 * PI;
        o += P.cam0.xyz * (rr * cos(ph)) + P.cam1.xyz * (rr * sin(ph));
        d = normalize(f - o);
      }
    }
    let c = trace(o, d);
    sum += c;
    sa += aovA;
    sn += aovN;
  }
  accum[pix] += sum;
  if (P.run.w == 1u) {
    let b = pix * 6u;
    aux[b] += sa.x;
    aux[b + 1u] += sa.y;
    aux[b + 2u] += sa.z;
    aux[b + 3u] += sn.x;
    aux[b + 4u] += sn.y;
    aux[b + 5u] += sn.z;
  }
}
`
