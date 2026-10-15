import { newId } from "./composition"
import type { Opening, PlanPt, Wall } from "./ambientSchema"

// --- Geometria del plànol ---------------------------------------------------------------

export const rad = (deg: number) => (deg * Math.PI) / 180

/** Quatre cantonades (plànol) d'un element de petjada w × d centrat a (x, y) i girat `rot`. */
function footprintCorners(x: number, y: number, w: number, d: number, rot: number): PlanPt[] {
  const c = Math.cos(rad(rot)), s = Math.sin(rad(rot))
  return (
    [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ] as PlanPt[]
  ).map(([u, v]) => [x + u * c - v * s, y + u * s + v * c])
}

/** Caixa alineada (plànol) d'un element girat. */
export function footprintBox(x: number, y: number, w: number, d: number, rot: number): { x0: number; y0: number; x1: number; y1: number } {
  const pts = footprintCorners(x, y, w, d, rot)
  return { x0: Math.min(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), y1: Math.max(...pts.map((p) => p[1])) }
}

/** Punts de la paret al llarg de l'eix: els dos extrems o, corba, `n` trams de la Bézier. */
export function wallPoints(w: Pick<Wall, "a" | "b" | "curve">, n = 24): PlanPt[] {
  if (!w.curve) return [w.a, w.b]
  const { c1, c2 } = w.curve
  const out: PlanPt[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t
    const k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t
    out.push([k0 * w.a[0] + k1 * c1[0] + k2 * c2[0] + k3 * w.b[0], k0 * w.a[1] + k1 * c1[1] + k2 * c2[1] + k3 * w.b[1]])
  }
  return out
}

/** Llargada de la paret (corba: al llarg de la corba). */
export function wallLength(w: Wall): number {
  if (!w.curve) return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
  const pts = wallPoints(w, 48)
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])
  return L
}

/**
 * Les parets per dibuixar-les (3D, render, miniatures) i per arrambar-hi els elements: una corba es fa de trams rectes
 * (`wallPoints`), cadascun una paret com les altres, sense obertures, amb l'id `<paret>~<n>`.
 */
export function expandWalls(walls: readonly Wall[], n = 24): Wall[] {
  return walls.flatMap((w) => {
    if (!w.curve) return [w]
    const pts = wallPoints(w, n)
    const { curve: _c, openings: _o, ...rest } = w
    void _c
    void _o
    return pts.slice(1).map((b, i) => ({ ...rest, id: `${w.id}~${i}`, a: pts[i]!, b }))
  })
}

/** Quatre cantonades del rectangle d'una paret (per dibuixar-la i per l'imant). */
export function wallCorners(w: Wall): PlanPt[] {
  const L = wallLength(w) || 1
  const nx = (-(w.b[1] - w.a[1]) / L) * (w.thickness / 2)
  const ny = ((w.b[0] - w.a[0]) / L) * (w.thickness / 2)
  return [
    [w.a[0] + nx, w.a[1] + ny],
    [w.b[0] + nx, w.b[1] + ny],
    [w.b[0] - nx, w.b[1] - ny],
    [w.a[0] - nx, w.a[1] - ny],
  ]
}

/** Obertures d'una paret retallades a la seva llargada i ordenades (sense solapaments). */
export function wallOpenings(w: Wall): (Opening & { u0: number; u1: number })[] {
  const L = wallLength(w)
  const out: (Opening & { u0: number; u1: number })[] = []
  for (const o of [...(w.openings ?? [])].sort((p, q) => p.at - q.at)) {
    const u0 = Math.max(0, o.at - o.w / 2, out.at(-1)?.u1 ?? 0), u1 = Math.min(L, o.at + o.w / 2)
    const sill = Math.min(o.sill, w.height)
    const h = Math.min(o.h, w.height - sill)
    if (u1 - u0 < 10 || h < 10) continue
    out.push({ ...o, sill, h, u0, u1 })
  }
  return out
}

/** Mides per defecte de cada obertura nova (mm). */
export const OPENING_DEFAULTS: Record<Opening["kind"], Omit<Opening, "at" | "kind">> = {
  window: { w: 1200, h: 1200, sill: 900 },
  door: { w: 900, h: 2100, sill: 0 },
  glazing: { w: 2400, h: 2400, sill: 0 },
}

