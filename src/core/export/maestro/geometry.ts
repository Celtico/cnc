import { arcOf, bulgeOf, distToPolygon, flatten, type BPt, type Cutout, type EdgeSide, type Hole, type Panel } from "../../model"
import type { CutMode } from "../../model/machine"
import { cs, num } from "./script"

/** Geometria dels programes: polilínies, sentit dels contorns, eines que hi caben i recorregut de les ranures. */

const EPS = 0.01

/** Clau d'un punt tal com el veurà Maestro (arrodonit a 0,001 mm). */
const key = (p: BPt) => `${num(p[0])},${num(p[1])}`

/**
 * Treu els punts repetits (a 0,001 mm, el que s'escriu): un segment o arc de llargada zero no és vàlid.
 * Si dos punts seguits coincideixen, es queda el segon (amb el seu bulge, el del tram que de debò surt d'allà).
 */
export function dedupePolyline(pts: BPt[]): BPt[] {
  const out = [...pts]
  let changed = true
  while (changed && out.length > 1) {
    changed = false
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const p = out[i]!
      const q = out[(i + 1) % out.length]!
      if (key(p) === key(q) || Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.001) {
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return out
}

/** Mig cercle (|bulge| = 1): es fa amb el centre (AddArc2PointCenterToPolyline). */
const isHalfCircle = (b: number) => Math.abs(Math.abs(b) - 1) < 0.01

/**
 * Polilínia tancada amb arcs (bulge) a la cara activa. `pts` sense punts repetits (`dedupePolyline`). Amb
 * `keepStart`, comença pel primer punt tal com ve (la rampa, `rampStart`, que deixa recte el costat de tancar).
 */
export function closedPolyline(name: string, ptsIn: BPt[], keepStart = false): string[] {
  // Si hi ha algun costat recte, que sigui el de tancar (ClosePolyline, p30-32); si no, s'acaba amb l'arc.
  let pts = ptsIn
  const k = ptsIn.findIndex((p) => Math.abs(bulgeOf(p)) < 1e-9)
  if (k >= 0 && !keepStart) pts = [...ptsIn.slice(k + 1), ...ptsIn.slice(0, k + 1)]
  const first = pts[0]!
  const out = [`CreatePolyline(${cs(name)}, ${num(first[0])}, ${num(first[1])});`]
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % n]!
    const last = i === n - 1
    const b = bulgeOf(p)
    if (Math.abs(b) < 1e-9) {
      if (last) out.push(`ClosePolyline("");`)
      else out.push(`AddSegmentToPolyline(${num(q[0])}, ${num(q[1])});`)
      continue
    }
    const a = arcOf(p, q, b)
    // isClockwise = bulge negatiu; isOver180 = |bulge| > 1 (més de mig cercle).
    if (isHalfCircle(b)) out.push(`AddArc2PointCenterToPolyline(${num(q[0])}, ${num(q[1])}, ${num(a.cx)}, ${num(a.cy)}, ${b < 0});`)
    else out.push(`AddArc2PointRadiusToPolyline(${num(q[0])}, ${num(q[1])}, ${num(a.r)}, ${b < 0}, ${Math.abs(b) > 1});`)
  }
  return out
}

export const rectPts = (x: number, y: number, w: number, h: number): BPt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

/** Ranura de cantells rodons com a contorn: semicercles exactes (bulge 1). */
export function slotPts(c: Extract<Cutout, { kind: "slot" }>): BPt[] {
  const r = Math.min(c.w, c.h) / 2
  if (c.w >= c.h) {
    return [
      [c.x + r, c.y],
      [c.x + c.w - r, c.y, 1],
      [c.x + c.w - r, c.y + c.h],
      [c.x + r, c.y + c.h, 1],
    ]
  }
  return [
    [c.x + c.w, c.y + r],
    [c.x + c.w, c.y + c.h - r, 1],
    [c.x, c.y + c.h - r],
    [c.x, c.y + r, 1],
  ]
}

/**
 * El mateix contorn tancat recorregut a l'inrevés: els punts en ordre invers (comença pel mateix) i cada arc amb el bulge
 * canviat de signe (el bulge va al punt on comença el tram).
 */
