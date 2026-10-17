/**
 * Regions rectilínies en 2D: un rectangle [0,A]×[0,B] menys una llista de rectangles
 * (ranures, osques, talls). Serveix per calcular els bucles de les cares planes del
 * STEP quan una ranura arriba al cantell de la peça (la cara queda amb una osca o
 * partida en dues) o quan és interior (bucle interior).
 *
 * Resultat: polígons amb un anell exterior en sentit antihorari i anells interiors en
 * sentit horari (la matèria sempre queda a l'esquerra en recórrer l'anell), que és el
 * que demana un B-rep amb la normal cap enfora.
 */
import { pointInPolygon, signedArea } from "../model/polygon"

export interface Rect2 {
  a0: number
  a1: number
  b0: number
  b1: number
}

export type Pt2 = [number, number]

export interface Poly2 {
  outer: Pt2[]
  inners: Pt2[][]
}

const EPS = 1e-6
const key = (p: Pt2): string => `${Math.round(p[0] * 1e4)}|${Math.round(p[1] * 1e4)}`

function uniqSorted(vals: number[]): number[] {
  const s = [...vals].sort((x, y) => x - y)
  const out: number[] = []
  for (const v of s) if (out.length === 0 || v - out[out.length - 1]! > EPS) out.push(v)
  return out
}

function clip(r: Rect2, A: number, B: number): Rect2 | null {
  const c: Rect2 = { a0: Math.max(0, r.a0), a1: Math.min(A, r.a1), b0: Math.max(0, r.b0), b1: Math.min(B, r.b1) }
  if (c.a1 - c.a0 <= EPS || c.b1 - c.b0 <= EPS) return null
  return c
}

/** Treu els vèrtexs col·lineals consecutius d'un anell rectilini. */
function simplify(ring: Pt2[]): Pt2[] {
  const out: Pt2[] = []
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const prev = ring[(i + n - 1) % n]!
    const cur = ring[i]!
    const next = ring[(i + 1) % n]!
    const collinear =
      (Math.abs(prev[0] - cur[0]) < EPS && Math.abs(cur[0] - next[0]) < EPS) ||
      (Math.abs(prev[1] - cur[1]) < EPS && Math.abs(cur[1] - next[1]) < EPS)
    if (!collinear) out.push(cur)
  }
  return out
}

/**
 * [0,A]×[0,B] menys `rects`. Cada rectangle es retalla al domini; els que toquen un
 * costat fan una osca i els que el travessen parteixen la cara.
 */
export function subtractRects(A: number, B: number, rects: Rect2[]): Poly2[] {
  const holes = rects.map((r) => clip(r, A, B)).filter((r): r is Rect2 => r !== null)
  if (holes.length === 0) {
    return [{ outer: [[0, 0], [A, 0], [A, B], [0, B]], inners: [] }]
  }
  const xs = uniqSorted([0, A, ...holes.flatMap((h) => [h.a0, h.a1])])
  const ys = uniqSorted([0, B, ...holes.flatMap((h) => [h.b0, h.b1])])
  const nx = xs.length - 1
  const ny = ys.length - 1
  const solid = (i: number, j: number): boolean => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false
    const cx = (xs[i]! + xs[i + 1]!) / 2
    const cy = (ys[j]! + ys[j + 1]!) / 2
    return !holes.some((h) => cx > h.a0 && cx < h.a1 && cy > h.b0 && cy < h.b1)
  }

  // Segments dirigits amb la matèria a l'esquerra.
  const segs: [Pt2, Pt2][] = []
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      if (!solid(i, j)) continue
      const x0 = xs[i]!
      const x1 = xs[i + 1]!
      const y0 = ys[j]!
      const y1 = ys[j + 1]!
      if (!solid(i, j - 1)) segs.push([[x0, y0], [x1, y0]])
      if (!solid(i + 1, j)) segs.push([[x1, y0], [x1, y1]])
      if (!solid(i, j + 1)) segs.push([[x1, y1], [x0, y1]])
      if (!solid(i - 1, j)) segs.push([[x0, y1], [x0, y0]])
    }

  // Encadena els segments en anells.
  const byStart = new Map<string, [Pt2, Pt2][]>()
  for (const s of segs) {
    const k = key(s[0])
    const list = byStart.get(k)
    if (list) list.push(s)
    else byStart.set(k, [s])
  }
  const used = new Set<[Pt2, Pt2]>()
  const rings: Pt2[][] = []
  for (const start of segs) {
    if (used.has(start)) continue
    const ring: Pt2[] = [start[0]]
    let cur = start
    used.add(cur)
    for (;;) {
      const endKey = key(cur[1])
      if (endKey === key(start[0])) break
      ring.push(cur[1])
      const candidates = (byStart.get(endKey) ?? []).filter((s) => !used.has(s))
      const next = candidates[0]
      if (!next) break
      used.add(next)
      cur = next
    }
    const simple = simplify(ring)
    if (simple.length >= 4 || simple.length === 3) rings.push(simple)
  }

  const outers = rings.filter((r) => signedArea(r) > 0)
  const inners = rings.filter((r) => signedArea(r) < 0)
  const polys: Poly2[] = outers.map((outer) => ({ outer, inners: [] }))
  for (const inner of inners) {
    const p = polys.find((poly) => pointInPolygon(inner[0]!, poly.outer))
    ;(p ?? polys[0])?.inners.push(inner)
  }
  return polys
}

/** Els dos rectangles se solapen (amb marge `gap` de separació mínima). */
export function rectsOverlap(a: Rect2, b: Rect2, gap = 0): boolean {
  return !(a.a1 + gap <= b.a0 || b.a1 + gap <= a.a0 || a.b1 + gap <= b.b0 || b.b1 + gap <= a.b0)
}
