import type { CamPath, Pt } from "./types"

/** Geometria de la vista CAM: arcs, camins en punts, àrees i òfsets per dibuixar el centre de l'eina. */

export const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Centre d'un arc per dos punts i radi (manual Table 22): horari / antihorari, més o menys de 180°. */
export function arcCenter(p0: Pt, p1: Pt, r: number, cw: boolean, over180: boolean): Pt {
  const d = dist(p0, p1) / 2
  const m: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]
  if (d < 1e-9) return m
  const h = Math.sqrt(Math.max(0, r * r - d * d))
  const ux = (p1[0] - p0[0]) / (2 * d)
  const uy = (p1[1] - p0[1]) / (2 * d)
  // Antihorari i < 180°: el centre a l'esquerra de la corda.
  const sign = (cw ? -1 : 1) * (over180 ? -1 : 1)
  return [m[0] - sign * h * uy, m[1] + sign * h * ux]
}

export function circumcenter(a: Pt, b: Pt, c: Pt): Pt | null {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  if (Math.abs(d) < 1e-12) return null
  const a2 = a[0] ** 2 + a[1] ** 2
  const b2 = b[0] ** 2 + b[1] ** 2
  const c2 = c[0] ** 2 + c[1] ** 2
  return [(a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d, (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d]
}

export const lastPoint = (p: CamPath): Pt => (p.segs.length ? p.segs[p.segs.length - 1]!.to : p.start)

/** Punts d'un camí (els arcs a trams de ≤ 5°). Tancat: sense repetir el primer al final. */
export function flattenPath(p: CamPath, stepDeg = 5): Pt[] {
  const out: Pt[] = [p.start]
  let cur = p.start
  for (const s of p.segs) {
    if (s.arc) {
      const { c, cw } = s.arc
      const r = (dist(cur, c) + dist(s.to, c)) / 2
      const a0 = Math.atan2(cur[1] - c[1], cur[0] - c[0])
      const a1 = Math.atan2(s.to[1] - c[1], s.to[0] - c[0])
      let sweep = cw ? a0 - a1 : a1 - a0
      while (sweep <= 1e-9) sweep += 2 * Math.PI
      if (dist(cur, s.to) < 1e-9) sweep = 2 * Math.PI
      const n = Math.max(2, Math.ceil(sweep / ((stepDeg * Math.PI) / 180)))
      for (let k = 1; k < n; k++) {
        const a = a0 + (cw ? -1 : 1) * (sweep * k) / n
        out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)])
      }
    }
    out.push(s.to)
    cur = s.to
  }
  const clean = out.filter((q, i) => i === 0 || dist(q, out[i - 1]!) > 1e-6)
  if (p.closed && clean.length > 1 && dist(clean[0]!, clean[clean.length - 1]!) < 1e-6) clean.pop()
  return clean
}

/**
 * Òfset d'una polilínia a `s` mm cap a l'esquerra del sentit de la marxa (negatiu: cap a la dreta). Cantonades que
 * s'obren: arc al voltant del vèrtex (com fa el centre de l'eina); que es tanquen: intersecció de les dues rectes.
 * Aproximat, només per dibuixar: si l'eina no hi cap (una osca més estreta que el Ø), surten llaços.
 */
export function offsetPolyline(ptsIn: Pt[], closed: boolean, s: number): Pt[] {
  const pts = ptsIn.filter((q, i) => i === 0 || dist(q, ptsIn[i - 1]!) > 1e-6)
  if (closed && pts.length > 1 && dist(pts[0]!, pts[pts.length - 1]!) < 1e-6) pts.pop()
  if (Math.abs(s) < 1e-9 || pts.length < 2) return pts.slice()
  const nSeg = closed ? pts.length : pts.length - 1
  const dirs: Pt[] = []
  const norms: Pt[] = []
  for (let i = 0; i < nSeg; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const l = dist(a, b)
    const d: Pt = [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    dirs.push(d)
    norms.push([-d[1], d[0]])
  }
  const off = (p: Pt, n: Pt): Pt => [p[0] + s * n[0], p[1] + s * n[1]]
  const out: Pt[] = []
  const join = (i: number) => {
    // Vèrtex i entre el tram i − 1 i el tram i.
    const P = pts[i]!
    const k0 = (i - 1 + nSeg) % nSeg
    const d0 = dirs[k0]!
    const d1 = dirs[i]!
    const n0 = norms[k0]!
    const n1 = norms[i]!
    const cross = d0[0] * d1[1] - d0[1] * d1[0]
    const dot = d0[0] * d1[0] + d0[1] * d1[1]
    if (Math.abs(cross) < 1e-9 && dot > 0) {
      out.push(off(P, n1))
      return
    }
    if (cross * s > 0) {
      // Es tanca: intersecció de les dues rectes desplaçades (limitada, per als girs gairebé enrere).
      const A = off(P, n0)
      const t = (((off(P, n1)[0] - A[0]) * d1[1] - (off(P, n1)[1] - A[1]) * d1[0]) / cross)
      const X: Pt = [A[0] + t * d0[0], A[1] + t * d0[1]]
      if (dist(X, P) <= 4 * Math.abs(s)) out.push(X)
      else out.push(A, off(P, n1))
      return
    }
    // S'obre: arc de radi |s| al voltant del vèrtex.
    const a0 = Math.atan2(s * n0[1], s * n0[0])
    let a1 = Math.atan2(s * n1[1], s * n1[0])
    const ccw = cross > 0
    if (ccw) while (a1 < a0) a1 += 2 * Math.PI
    else while (a1 > a0) a1 -= 2 * Math.PI
    const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 18)))
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((a1 - a0) * k) / steps
      out.push([P[0] + Math.abs(s) * Math.cos(a), P[1] + Math.abs(s) * Math.sin(a)])
    }
  }
  if (closed) {
    for (let i = 0; i < pts.length; i++) join(i)
  } else {
    out.push(off(pts[0]!, norms[0]!))
    for (let i = 1; i < pts.length - 1; i++) join(i)
    out.push(off(pts[pts.length - 1]!, norms[nSeg - 1]!))
  }
  return out
}

/**
 * Un recorregut amb Z (`CreateToolpath`) com a punts 3D (x, y, z; z 0 a la cara de dalt): els arcs en trossos, amb la Z
 * repartida. `null` si no porta cap Z.
 */
export function toolpath3(p: CamPath, stepDeg = 5): [number, number, number][] | null {
  if (p.startZ === undefined && !p.segs.some((s) => s.z !== undefined)) return null
  let z = p.startZ ?? 0
  const out: [number, number, number][] = [[p.start[0], p.start[1], z]]
  let cur = p.start
  for (const s of p.segs) {
    const z1 = s.z ?? z
    if (s.arc) {
      const pts = flattenPath({ name: "", kind: "polyline", start: cur, segs: [{ to: s.to, arc: s.arc }], closed: false }, stepDeg)
      pts.slice(1, -1).forEach((q, k) => out.push([q[0], q[1], z + ((z1 - z) * (k + 1)) / (pts.length - 1)]))
    }
    out.push([s.to[0], s.to[1], z1])
    cur = s.to
    z = z1
  }
  return out
}
