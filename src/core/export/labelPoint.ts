import { bounds, flatten, type Panel } from "../model"
import { pointInRing, rectsOverlap, type Pt2, type Rect2 } from "./region2d"

/**
 * Punt on enganxar l'etiqueta d'una peça (coordenades locals u/v, en mm): dins de la
 * peça amb marge perquè hi càpiga l'etiqueta sencera, lluny de forats, cassoletes,
 * ranures, talls i cantells a laminar. Per defecte el centre; si no és lliure, el punt
 * lliure més proper al centre. Si la peça és més petita que l'etiqueta, el centre.
 * Amb contorn (`outline`), l'etiqueta sencera ha de quedar dins del contorn.
 */

export interface LabelSize {
  w: number
  h: number
}

/** Avery L7165. */
export const DEFAULT_LABEL: LabelSize = { w: 99, h: 68 }

interface LabelOptions {
  label?: LabelSize
  /** Separació mínima entre l'etiqueta i qualsevol mecanitzat o cantell laminat. */
  clearance?: number
  /** Pas de la graella de candidats. */
  step?: number
}

/** Zones a evitar, en coordenades locals de la peça. */
function keepOutRects(p: Panel, clearance: number): Rect2[] {
  const out: Rect2[] = []
  for (const h of p.holes) {
    if (h.face === "edge") continue
    const r = h.diameter / 2 + clearance
    out.push({ a0: h.x - r, a1: h.x + r, b0: h.y - r, b1: h.y + r })
  }
  for (const g of p.grooves) out.push({ a0: g.x - clearance, a1: g.x + g.w + clearance, b0: g.y - clearance, b1: g.y + g.h + clearance })
  for (const c of p.cutouts ?? []) {
    if (c.kind === "circle") {
      const r = c.diameter / 2 + clearance
      out.push({ a0: c.x - r, a1: c.x + r, b0: c.y - r, b1: c.y + r })
    } else if (c.kind === "polygon") {
      const b = bounds(flatten(c.points))
      out.push({ a0: b.x0 - clearance, a1: b.x1 + clearance, b0: b.y0 - clearance, b1: b.y1 + clearance })
    } else out.push({ a0: c.x - clearance, a1: c.x + c.w + clearance, b0: c.y - clearance, b1: c.y + c.h + clearance })
  }
  const band = clearance
  if (p.edges.left) out.push({ a0: -1, a1: band, b0: -1, b1: p.width + 1 })
  if (p.edges.right) out.push({ a0: p.length - band, a1: p.length + 1, b0: -1, b1: p.width + 1 })
  if (p.edges.bottom) out.push({ a0: -1, a1: p.length + 1, b0: -1, b1: band })
  if (p.edges.top) out.push({ a0: -1, a1: p.length + 1, b0: p.width - band, b1: p.width + 1 })
  return out
}

export function labelPoint(p: Panel, options: LabelOptions = {}): { u: number; v: number; fits: boolean } {
  const label = options.label ?? DEFAULT_LABEL
  const clearance = options.clearance ?? 10
  const step = options.step ?? 10
  const L = p.length
  const W = p.width
  const cu = L / 2
  const cv = W / 2
  // L'etiqueta va amb el costat llarg sobre el costat llarg de la peça.
  const hw = label.w / 2
  const hh = label.h / 2
  if (L < label.w + 2 || W < label.h + 2) return { u: cu, v: cv, fits: false }

  const keepOut = keepOutRects(p, clearance)
  const ring: Pt2[] | null = p.outline ? flatten(p.outline) : null
  const free = (u: number, v: number): boolean => {
    const box: Rect2 = { a0: u - hw, a1: u + hw, b0: v - hh, b1: v + hh }
    if (box.a0 < 0 || box.b0 < 0 || box.a1 > L || box.b1 > W) return false
    if (ring && !insideRing(box, ring)) return false
    return !keepOut.some((k) => rectsOverlap(k, box))
  }
  if (free(cu, cv)) return { u: cu, v: cv, fits: true }

  // Graella de candidats, ordenada per distància al centre.
  const candidates: [number, number, number][] = []
  for (let u = hw; u <= L - hw + 1e-9; u += step)
    for (let v = hh; v <= W - hh + 1e-9; v += step) candidates.push([u, v, (u - cu) ** 2 + (v - cv) ** 2])
  candidates.sort((a, b) => a[2] - b[2])
  for (const [u, v] of candidates) if (free(u, v)) return { u: r2(u), v: r2(v), fits: true }
  return fallback(p, ring, cu, cv, step)
}

/** Rectangle dins del contorn: les 4 cantonades a dins i cap vèrtex del contorn a dins del rectangle (osques). */
function insideRing(box: Rect2, ring: Pt2[]): boolean {
  const corners: Pt2[] = [
    [box.a0, box.b0],
    [box.a1, box.b0],
    [box.a1, box.b1],
    [box.a0, box.b1],
  ]
  if (!corners.every((c) => pointInRing(c, ring))) return false
  return !ring.some(([x, y]) => x > box.a0 + 1e-6 && x < box.a1 - 1e-6 && y > box.b0 + 1e-6 && y < box.b1 - 1e-6)
}

/** L'etiqueta no hi cap: el centre, o, si cau fora del contorn, el punt de dins més proper al centre. */
function fallback(p: Panel, ring: Pt2[] | null, cu: number, cv: number, step: number): { u: number; v: number; fits: false } {
  if (!ring || pointInRing([cu, cv], ring)) return { u: cu, v: cv, fits: false }
  let best: [number, number, number] | null = null
  for (let u = step / 2; u < p.length; u += step / 2)
    for (let v = step / 2; v < p.width; v += step / 2) {
      const d = (u - cu) ** 2 + (v - cv) ** 2
      if ((!best || d < best[2]) && pointInRing([u, v], ring)) best = [u, v, d]
    }
  return best ? { u: r2(best[0]), v: r2(best[1]), fits: false } : { u: cu, v: cv, fits: false }
}

const r2 = (v: number): number => Math.round(v * 100) / 100