/** Paret més propera a `p` (a menys de mig gruix + `tol`) i la posició al llarg (des de `a`). */
export function nearestWall(walls: Wall[], p: PlanPt, tol: number): { wall: Wall; at: number; dist: number } | null {
  let best: { wall: Wall; at: number; dist: number } | null = null
  for (const w of walls) {
    const L = wallLength(w)
    if (L < 1) continue
    const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L
    const at = Math.max(0, Math.min(L, (p[0] - w.a[0]) * ux + (p[1] - w.a[1]) * uy))
    const dist = Math.hypot(p[0] - (w.a[0] + ux * at), p[1] - (w.a[1] + uy * at))
    if (dist <= w.thickness / 2 + tol && (!best || dist < best.dist)) best = { wall: w, at, dist }
  }
  return best
}

/** Posició d'una obertura ajustada perquè hi càpiga a la paret (centre entre w/2 i L − w/2). */
export function clampOpening(w: Wall, o: Opening): Opening {
  const L = wallLength(w)
  const ww = Math.min(o.w, L)
  const h = Math.min(o.h, w.height)
  return { ...o, w: ww, h, sill: Math.min(o.sill, Math.max(0, w.height - h)), at: Math.round(Math.max(ww / 2, Math.min(L - ww / 2, o.at))) }
}

/**
 * Paret amb una obertura nova del tipus `kind` centrada a `at` (mides per defecte). Si trepitjaria les que ja hi ha, va
 * al forat lliure més proper on hi cap; si no n'hi ha cap, `null` (no s'afegeix).
 */
export function addOpening(w: Wall, kind: Opening["kind"], at: number): Wall | null {
  const o = clampOpening(w, { kind, at, ...OPENING_DEFAULTS[kind] })
  const L = wallLength(w)
  const taken = (w.openings ?? []).map((q) => [q.at - q.w / 2, q.at + q.w / 2] as const).sort((p, q) => p[0] - q[0])
  // Trams lliures de la paret entre les obertures.
  const gaps: [number, number][] = []
  let u = 0
  for (const [a, b] of taken) {
    if (a > u) gaps.push([u, a])
    u = Math.max(u, b)
  }
  if (L > u) gaps.push([u, L])
  let best: number | null = null
  for (const [a, b] of gaps) {
    if (b - a < o.w - 1e-6) continue
    const c = Math.max(a + o.w / 2, Math.min(b - o.w / 2, o.at))
    if (best === null || Math.abs(c - o.at) < Math.abs(best - o.at)) best = c
  }
  if (best === null) return null
  return { ...w, openings: [...(w.openings ?? []), { ...o, at: Math.round(best) }] }
}

/**
 * Paret amb els extrems nous (`a`, `b`): cada obertura es queda al mateix punt del plànol (projectat sobre la paret nova)
 * i després s'ajusta perquè hi càpiga (`clampOpening`): en moure l'extrem `a` no llisquen i en escurçar-la no en surten.
 */
export function setWallEnds(w: Wall, a: PlanPt, b: PlanPt): Wall {
  // Corba: cada punt de control segueix el seu extrem.
  const curve = w.curve ? { c1: [w.curve.c1[0] + a[0] - w.a[0], w.curve.c1[1] + a[1] - w.a[1]] as PlanPt, c2: [w.curve.c2[0] + b[0] - w.b[0], w.curve.c2[1] + b[1] - w.b[1]] as PlanPt } : undefined
  const next: Wall = { ...w, a, b, ...(curve ? { curve } : {}) }
  if (!w.openings?.length) return next
  const L0 = wallLength(w), L1 = wallLength(next)
  if (L0 < 1e-9 || L1 < 1e-9) return { ...next, openings: w.openings.map((o) => clampOpening(next, o)) }
  const ux0 = (w.b[0] - w.a[0]) / L0, uy0 = (w.b[1] - w.a[1]) / L0
  const ux1 = (b[0] - a[0]) / L1, uy1 = (b[1] - a[1]) / L1
  return {
    ...next,
    openings: w.openings.map((o) => {
      const px = w.a[0] + ux0 * o.at, py = w.a[1] + uy0 * o.at
      return clampOpening(next, { ...o, at: Math.round((px - a[0]) * ux1 + (py - a[1]) * uy1) })
    }),
  }
}

/**
 * Trossos massissos d'una paret amb obertures, en coordenades de la paret (u al llarg des de
 * l'extrem `a`, v amunt). La paret s'allarga mig gruix per banda perquè les cantonades tanquin.
 */
export function wallSegments(w: Wall): { u0: number; u1: number; v0: number; v1: number }[] {
  const L = wallLength(w), t = w.thickness / 2, H = w.height
  const segs: { u0: number; u1: number; v0: number; v1: number }[] = []
  let u = -t
  for (const o of wallOpenings(w)) {
    if (o.u0 > u) segs.push({ u0: u, u1: o.u0, v0: 0, v1: H })
    if (o.sill > 0) segs.push({ u0: o.u0, u1: o.u1, v0: 0, v1: o.sill })
    if (o.sill + o.h < H) segs.push({ u0: o.u0, u1: o.u1, v0: o.sill + o.h, v1: H })
    u = o.u1
  }
  if (L + t > u) segs.push({ u0: u, u1: L + t, v0: 0, v1: H })
  return segs
}

