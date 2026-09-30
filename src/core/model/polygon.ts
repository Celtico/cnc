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

// --- Perfils amb corbes de Bézier cúbiques ---------------------------------------------

export type Vec2 = [number, number]

/**
 * Node d'un perfil (corba de Bézier composta, tancada). Els manegadors són relatius al node:
 * `in` = el que arriba del costat anterior, `out` = el que surt cap al següent. Un costat és
 * una cúbica si té algun manegador als seus extrems; si no, un arc (bulge `b` del node on
 * comença) o una recta. `t` és només per a l'editor: cantonada (manegadors independents),
 * suau (alineats) o simètric (alineats i iguals).
 */
export interface PNode {
  x: number
  y: number
  in?: Vec2
  out?: Vec2
  b?: number
  t?: "corner" | "smooth" | "symmetric"
}

/** Perfil guardat: nodes o, dels perfils antics, punts [x, y, bulge]. */
export type ProfilePoint = PNode | BPt

export function toNodes(pts: ProfilePoint[]): PNode[] {
  return pts.map((p) => (Array.isArray(p) ? (p[2] ? { x: p[0], y: p[1], b: p[2] } : { x: p[0], y: p[1] }) : p))
}

const lenV = (v: Vec2) => Math.hypot(v[0], v[1])

/** Tipus del costat i → i+1. */
export function edgeOf(nodes: PNode[], i: number): { kind: "line" } | { kind: "arc"; b: number } | { kind: "cubic"; p1: Vec2; p2: Vec2 } {
  const a = nodes[i]!
  const c = nodes[(i + 1) % nodes.length]!
  if ((a.out && lenV(a.out) > 1e-9) || (c.in && lenV(c.in) > 1e-9)) {
    return { kind: "cubic", p1: [a.x + (a.out?.[0] ?? 0), a.y + (a.out?.[1] ?? 0)], p2: [c.x + (c.in?.[0] ?? 0), c.y + (c.in?.[1] ?? 0)] }
  }
  if (a.b && Math.abs(a.b) > 1e-9) return { kind: "arc", b: a.b }
  return { kind: "line" }
}

export function cubicAt(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]
}

/** El contorn en punts (cúbiques i arcs mostrejats): per dibuixar, xocs i mides. */
export function sampleProfile(nodes: PNode[], perCubic = 32): Pt[] {
  const out: Pt[] = []
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const a = nodes[i]!
    const c = nodes[(i + 1) % n]!
    out.push([a.x, a.y])
    const e = edgeOf(nodes, i)
    if (e.kind === "cubic") {
      for (let k = 1; k < perCubic; k++) out.push(cubicAt([a.x, a.y], e.p1, e.p2, [c.x, c.y], k / perCubic))
    } else if (e.kind === "arc") {
      const f = flatten([[a.x, a.y, e.b], [c.x, c.y]])
      // flatten tanca el contorn: els punts de l'arc van de l'1 fins abans del punt final.
      const arcPts = f.slice(1, f.length - 1)
      out.push(...arcPts)
    }
  }
  return out
}

/** Cercle per tres punts (null si són alineats). */
function circle3(a: Vec2, m: Vec2, e: Vec2): { cx: number; cy: number; r: number } | null {
  const d = 2 * (a[0] * (m[1] - e[1]) + m[0] * (e[1] - a[1]) + e[0] * (a[1] - m[1]))
  if (Math.abs(d) < 1e-9) return null
  const a2 = a[0] * a[0] + a[1] * a[1], m2 = m[0] * m[0] + m[1] * m[1], e2 = e[0] * e[0] + e[1] * e[1]
  const cx = (a2 * (m[1] - e[1]) + m2 * (e[1] - a[1]) + e2 * (a[1] - m[1])) / d
  const cy = (a2 * (e[0] - m[0]) + m2 * (a[0] - e[0]) + e2 * (m[0] - a[0])) / d
  return { cx, cy, r: Math.hypot(a[0] - cx, a[1] - cy) }
}

/**
 * Una cúbica en arcs i rectes (per a la CNC: G2/G3 exactes al DXF i cares cilíndriques al
 * STEP), amb error màxim `tol` mm. Retorna els punts d'inici de cada tram amb el seu bulge
 * (sense el punt final).
 */
