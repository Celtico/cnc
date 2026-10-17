import { BoxGeometry, BufferAttribute, BufferGeometry, DataTexture, NearestFilter, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2, Vector3 } from "three"
import { takeDirty, type Heightfield } from "./camHeightfield"
import type { SimProgram } from "./camSim"

/**
 * El 3D de la simulació de la Vista CAM (three, només des de `CamSim3D`, a demanda): la textura del mapa d'alçades,
 * el material que la pinta (cada píxel segueix el raig de la càmera fins a la matèria; el que és passant no es pinta i
 * s'hi veu el martiri) i les línies dels recorreguts.
 */

export function heightTexture(hf: Heightfield): DataTexture {
  const tex = new DataTexture(hf.data, hf.nx, hf.ny, RGBAFormat, UnsignedByteType)
  tex.magFilter = NearestFilter
  tex.minFilter = NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** Puja a la GPU només les files canviades (o tot, si és molt o s'ha refet). */
export function flushHeightTexture(hf: Heightfield, tex: DataTexture): boolean {
  const d = takeDirty(hf)
  if (!d) return false
  const cols = d.i1 - d.i0 + 1
  const rows = d.j1 - d.j0 + 1
  tex.clearUpdateRanges()
  if (rows * cols < 0.25 * hf.nx * hf.ny && rows < 256) for (let j = d.j0; j <= d.j1; j++) tex.addUpdateRange((j * hf.nx + d.i0) * 4, cols * 4)
  tex.needsUpdate = true
  return true
}

/**
 * El tauler sencer (caixa de 0 a L, 0 a W i 0 a T, en mm de la peça): el material hi busca per a cada píxel on el raig de
 * la càmera topa amb el mapa d'alçades (`reliefMaterial`).
 */
export function boardGeometry(hf: Heightfield): BoxGeometry {
  const g = new BoxGeometry(hf.L, hf.W, hf.T)
  g.translate(hf.L / 2, hf.W / 2, hf.T / 2)
  return g
}

const VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Colors ja en sRGB (sense conversió: el material no passa per la gestió de color de three).
// Per decisió de l'usuari (2026-10-17: «es veu molt pixelat»): abans la cara de dalt era una malla desplaçada pel mapa
// (un vèrtex cada 2–4 mm i les vores dels forats en escala). Ara cada píxel segueix el raig de la càmera dins del tauler
// fins que troba matèria (marxa a mitja cel·la i afinat binari), amb el mapa **interpolat** (bilineal a mà: la textura és
// NEAREST perquè el codi 0 = passant no es pot barrejar): la vora d'un forat és la corba on la meitat és matèria. Escriu
// la fondària de debò (l'eina entra als forats) i, si travessa, no pinta (s'hi veu el martiri).
const FRAG = /* glsl */ `
uniform mat4 projectionMatrix;
uniform mat4 modelMatrix;
uniform sampler2D hTex;
uniform vec2 size;
uniform vec2 texel;
uniform float T;
uniform float cell;
uniform vec3 camLocal;
uniform vec3 boxMax;
varying vec3 vPos;
// Matèria i alçada interpolades: x = fracció de matèria, y = alçada sobre la matèria, z = acabat.
vec3 smoothAt(vec2 xy) {
  vec2 st = xy / size / texel - 0.5;
  vec2 f = fract(st);
  vec2 b = (floor(st) + 0.5) * texel;
  vec4 a = texture2D(hTex, b);
  vec4 c = texture2D(hTex, b + vec2(texel.x, 0.0));
  vec4 d = texture2D(hTex, b + vec2(0.0, texel.y));
  vec4 e = texture2D(hTex, b + texel);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 r = vec4(a.r, c.r, d.r, e.r) * 255.0;
  vec4 m = step(0.5, r) * w;
  float sol = m.x + m.y + m.z + m.w;
  vec4 h = (r - 1.0) / 254.0 * T;
  float z = sol > 0.0 ? dot(h, m) / sol : 0.0;
  float g = sol > 0.0 ? dot(vec4(a.g, c.g, d.g, e.g), m) / sol : 0.0;
  return vec3(sol, z, g);
}
bool solid(vec3 p) {
  vec3 s = smoothAt(p.xy);
  return s.x >= 0.5 && p.z <= s.y;
}
void main() {
  vec3 ro = vPos;
  vec3 rd = normalize(vPos - camLocal);
  // Fins on surt de la caixa.
  vec3 inv = 1.0 / rd;
  vec3 t1 = (vec3(0.0) - ro) * inv;
  vec3 t2 = (boxMax - ro) * inv;
  vec3 tf = max(t1, t2);
  float tExit = min(min(tf.x, tf.y), tf.z);
  float hz = length(rd.xy);
  float dt = min(0.5 * cell / max(hz, 1e-4), T / max(abs(rd.z), 1e-4) / 8.0);
  float t = 0.0;
  bool hit = solid(ro);
  bool first = hit;
  for (int i = 0; i < 320; i++) {
    if (hit || t > tExit) break;
    t += dt;
    if (solid(ro + rd * t)) {
      // Afinat: entre l'últim lliure i el primer amb matèria.
      float lo = t - dt, hi = t;
      for (int k = 0; k < 6; k++) {
        float mid = 0.5 * (lo + hi);
        if (solid(ro + rd * mid)) hi = mid; else lo = mid;
      }
      t = hi;
      hit = true;
    }
  }
  if (!hit) discard;
  vec3 p = ro + rd * t;
  vec3 s = smoothAt(p.xy);
  vec3 n;
  float onTop = step(s.y - 0.05, p.z);
  if (first && p.z < T - 0.01 && onTop < 0.5) {
    // Un cantell del tauler (la cara de la caixa on ha entrat el raig).
    vec3 a = abs(vPos - boxMax * 0.5) / (boxMax * 0.5);
    n = a.x > a.y ? vec3(sign(vPos.x - boxMax.x * 0.5), 0.0, 0.0) : vec3(0.0, sign(vPos.y - boxMax.y * 0.5), 0.0);
  } else {
    float e = cell;
    float hx = smoothAt(p.xy + vec2(e, 0.0)).y - smoothAt(p.xy - vec2(e, 0.0)).y;
    float hy = smoothAt(p.xy + vec2(0.0, e)).y - smoothAt(p.xy - vec2(0.0, e)).y;
    n = normalize(vec3(-hx, -hy, 2.0 * e));
  }
  float d = clamp((T - p.z) / T, 0.0, 1.0);
  float grain = 0.5 + 0.5 * sin(p.y * 0.35 + sin(p.x * 0.004) * 6.0 + sin(p.x * 0.031) * 0.8);
  vec3 top = mix(vec3(0.84, 0.69, 0.50), vec3(0.72, 0.56, 0.38), grain * 0.45);
  vec3 cut = vec3(0.93, 0.83, 0.66);
  vec3 edge = vec3(0.77, 0.60, 0.42);
  vec3 base = first && p.z < T - 0.01 && onTop < 0.5 ? edge : d > 0.003 ? mix(cut, cut * 0.62, d) : top;
  base = mix(base, vec3(0.55, 0.78, 0.5), s.z * 0.18);
  float lit = 0.5 + 0.6 * max(dot(n, normalize(vec3(-0.35, -0.55, 0.76))), 0.0);
  gl_FragColor = vec4(base * lit, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_FragDepth = 0.5 * (clip.z / clip.w) + 0.5;
}
`

/** El material del tauler: `camLocal` (la càmera en mm de la peça) es posa a cada fotograma. */
export function reliefMaterial(hf: Heightfield, tex: DataTexture): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      hTex: { value: tex },
      size: { value: new Vector2(hf.nx * hf.cell, hf.ny * hf.cell) },
      texel: { value: new Vector2(1 / hf.nx, 1 / hf.ny) },
      cell: { value: hf.cell },
      T: { value: hf.T },
      camLocal: { value: new Vector3() },
      boxMax: { value: new Vector3(hf.L, hf.W, hf.T) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  })
}