/** Quatre parets d'una habitació rectangular (eixos pel mig de les parets). */
export function roomWalls(x0: number, y0: number, x1: number, y1: number, thickness = 100, height = 2600): Wall[] {
  const a: PlanPt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
  return a.map((p, i) => ({ id: newId("w"), a: p, b: a[(i + 1) % 4]!, thickness, height }))
}

/**
 * Imant d'un element a les cares de les parets (només parets alineades amb els eixos): si una
 * vora de la seva caixa queda a menys de `tol` d'una cara, s'hi arramba. Cada cara només atrau la vora del seu costat
 * (pel centre de l'element respecte a l'eix de la paret): mai no l'estira a través de la paret. Retorna el centre nou.
 */
export function snapToWalls(x: number, y: number, w: number, d: number, rot: number, walls: Wall[], tol = 120): { x: number; y: number; snapped: boolean } {
  const b = footprintBox(x, y, w, d, rot)
  let dx = Infinity, dy = Infinity
  for (const wl of walls) {
    const horiz = Math.abs(wl.a[1] - wl.b[1]) < 1
    const vert = Math.abs(wl.a[0] - wl.b[0]) < 1
    const t = wl.thickness / 2
    if (horiz) {
      const lo = Math.min(wl.a[0], wl.b[0]) - t, hi = Math.max(wl.a[0], wl.b[0]) + t
      if (b.x1 < lo || b.x0 > hi) continue
      // A sobre de la paret (y més petita): la vora de sota contra la cara de sobre; a sota, al revés.
      const [face, edge] = y < wl.a[1] ? [wl.a[1] - t, b.y1] : [wl.a[1] + t, b.y0]
      const k = face - edge
      if (Math.abs(k) < tol && Math.abs(k) < Math.abs(dy)) dy = k
    } else if (vert) {
      const lo = Math.min(wl.a[1], wl.b[1]) - t, hi = Math.max(wl.a[1], wl.b[1]) + t
      if (b.y1 < lo || b.y0 > hi) continue
      const [face, edge] = x < wl.a[0] ? [wl.a[0] - t, b.x1] : [wl.a[0] + t, b.x0]
      const k = face - edge
      if (Math.abs(k) < tol && Math.abs(k) < Math.abs(dx)) dx = k
    }
  }
  return { x: x + (Number.isFinite(dx) ? dx : 0), y: y + (Number.isFinite(dy) ? dy : 0), snapped: Number.isFinite(dx) || Number.isFinite(dy) }
}

/**
 * Habitacions tancades: les parets encadenades extrem amb extrem (al mm) que tornen al punt de sortida. Cada bucle és el
 * polígon dels eixos de les parets. Una paret que no tanca res (una paret solta, una terrassa oberta) no hi surt.
 */
export function wallLoops(walls: Wall[]): PlanPt[][] {
  const key = (p: PlanPt) => `${Math.round(p[0])},${Math.round(p[1])}`
  const at = new Map<string, number[]>()
  walls.forEach((w, i) => {
    for (const p of [w.a, w.b]) at.set(key(p), [...(at.get(key(p)) ?? []), i])
  })
  const used = new Set<number>()
  const loops: PlanPt[][] = []
  for (let s = 0; s < walls.length; s++) {
    if (used.has(s)) continue
    const start = walls[s]!
    const pts: PlanPt[] = [start.a]
    const chain = [s]
    let end = start.b
    let closed = false
    for (let guard = 0; guard <= walls.length; guard++) {
      if (key(end) === key(start.a)) {
        closed = chain.length >= 3
        break
      }
      const here = key(end)
      const next = (at.get(here) ?? []).find((j) => !chain.includes(j) && !used.has(j))
      if (next === undefined) break
      const w = walls[next]!
      pts.push(end)
      chain.push(next)
      end = key(w.a) === here ? w.b : w.a
    }
    if (!closed) continue
    for (const j of chain) used.add(j)
    loops.push(pts)
  }
  return loops
}

/** Superfície de terra (mm²) de les habitacions tancades, als eixos de les parets (fórmula de l'àrea de Gauss). */
export function floorArea(walls: Wall[]): number {
  let total = 0
  for (const pts of wallLoops(walls)) {
    let s = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!, q = pts[(i + 1) % pts.length]!
      s += p[0] * q[1] - q[0] * p[1]
    }
    total += Math.abs(s) / 2
  }
  return total
}