export function cubicToArcs(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tol = 0.02): BPt[] {
  const out: BPt[] = []
  const B = (t: number) => cubicAt(p0, p1, p2, p3, t)
  const fit = (t0: number, t1: number, depth: number): void => {
    const A = B(t0), E = B(t1), M = B((t0 + t1) / 2)
    // Punts de control de l'error, repartits pel tram.
    const qs = [0.125, 0.25, 0.375, 0.625, 0.75, 0.875].map((f) => B(t0 + (t1 - t0) * f))
    const chord = Math.hypot(E[0] - A[0], E[1] - A[1])
    // Recta?
    const distLine = (p: Vec2) => (chord < 1e-9 ? Math.hypot(p[0] - A[0], p[1] - A[1]) : Math.abs((E[0] - A[0]) * (A[1] - p[1]) - (A[0] - p[0]) * (E[1] - A[1])) / chord)
    if (Math.max(distLine(M), ...qs.map(distLine)) <= tol) {
      out.push([A[0], A[1]])
      return
    }
    const c = circle3(A, M, E)
    if (c && depth > 0) {
      const err = Math.max(...qs.map((q) => Math.abs(Math.hypot(q[0] - c.cx, q[1] - c.cy) - c.r)))
      if (err <= tol || depth >= 14) {
        // Escombrada de A a E passant per M: el sentit el dona el gir A → M → E.
        const turn = (M[0] - A[0]) * (E[1] - M[1]) - (M[1] - A[1]) * (E[0] - M[0])
        let sweep = Math.atan2(E[1] - c.cy, E[0] - c.cx) - Math.atan2(A[1] - c.cy, A[0] - c.cx)
        if (turn > 0) while (sweep <= 0) sweep += Math.PI * 2
        else while (sweep >= 0) sweep -= Math.PI * 2
        out.push([A[0], A[1], Math.tan(sweep / 4)])
        return
      }
    }
    if (depth >= 14) {
      out.push([A[0], A[1]])
      return
    }
    const tm = (t0 + t1) / 2
    fit(t0, tm, depth + 1)
    fit(tm, t1, depth + 1)
  }
  fit(0, 1, 1)
  return out
}

/** El perfil com a contorn de rectes i arcs (el que es talla i s'exporta). */
export function profileToOutline(nodes: PNode[], tol = 0.02): BPt[] {
  const out: BPt[] = []
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const a = nodes[i]!
    const c = nodes[(i + 1) % n]!
    const e = edgeOf(nodes, i)
    if (e.kind === "cubic") out.push(...cubicToArcs([a.x, a.y], e.p1, e.p2, [c.x, c.y], tol))
    else if (e.kind === "arc") out.push([a.x, a.y, e.b])
    else out.push([a.x, a.y])
  }
  const r = (v: number) => Math.round(v * 1000) / 1000
  return out.map((p) => (p[2] ? [r(p[0]), r(p[1]), p[2]] : [r(p[0]), r(p[1])]))
}

/** Parteix el costat i pel mig conservant-ne la forma (de Casteljau a les cúbiques). */
export function splitEdge(nodes: PNode[], i: number): PNode[] {
  const n = nodes.length
  const a = nodes[i]!
  const c = nodes[(i + 1) % n]!
  const e = edgeOf(nodes, i)
  let a2: PNode, m: PNode, c2: PNode
  if (e.kind === "cubic") {
    const p0: Vec2 = [a.x, a.y], p3: Vec2 = [c.x, c.y]
    const mid = (u: Vec2, v: Vec2): Vec2 => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2]
    const q0 = mid(p0, e.p1), q1 = mid(e.p1, e.p2), q2 = mid(e.p2, p3)
    const r0 = mid(q0, q1), r1 = mid(q1, q2)
    const s = mid(r0, r1)
    a2 = { ...a, out: [q0[0] - a.x, q0[1] - a.y] }
    m = { x: s[0], y: s[1], in: [r0[0] - s[0], r0[1] - s[1]], out: [r1[0] - s[0], r1[1] - s[1]], t: "smooth" }
    c2 = { ...c, in: [q2[0] - c.x, q2[1] - c.y] }
  } else if (e.kind === "arc") {
    const half = Math.tan(Math.atan(e.b) / 2)
    const f = arcOf([a.x, a.y], [c.x, c.y], e.b)
    const t = f.start + f.sweep / 2
    a2 = { ...a, b: half }
    m = { x: f.cx + f.r * Math.cos(t), y: f.cy + f.r * Math.sin(t), b: half }
    c2 = c
  } else {
    a2 = a
    m = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 }
    c2 = c
  }
  const out = [...nodes]
  out[i] = a2
  out[(i + 1) % n] = c2
  out.splice(i + 1, 0, m)
  return out
}