/** Línies del programa: els talls (a sobre del tauler) i els ràpids (a la seva alçada); per operació, el tros dels talls. */
export function pathGeometries(prog: SimProgram): { cuts: BufferGeometry; current: BufferGeometry; rapids: BufferGeometry; ranges: Map<number, [number, number]> } {
  const cut: number[] = []
  const rapid: number[] = []
  const ranges = new Map<number, [number, number]>()
  const z = prog.T + 0.4
  for (const m of prog.moves) {
    if (Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1]) < 1e-6) continue
    if (m.kind === "rapid") {
      rapid.push(...m.a, ...m.b)
      continue
    }
    const r = ranges.get(m.op)
    if (r) r[1] += 2
    else ranges.set(m.op, [cut.length / 3, 2])
    cut.push(m.a[0], m.a[1], z, m.b[0], m.b[1], z)
  }
  const geo = (a: number[]) => {
    const g = new BufferGeometry()
    g.setAttribute("position", new BufferAttribute(new Float32Array(a), 3))
    return g
  }
  const cuts = geo(cut)
  // L'operació en curs: les mateixes línies (el mateix buffer) amb el seu `drawRange`.
  const current = new BufferGeometry()
  current.setAttribute("position", cuts.getAttribute("position"))
  current.setDrawRange(0, 0)
  return { cuts, current, rapids: geo(rapid), ranges }
}
