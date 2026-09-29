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

/**
 * Desplaça el perfil perquè la cantonada mínima (arcs inclosos) sigui (0, 0); en retorna la
 * mida. Conserva els bulges.
 */
export function normalizeProfile(pts: BPt[]): { points: BPt[]; w: number; h: number } {
  const b = bounds(flatten(pts, Math.PI / 90))
  const r = (v: number) => Math.round(v * 10) / 10
  return {
    points: pts.map((p) => (bulgeOf(p) ? [r(p[0] - b.x0), r(p[1] - b.y0), p[2]!] : [r(p[0] - b.x0), r(p[1] - b.y0)]) as BPt),
    w: r(b.x1 - b.x0),
    h: r(b.y1 - b.y0),
  }
}

// --- Contorns amb arcs (bulge, com al DXF) ---------------------------------------------

/**
 * Punt d'un contorn amb el «bulge» opcional del costat que en surt (fins al punt següent):
 * 0 = recte; tan(angle/4) de l'arc, positiu si l'arc gira en sentit antihorari (com al DXF).
 */
export type BPt = [number, number] | [number, number, number]

export const bulgeOf = (p: BPt): number => p[2] ?? 0

/** Centre, radi, angle inicial i escombrada (amb signe) de l'arc de P a Q amb bulge b ≠ 0. */
export function arcOf(p: BPt, q: BPt, b: number): { cx: number; cy: number; r: number; start: number; sweep: number } {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const c = Math.hypot(dx, dy)
  const mx = (p[0] + q[0]) / 2
  const my = (p[1] + q[1]) / 2
  // Distància (amb signe) del punt mig de la corda al centre, cap a l'esquerra de P→Q.
  const k = (c * (1 - b * b)) / (4 * b)
  const cx = mx + (-dy / c) * k
  const cy = my + (dx / c) * k
  const r = Math.hypot(p[0] - cx, p[1] - cy)
  return { cx, cy, r, start: Math.atan2(p[1] - cy, p[0] - cx), sweep: 4 * Math.atan(b) }
}

/** Fletxa (mm, amb signe) d'un bulge sobre una corda de llargada c, i a la inversa. */
export const sagittaOf = (b: number, c: number): number => (b * c) / 2
export const bulgeFromSagitta = (s: number, c: number): number => (c > 0 ? (2 * s) / c : 0)

/** Contorn amb arcs → polígon (els arcs, en segments d'uns `step` radiants com a màxim). */
export function flatten(pts: BPt[], step = Math.PI / 24): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % pts.length]!
    out.push([p[0], p[1]])
    const b = bulgeOf(p)
    if (Math.abs(b) < 1e-9) continue
    const a = arcOf(p, q, b)
    const n = Math.max(2, Math.ceil(Math.abs(a.sweep) / step))
    for (let k = 1; k < n; k++) {
      const t = a.start + (a.sweep * k) / n
      out.push([a.cx + a.r * Math.cos(t), a.cy + a.r * Math.sin(t)])
    }
  }
  return out
}

/** El mateix contorn recorregut al revés (els bulges canvien de costat i de signe). */
export function reverseB(pts: BPt[]): BPt[] {
  const n = pts.length
  return pts.map((_, i) => {
    const p = pts[n - 1 - i]!
    // El costat que surt del nou punt i és l'antic costat que arribava a p, invertit.
    const prev = pts[(2 * n - 2 - i) % n]!
    const b = -bulgeOf(prev)
    return Math.abs(b) < 1e-12 ? [p[0], p[1]] : [p[0], p[1], b]
  })
}

/** El contorn en sentit antihorari (amb els arcs). */
export function ccwB(pts: BPt[]): BPt[] {
  return signedArea(flatten(pts)) < 0 ? reverseB(pts) : pts
}

/** Arrodoneix la cantonada `i` amb radi `r`: la substitueix per dos punts i un arc tangent. */
export function filletCorner(pts: BPt[], i: number, r: number): BPt[] | null {
  const n = pts.length
  const a = pts[(i - 1 + n) % n]!
  const v = pts[i]!
  const c = pts[(i + 1) % n]!
  // Només entre dos costats rectes.
  if (Math.abs(bulgeOf(a)) > 1e-9 || Math.abs(bulgeOf(v)) > 1e-9) return null
  const u1: Pt = [a[0] - v[0], a[1] - v[1]]
  const u2: Pt = [c[0] - v[0], c[1] - v[1]]
  const l1 = Math.hypot(u1[0], u1[1])
  const l2 = Math.hypot(u2[0], u2[1])
  if (l1 < 1e-6 || l2 < 1e-6) return null
  const cosA = (u1[0] * u2[0] + u1[1] * u2[1]) / (l1 * l2)
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosA)))
  if (alpha < 1e-3 || Math.PI - alpha < 1e-3) return null
  const t = r / Math.tan(alpha / 2)
  if (t > l1 - 0.1 || t > l2 - 0.1) return null
  const t1: Pt = [v[0] + (u1[0] / l1) * t, v[1] + (u1[1] / l1) * t]
  const t2: Pt = [v[0] + (u2[0] / l2) * t, v[1] + (u2[1] / l2) * t]
  // Gir a l'esquerra (a → v → c) = arc antihorari = bulge positiu.
  const turn = (v[0] - a[0]) * (c[1] - v[1]) - (v[1] - a[1]) * (c[0] - v[0])
  const b = Math.tan((Math.PI - alpha) / 4) * Math.sign(turn)
  const r1 = (x: number) => Math.round(x * 100) / 100
  return [...pts.slice(0, i), [r1(t1[0]), r1(t1[1]), b], [r1(t2[0]), r1(t2[1])], ...pts.slice(i + 1)]
}
