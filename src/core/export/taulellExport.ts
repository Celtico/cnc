import { buildComposition } from "../build/buildComposition"
import { flatten, type Composition, type Hole, type Panel, type Vec3 } from "../model"

/**
 * Un moble del cnc → un projecte del Taulell 3D (el `.taulell` que obre «Obre fitxer…»). cel, 2026-11-08: «obro una cuina i
 * l'exporto a un taulell». Cada peça construïda passa a ser una peça solta del Taulell (no un moble paramètric: el Taulell no
 * en sabria refer la fórmula), amb el seu material, cantells, forats i ranures. El que el Taulell no té igual (talls
 * passants, buidats, inglets) es compta a `skipped`.
 */

/** Una peça del Taulell (`newPart`): perfil al pla x–z local, gruix en y local, `pos` i `quat` ([x, y, z, w]). */
export interface TaulellPartOut {
  id: number
  name: string
  prof: { type: "rect"; L: number; W: number } | { type: "poly"; pts: [number, number][] }
  T: number
  pos: Vec3
  quat: [number, number, number, number]
  mat: string
  bands: Record<string, 1>
  feats: TaulellFeat[]
  hidden: false
  grp: string
}

type TaulellFeat =
  | { type: "hole"; name: string; p: Vec3; n: Vec3; d: number; depth: number }
  | { type: "groove"; name: string; box: [number, number, number, number, number, number] }

export interface TaulellExport {
  doc: { name: string; parts: TaulellPartOut[]; cabs: []; sketches: []; hw: []; next: number }
  skipped: { cutouts: number; pockets: number; mitres: number }
}

const r2 = (v: number) => Math.round(v * 100) / 100
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** El quaternió ([x, y, z, w]) de la rotació amb aquestes columnes (com `quatFromBasis` del Taulell). */
export function quatFromBasis(x: Vec3, y: Vec3, z: Vec3): [number, number, number, number] {
  const [m11, m21, m31] = x
  const [m12, m22, m32] = y
  const [m13, m23, m33] = z
  const tr = m11 + m22 + m33
  let q: [number, number, number, number]
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1)
    q = [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s]
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33)
    q = [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33)
    q = [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s]
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22)
    q = [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s]
  }
  return q.map((v) => Math.round(v * 1e6) / 1e6) as [number, number, number, number]
}

/** Els materials bàsics del Taulell (`MATS`), per paraules del nom del material del cnc. Si no, melamina blanca. */
const MAT_WORDS: [RegExp, string][] = [
  [/hdf/i, "hdf"],
  [/\bmdf\b/i, "mdf"],
  [/grafit|antracita|gris|negre|black/i, "grafit"],
  [/roure|oak/i, "roure"],
  [/noguer|walnut/i, "noguera"],
  [/faig|beech/i, "faig"],
  [/lacat|salvia/i, "lacat"],
]
export function taulellMatKey(name: string): string {
  return MAT_WORDS.find(([re]) => re.test(name))?.[1] ?? "mel"
}

/** El nom del forat al Taulell (la llista de ferratges hi busca «Cassoleta frontissa»). */
function holeName(h: Hole): string {
  if (h.tag === "hinge") return "Cassoleta frontissa"
  if (h.tag === "dowel") return "Clavilla"
  if (h.tag === "cabineo") return h.diameter >= 10 ? "Cabineo" : "Cabineo cargol"
  if (h.tag === "system32") return "Línia 32"
  if (h.tag === "screw") return "Cargol"
  return "Perforació"
}

/**
 * Una peça del cnc → una del Taulell. Eixos: la x local del Taulell és el llarg (`xAxis`), la y el gruix (`zAxis`) i la z
 * l'ample: `−yAxis` si la peça és dextrogira (la z del Taulell surt de l'altre cantell, `pos` hi va), `+yAxis` si no.
 */