export function reverseLoop(pts: BPt[]): BPt[] {
  const n = pts.length
  return pts.map((_, j) => {
    const p = pts[(n - j) % n]!
    const b = -bulgeOf(pts[(2 * n - j - 1) % n]!)
    return Math.abs(b) < 1e-12 ? [p[0], p[1]] : [p[0], p[1], b]
  })
}

/** Antihorari (àrea amb signe positiva, amb els arcs). */
export const isCcw = (pts: BPt[]): boolean => {
  const flat = flatten(pts)
  let area = 0
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % flat.length]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  return area > 0
}

/**
 * Sentit d'un contorn tancat segons el fresat de les regles (`MachineRules.cutMode`; les freses giren a dretes):
 * «conventional» (oposició, l'eina a la dreta de la marxa) = per fora antihorari i per dins horari, com TopSolid;
 * «climb» (concordança) = per fora horari i per dins antihorari; «asIs» = tal com ve (el d'abans).
 */
export function cutLoop(pts: BPt[], side: "inside" | "outside", mode: CutMode): BPt[] {
  if (mode === "asIs" || pts.length < 2) return pts
  const wantCcw = (side === "outside") === (mode === "conventional")
  return isCcw(pts) === wantCcw ? pts : reverseLoop(pts)
}

/** `isClockwise` del `CreateCircleCenterRadius` d'un tall per dins: horari només en oposició (el d'abans, antihorari). */
export const insideCircleClockwise = (mode: CutMode): boolean => mode === "conventional"

const bbox = (pts: [number, number][]) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/**
 * Fresa més grossa que pot resseguir un contorn tancat pel costat `side` (dins = un forat, fora = el
 * contorn de la peça): el radi no pot passar del dels arcs que la fresa recorre per la banda còncava
 * (els «dogbones» de les mortalles, els extrems d'una ranura) i, per dins, Ø < l'amplada més petita
 * de la caixa (− 0,5 mm). Les cantonades vives queden amb el radi de la fresa (inevitable).
 */
export function maxToolDiameter(pts: BPt[], side: "inside" | "outside"): number {
  const flat = flatten(pts)
  let area = 0
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % flat.length]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  const ccw = area > 0
  let max = Infinity
  if (side === "inside") {
    const bb = bbox(flat)
    max = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) - 0.5
  }
  for (let i = 0; i < pts.length; i++) {
    const b = bulgeOf(pts[i]!)
    if (Math.abs(b) < 1e-9) continue
    // Antihorari: l'interior queda a l'esquerra; un arc que gira a l'esquerra (b > 0) el té a la banda còncava.
    const interiorConcave = (b > 0) === ccw
    if (interiorConcave === (side === "inside")) max = Math.min(max, 2 * arcOf(pts[i]!, pts[(i + 1) % pts.length]!, b).r)
  }
  // Arcs ja convertits en segments (els dogbones de les mortalles): girs petits seguits cap al mateix costat.
  const n = flat.length
  const turn = (i: number) => {
    const a = flat[(i - 1 + n) % n]!
    const b = flat[i]!
    const c = flat[(i + 1) % n]!
    const u = [b[0] - a[0], b[1] - a[1]]
    const v = [c[0] - b[0], c[1] - b[1]]
    return { ang: Math.atan2(u[0]! * v[1]! - u[1]! * v[0]!, u[0]! * v[0]! + u[1]! * v[1]!), lu: Math.hypot(u[0]!, u[1]!), lv: Math.hypot(v[0]!, v[1]!) }
  }
  const arcLike = (i: number) => {
    const t = turn(i)
    const deg = Math.abs(t.ang) * (180 / Math.PI)
    return deg > 1 && deg < 35 && t.lu > 0 && t.lv > 0 && t.lu / t.lv < 2.5 && t.lv / t.lu < 2.5 ? Math.sign(t.ang) : 0
  }
  const signs = flat.map((_, i) => arcLike(i))
  for (let i = 0; i < n; i++) {
    if (!signs[i] || signs[(i - 1 + n) % n] === signs[i]) continue
    let j = i
    while (signs[(j + 1) % n] === signs[i] && (j + 1) % n !== i) j++
    if (j - i < 1) continue
    // Cercle per l'inici, el mig i el final de la tirada.
    const p1 = flat[(i - 1 + n) % n]!
    const p2 = flat[(i + Math.floor((j - i) / 2)) % n]!
    const p3 = flat[(j + 1) % n]!
    const d = 2 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]))
    if (Math.abs(d) < 1e-9) continue
    const ab = Math.hypot(p1[0] - p2[0], p1[1] - p2[1])
    const bc = Math.hypot(p2[0] - p3[0], p2[1] - p3[1])
    const ca = Math.hypot(p3[0] - p1[0], p3[1] - p1[1])
    const r = (ab * bc * ca) / Math.abs(d)
    const interiorConcave = (signs[i]! > 0) === ccw
    if (interiorConcave === (side === "inside")) max = Math.min(max, 2 * r)
  }
  return max
}

