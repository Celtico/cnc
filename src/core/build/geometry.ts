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
export function addHole(p: Panel, h: Hole): boolean {
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
  const l = toLocal(panel, w)
  const face = faceAt(panel, l)
  if (!face || l[0] < -EPS || l[0] > panel.length + EPS || l[1] < -EPS || l[1] > panel.width + EPS) return false
  return addHole(panel, { x: l[0], y: l[1], diameter: spec.diameter, depth: spec.depth, face, ...(spec.tag ? { tag: spec.tag } : {}) })
}

/** Forat de cantell a `panel` al punt del moble `w` (sobre el contorn, a mig gruix). */
export function addEdgeHole(
  panel: Panel,
  w: Vec3,
  spec: { diameter: number; depth: number; tag?: string },
): boolean {
  const l = toLocal(panel, w)
  const edge = edgeAt(panel, l)
  if (!edge) return false
  return addHole(panel, {
    x: l[0],
    y: l[1],
    diameter: spec.diameter,
    depth: spec.depth,
    face: "edge",
    edge,
    ...(spec.tag ? { tag: spec.tag } : {}),
  })
}

export interface DowelSpec {
  diameter: number
  faceDepth: number
  edgeDepth: number
}

/**
 * Unió amb espigues: la peça que hi topa (`butt`) rep forats de cantell, la que continua
 * (`through`) rep forats de cara. `points` són els centres de les espigues, al moble,
 * sobre la superfície de contacte.
 */
export function dowelJoint(butt: Panel, through: Panel, points: Vec3[], spec: DowelSpec, tag = "dowel"): void {
  for (const w of points) {
    addEdgeHole(butt, w, { diameter: spec.diameter, depth: spec.edgeDepth, tag })
    addFaceHole(through, w, { diameter: spec.diameter, depth: spec.faceDepth, tag })
  }
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

/** Valor de `candidates` més proper a `target`. */
export function snap(target: number, candidates: readonly number[]): number {
  let best = candidates[0] ?? target
  for (const c of candidates) if (Math.abs(c - target) < Math.abs(best - target)) best = c
  return best
}
