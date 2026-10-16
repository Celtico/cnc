import type { EdgeSide, Hole, HoleFace, Panel, Placement, Vec3 } from "../model"

/** Arrodoneix a la centèsima per evitar soroll de coma flotant. */
export const r = (v: number): number => Math.round(v * 100) / 100

export const X: Vec3 = [1, 0, 0]
export const Y: Vec3 = [0, 1, 0]
export const Z: Vec3 = [0, 0, 1]
export const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]

export function placement(origin: Vec3, xAxis: Vec3, yAxis: Vec3, zAxis: Vec3, explodeDir: Vec3): Placement {
  return { origin: origin.map(r) as Vec3, xAxis, yAxis, zAxis, explodeDir }
}

/** Caixa englobant d'una peça (coordenades de la composició). */
/** El mínim d'una peça per saber-ne la caixa: col·locació i mides. */
export interface Placed {
  placement: { origin: readonly number[]; xAxis: readonly number[]; yAxis: readonly number[]; zAxis: readonly number[] }
  length: number
  width: number
  thickness: number
}

export function panelBox(p: Placed): { min: Vec3; max: Vec3 } {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness])
        for (let i = 0; i < 3; i++) {
          const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
          min[i] = Math.min(min[i]!, v)
          max[i] = Math.max(max[i]!, v)
        }
  return { min, max }
}

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Punt del moble → coordenades locals de la peça (abans de normalitzar). */
export function toLocal(p: Panel, w: Vec3): Vec3 {
  const { origin: o, xAxis, yAxis, zAxis } = p.placement
  const d: Vec3 = [w[0] - o[0], w[1] - o[1], w[2] - o[2]]
  return [r(dot(d, xAxis)), r(dot(d, yAxis)), r(dot(d, zAxis))]
}

/** Coordenades locals → punt del moble. */
export function toWorld(p: Panel, l: Vec3): Vec3 {
  const { origin: o, xAxis, yAxis, zAxis } = p.placement
  return [
    r(o[0] + l[0] * xAxis[0] + l[1] * yAxis[0] + l[2] * zAxis[0]),
    r(o[1] + l[0] * xAxis[1] + l[1] * yAxis[1] + l[2] * zAxis[1]),
    r(o[2] + l[0] * xAxis[2] + l[1] * yAxis[2] + l[2] * zAxis[2]),
  ]
}

const EPS = 0.51

/** Quina cara de la peça toca el punt (per la z local). Null si és a mig gruix. */
export function faceAt(p: Panel, local: Vec3): HoleFace | null {
  if (Math.abs(local[2] - p.thickness) < EPS) return "A"
  if (Math.abs(local[2]) < EPS) return "B"
  return null
}

/** Quin cantell de la peça toca el punt (per x/y locals). Null si és a l'interior. */
export function edgeAt(p: Panel, local: Vec3): EdgeSide | null {
  if (Math.abs(local[0]) < EPS) return "left"
  if (Math.abs(local[0] - p.length) < EPS) return "right"
  if (Math.abs(local[1]) < EPS) return "bottom"
  if (Math.abs(local[1] - p.width) < EPS) return "top"
  return null
}

function holeKey(h: Hole): string {
  return [h.face, h.edge ?? "", h.x, h.y, h.diameter, h.depth].join("|")
}

/** Afegeix un forat si no n'hi ha un d'idèntic. */
function addHole(p: Panel, h: Hole): boolean {
  const key = holeKey(h)
  if (p.holes.some((e) => holeKey(e) === key)) return false
  p.holes.push(h)
  return true
}

/**
 * Forat de cara a `panel` al punt del moble `w` (que ha de ser sobre una de les cares).
 * Retorna false si el punt no és sobre la peça.
 */
export function addFaceHole(
  panel: Panel,
  w: Vec3,
  spec: { diameter: number; depth: number; tag?: string },
): boolean {
  const h = faceHoleAt(panel, w, spec)
  return h ? addHole(panel, h) : false
}

/** El forat de cara que `addFaceHole` posaria (null si el punt no és sobre una cara de la peça). */
function faceHoleAt(panel: Panel, w: Vec3, spec: { diameter: number; depth: number; tag?: string }, inset = -EPS): Hole | null {
  const l = toLocal(panel, w)
  const face = faceAt(panel, l)
  if (!face || l[0] < inset || l[0] > panel.length - inset || l[1] < inset || l[1] > panel.width - inset) return null
  return { x: l[0], y: l[1], diameter: spec.diameter, depth: spec.depth, face, ...(spec.tag ? { tag: spec.tag } : {}) }
}