/**
 * Cantonades vives que la fresa arrodoneix (amb el seu radi): per dins, les que giren cap a l'interior del
 * forat (angle < 180° vist des del forat); per fora, les entrants de la peça. Els girs de menys de 35° (arcs
 * fets de segments) no compten.
 */
export function sharpCorners(pts: BPt[], side: "inside" | "outside"): number {
  const flat = flatten(pts)
  const n = flat.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % n]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  const ccw = area > 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const a = flat[(i - 1 + n) % n]!
    const b = flat[i]!
    const c = flat[(i + 1) % n]!
    const u = [b[0] - a[0], b[1] - a[1]] as const
    const v = [c[0] - b[0], c[1] - b[1]] as const
    const ang = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
    if (Math.abs(ang) < (35 * Math.PI) / 180) continue
    // Antihorari: girar a l'esquerra (ang > 0) és una cantonada convexa del polígon.
    const convex = ang > 0 === ccw
    if (convex === (side === "inside")) count++
  }
  return count
}

/**
 * Un forat de cantell d'una peça amb forma només es pot fer a la cara estàndard si el contorn toca la caixa
 * en aquell punt (tot el diàmetre del forat): si no, la broca entraria a l'aire o en una corba.
 */
export function edgeHoleOnFace(p: Pick<Panel, "length" | "width" | "outline">, h: Pick<Hole, "x" | "y" | "diameter">, edge: EdgeSide): boolean {
  if (!p.outline?.length) return true
  const flat = flatten(p.outline)
  const r = h.diameter / 2
  const along: [number, number][] =
    edge === "bottom" ? [[h.x - r, 0], [h.x, 0], [h.x + r, 0]]
    : edge === "top" ? [[h.x - r, p.width], [h.x, p.width], [h.x + r, p.width]]
    : edge === "left" ? [[0, h.y - r], [0, h.y], [0, h.y + r]]
    : [[p.length, h.y - r], [p.length, h.y], [p.length, h.y + r]]
  return along.every(([x, y]) => distToPolygon(x, y, flat) < 0.05)
}

/**
 * Recorregut de la fresa d'una ranura (x0..x1 × y0..y1, ja retallada a la peça L × W): els extrems oberts
 * (al cantell) amb el centre al cantell, els tancats a r de la vora; zig-zag si cal més d'una passada
 * (solapament del 25 %). `null` si és massa curta per a la fresa.
 */
export function grooveRouterPath(x0: number, x1: number, y0: number, y1: number, L: number, W: number, diameter: number): [number, number][] | null {
  const alongX = x1 - x0 >= y1 - y0
  const [a0, a1, b0, b1, aMax] = alongX ? [x0, x1, y0, y1, L] : [y0, y1, x0, x1, W]
  const width = b1 - b0
  const pt = (a: number, b: number): [number, number] => (alongX ? [a, b] : [b, a])
  const r = diameter / 2
  const start = a0 <= EPS ? a0 : a0 + r
  const end = a1 >= aMax - EPS ? a1 : a1 - r
  if (end < start - EPS) return null
  const lanes =
    diameter >= width - EPS
      ? [(b0 + b1) / 2]
      : (() => {
          const n = Math.ceil((width - diameter) / (0.75 * diameter)) + 1
          return Array.from({ length: n }, (_, k) => b0 + r + ((width - 2 * r) * k) / (n - 1))
        })()
  const pts: [number, number][] = []
  lanes.forEach((c, k) => {
    const [p0, p1] = k % 2 === 0 ? [start, end] : [end, start]
    pts.push(pt(p0, c), pt(p1, c))
  })
  return pts
}