export function taulellPart(p: Panel, id: number, grp: string): TaulellPartOut {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const right = dot(cross(xAxis, yAxis), zAxis) > 0
  const Zt: Vec3 = right ? (yAxis.map((v) => -v) as Vec3) : yAxis
  const pos: Vec3 = right ? (origin.map((v, k) => v + yAxis[k]! * p.width) as Vec3) : origin
  const W = p.width, T = p.thickness
  /** (llarg, ample) del cnc → (x, z) local del Taulell. */
  const z = (ly: number) => (right ? W - ly : ly)
  const prof: TaulellPartOut["prof"] = p.outline
    ? { type: "poly", pts: flatten(p.outline).map(([x, y]) => [r2(x), r2(z(y))] as [number, number]) }
    : { type: "rect", L: r2(p.length), W: r2(W) }
  // Cantells (rectangle: 0 el costat z = 0, 1 x = L, 2 z = W, 3 x = 0).
  const bands: Record<string, 1> = {}
  if (!p.outline) {
    const e = p.edges
    if (right ? e.top : e.bottom) bands[0] = 1
    if (e.right) bands[1] = 1
    if (right ? e.bottom : e.top) bands[2] = 1
    if (e.left) bands[3] = 1
  }
  const feats: TaulellFeat[] = []
  for (const h of p.holes) {
    const name = holeName(h)
    if (h.face === "A" || h.face === "B") {
      feats.push({ type: "hole", name, p: [r2(h.x), h.face === "A" ? T : 0, r2(z(h.y))], n: [0, h.face === "A" ? 1 : -1, 0], d: h.diameter, depth: h.depth })
      continue
    }
    const zs = right ? -1 : 1
    const n: Vec3 = h.edge === "left" ? [-1, 0, 0] : h.edge === "right" ? [1, 0, 0] : h.edge === "bottom" ? [0, 0, -zs] : [0, 0, zs]
    feats.push({ type: "hole", name, p: [r2(h.x), r2(T / 2), r2(z(h.y))], n, d: h.diameter, depth: h.depth })
  }
  for (const g of p.grooves) {
    const [y0, y1] = g.face === "A" ? [T - g.depth, T + 1] : [-1, g.depth]
    const za = z(g.y), zb = z(g.y + g.h)
    // Una ranura que arriba al cantell en surt 1 mm (com les del Taulell), perquè el tall no deixi una pell.
    const ext = (v: number, edge: number) => (Math.abs(v - edge) < 0.01 ? edge + Math.sign(edge === 0 ? -1 : 1) : v)
    const x0 = g.x < 0.01 ? -1 : g.x, x1 = g.x + g.w > p.length - 0.01 ? p.length + 1 : g.x + g.w
    feats.push({ type: "groove", name: "Ranura", box: [r2(x0), r2(y0), r2(ext(Math.min(za, zb), 0)), r2(x1), r2(y1), r2(Math.max(za, zb) > W - 0.01 ? W + 1 : Math.max(za, zb))] })
  }
  return { id, name: p.label, prof, T, pos: pos.map(r2) as Vec3, quat: quatFromBasis(xAxis, zAxis, Zt), mat: taulellMatKey(p.material), bands, feats, hidden: false, grp }
}

/** El moble sencer → el document del Taulell (les peces de ferratge, com potes o tiradors, no hi van). */
export function toTaulell(comp: Composition, name: string): TaulellExport {
  const { panels } = buildComposition(comp)
  const skipped = { cutouts: 0, pockets: 0, mitres: 0 }
  const parts: TaulellPartOut[] = []
  for (const p of panels) {
    if (p.role === "hardware") continue
    if (p.cutouts?.length) skipped.cutouts += p.cutouts.length
    if (p.pockets?.length) skipped.pockets += p.pockets.length
    if (p.mitres?.length) skipped.mitres++
    const m = p.module ? comp.modules[p.module - 1] : undefined
    parts.push(taulellPart(p, parts.length + 1, m ? m.name || `Mòdul ${p.module}` : "Peces soltes"))
  }
  return { doc: { name, parts, cabs: [], sketches: [], hw: [], next: parts.length + 1 }, skipped }
}