/** Forat de cantell a `panel` al punt del moble `w` (sobre el contorn, a mig gruix). */
export function addEdgeHole(
  panel: Panel,
  w: Vec3,
  spec: { diameter: number; depth: number; tag?: string },
): boolean {
  const h = edgeHoleAt(panel, w, spec)
  return h ? addHole(panel, h) : false
}

/** El forat de cantell que `addEdgeHole` posaria (null si el punt no és sobre el contorn). */
function edgeHoleAt(panel: Panel, w: Vec3, spec: { diameter: number; depth: number; tag?: string }, inset = -EPS): Hole | null {
  const l = toLocal(panel, w)
  const edge = edgeAt(panel, l)
  if (!edge) return null
  // El punt ha de ser sobre el contorn de la peça, no només sobre la seva recta (amb `inset`: el forat sencer a dins).
  const along = edge === "left" || edge === "right" ? l[1] : l[0]
  const span = edge === "left" || edge === "right" ? panel.width : panel.length
  if (l[0] < -EPS || l[0] > panel.length + EPS || l[1] < -EPS || l[1] > panel.width + EPS) return null
  if (along < inset || along > span - inset) return null
  return { x: l[0], y: l[1], diameter: spec.diameter, depth: spec.depth, face: "edge", edge, ...(spec.tag ? { tag: spec.tag } : {}) }
}

interface DowelSpec {
  diameter: number
  faceDepth: number
  edgeDepth: number
}

/**
 * Unió amb espigues: la peça que hi topa (`butt`) rep forats de cantell, la que continua
 * (`through`) rep forats de cara. `points` són els centres de les espigues, al moble,
 * sobre la superfície de contacte.
 */
export function dowelJoint(butt: Panel, through: Panel, points: Vec3[], spec: DowelSpec, tag = "dowel", buttShift?: Vec3): number {
  // Mai mitja unió: si l'espiga no cap sencera a les dues peces (forat dins del cantell i de la cara), no es fa cap dels
  // dos forats. Retorna quantes espigues s'han fet.
  // `buttShift`: la peça que hi topa s'atura una mica abans de la cara (folgança de les peces de dins): el forat de
  // cantell és al seu cantell (el punt desplaçat) i el de cara, a la cara de l'altra (el punt), a la mateixa línia.
  const rad = spec.diameter / 2
  let n = 0
  for (const w of points) {
    const we: Vec3 = buttShift ? [w[0] + buttShift[0], w[1] + buttShift[1], w[2] + buttShift[2]] : w
    const e = edgeHoleAt(butt, we, { diameter: spec.diameter, depth: spec.edgeDepth, tag }, rad - EPS)
    const f = faceHoleAt(through, w, { diameter: spec.diameter, depth: spec.faceDepth, tag }, rad - EPS)
    if (!e || !f) continue
    addHole(butt, e)
    addHole(through, f)
    n++
  }
  return n
}

/**
 * Espigues al llarg d'un tram [lo, hi]: dues a `offset` dels extrems si hi caben (tram ≥ 2·offset + Ø), una al mig si
 * el tram és més curt però hi cap el forat amb 2 mm de matèria a cada costat, i cap si no.
 */
export function dowelsAlong(lo: number, hi: number, offset: number, diameter: number): number[] {
  const span = hi - lo
  if (span >= 2 * offset + diameter) return [r(lo + offset), r(hi - offset)]
  if (span >= diameter + 4) return [r((lo + hi) / 2)]
  return []
}

/** Tres punts repartits entre `a` i `b` a `endOffset` dels extrems i al mig. */
export function threeAlong(a: number, b: number, endOffset: number): number[] {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return [lo + endOffset, (lo + hi) / 2, hi - endOffset].map(r)
}

/** Posicions Y d'una filera System 32 entre `yFrom` i `yTo` (des de la base de la zona). */
export function system32Ys(yFrom: number, yTo: number, edgeOffset: number, pitch: number): number[] {
  const ys: number[] = []
  for (let y = yFrom + edgeOffset; y <= yTo - edgeOffset + 1e-9; y += pitch) ys.push(r(y))
  return ys
}

/** Nombre de frontisses segons l'alçada de la porta (el mateix per a tots els constructors). */
export function hingeCount(height: number): number {
  if (height <= 900) return 2
  if (height <= 1600) return 3
  if (height <= 2100) return 4
  return 5
}

/** Valor de `candidates` més proper a `target`. */
export function snap(target: number, candidates: readonly number[]): number {
  let best = candidates[0] ?? target
  for (const c of candidates) if (Math.abs(c - target) < Math.abs(best - target)) best = c
  return best
}