/** Manegadors automàtics d'un node suau: tangent paral·lela a veí anterior → veí següent. */
export function autoHandles(nodes: PNode[], i: number): PNode {
  const n = nodes.length
  const p = nodes[(i - 1 + n) % n]!
  const q = nodes[(i + 1) % n]!
  const v = nodes[i]!
  const dx = q.x - p.x, dy = q.y - p.y
  const l = Math.hypot(dx, dy) || 1
  const lin = Math.hypot(v.x - p.x, v.y - p.y) / 3
  const lout = Math.hypot(q.x - v.x, q.y - v.y) / 3
  return { ...v, b: undefined, in: [(-dx / l) * lin, (-dy / l) * lin], out: [(dx / l) * lout, (dy / l) * lout], t: "smooth" }
}

/** Mou el manegador `which` d'un node respectant-ne el tipus. */
export function moveHandle(node: PNode, which: "in" | "out", h: Vec2): PNode {
  const other = which === "in" ? "out" : "in"
  const next: PNode = { ...node, [which]: h, b: undefined }
  const o = node[other]
  if (node.t === "symmetric") next[other] = [-h[0], -h[1]]
  else if (node.t === "smooth" && o) {
    const l = lenV(o)
    const lh = lenV(h) || 1
    next[other] = [(-h[0] / lh) * l, (-h[1] / lh) * l]
  }
  return next
}

/**
 * Costat i corbat perquè passi pel punt `m` al seu mig: cúbica equivalent a la quadràtica que
 * hi passa. Els nodes dels extrems queden com a cantonades (no afecta els costats veïns).
 */
export function bendEdge(nodes: PNode[], i: number, m: Vec2): PNode[] {
  const n = nodes.length
  const a = nodes[i]!
  const j = (i + 1) % n
  const c = nodes[j]!
  const C: Vec2 = [(4 * m[0] - a.x - c.x) / 2, (4 * m[1] - a.y - c.y) / 2]
  const out = [...nodes]
  out[i] = { ...a, b: undefined, out: [((C[0] - a.x) * 2) / 3, ((C[1] - a.y) * 2) / 3], t: a.in ? "corner" : a.t }
  out[j] = { ...c, in: [((C[0] - c.x) * 2) / 3, ((C[1] - c.y) * 2) / 3], t: c.out ? "corner" : c.t }
  return out
}

/** Desplaça el perfil perquè la cantonada mínima (corbes incloses) sigui (0, 0). */
export function normalizeNodes(nodes: PNode[]): { points: PNode[]; w: number; h: number } {
  const b = bounds(sampleProfile(nodes, 64))
  const r = (v: number) => Math.round(v * 100) / 100
  const rv = (v?: Vec2): Vec2 | undefined => (v && lenV(v) > 1e-9 ? [r(v[0]), r(v[1])] : undefined)
  const points = nodes.map((p) => {
    const q: PNode = { x: r(p.x - b.x0), y: r(p.y - b.y0) }
    const hi = rv(p.in), ho = rv(p.out)
    if (hi) q.in = hi
    if (ho) q.out = ho
    if (p.b && Math.abs(p.b) > 1e-9 && !ho) q.b = p.b
    if (p.t && p.t !== "corner" && (hi || ho)) q.t = p.t
    return q
  })
  return { points, w: r(b.x1 - b.x0), h: r(b.y1 - b.y0) }
}

/** Arrodoneix la cantonada `i` (entre dos costats rectes) amb un arc de radi `r`. */
export function filletNode(nodes: PNode[], i: number, r: number): PNode[] | null {
  const n = nodes.length
  if (edgeOf(nodes, (i - 1 + n) % n).kind !== "line" || edgeOf(nodes, i).kind !== "line") return null
  const pts: BPt[] = nodes.map((q) => [q.x, q.y])
  const f = filletCorner(pts, i, r)
  if (!f) return null
  const t1 = f[i]!, t2 = f[i + 1]!
  const out = [...nodes]
  out.splice(i, 1, { x: t1[0], y: t1[1], b: t1[2] }, { x: t2[0], y: t2[1] })
  return out
}
