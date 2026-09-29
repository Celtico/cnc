/** Utilitats de polígons 2D (perfils d'objectes i talls passants poligonals). */

export type Pt = [number, number]

/** Àrea amb signe (positiva si els punts van en sentit antihorari). */
export function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!
    const [x1, y1] = pts[(i + 1) % pts.length]!
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

export function polygonArea(pts: Pt[]): number {
  return Math.abs(signedArea(pts))
}

/** Els mateixos punts en sentit antihorari. */
export function ccw(pts: Pt[]): Pt[] {
  return signedArea(pts) < 0 ? [...pts].reverse() : pts
}

export function bounds(pts: Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  return { x0, y0, x1, y1 }
}

/** Punt dins del polígon (regla parell-senar). */
export function pointInPolygon([px, py]: Pt, pts: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

/** Dos segments es creuen (sense comptar els extrems compartits). */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = orient(c, d, a)
  const d2 = orient(c, d, b)
  const d3 = orient(a, b, c)
  const d4 = orient(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** El contorn es talla a si mateix (dos costats no consecutius que es creuen). */
export function selfIntersects(pts: Pt[]): boolean {
  const n = pts.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      if (segmentsCross(pts[i]!, pts[(i + 1) % n]!, pts[j]!, pts[(j + 1) % n]!)) return true
    }
  }
  return false
}

/** El polígon i el rectangle (x0..x1, y0..y1) es toquen amb àrea (marge `tol`). */
export function polygonTouchesRect(pts: Pt[], x0: number, y0: number, x1: number, y1: number, tol = 0.5): boolean {
  const rx0 = x0 + tol, ry0 = y0 + tol, rx1 = x1 - tol, ry1 = y1 - tol
  if (rx1 <= rx0 || ry1 <= ry0) return false
  const b = bounds(pts)
  if (b.x1 <= rx0 || b.x0 >= rx1 || b.y1 <= ry0 || b.y0 >= ry1) return false
  if (pts.some(([x, y]) => x > rx0 && x < rx1 && y > ry0 && y < ry1)) return true
  const corners: Pt[] = [[rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1]]
  if (corners.some((c) => pointInPolygon(c, pts))) return true
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b2 = pts[(i + 1) % pts.length]!
    for (let k = 0; k < 4; k++) if (segmentsCross(a, b2, corners[k]!, corners[(k + 1) % 4]!)) return true
  }
  return false
}

/** Desplaça el perfil perquè la cantonada mínima sigui (0, 0); en retorna la mida. */
export function normalizeProfile(pts: Pt[]): { points: Pt[]; w: number; h: number } {
  const b = bounds(pts)
  const r = (v: number) => Math.round(v * 10) / 10
  return { points: pts.map(([x, y]) => [r(x - b.x0), r(y - b.y0)] as Pt), w: r(b.x1 - b.x0), h: r(b.y1 - b.y0) }
}
