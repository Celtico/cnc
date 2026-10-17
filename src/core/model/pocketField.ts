import type { Pocket } from "./panel"
import { bounds, flatten, pointInPolygon, type Pt } from "./polygon"

/**
 * La forma d'un buidat (`Pocket`) com a fondària a cada punt: el que fan servir els recorreguts 3D (`core/machine/relief.ts`)
 * i el 3D (`pocketSolids`). Fondària en mm des de la cara (0 = no hi toca, positiva cap a dins). Pur.
 */

/** Graella de nodes: `d[j * nx + i]` és la fondària a (x0 + i·step, y0 + j·step). */
export interface DepthGrid {
  x0: number
  y0: number
  step: number
  nx: number
  ny: number
  d: Float32Array
}

/** El contorn del buidat com a polígon (arcs en trossos petits). */
export function pocketPolygon(pk: Pocket): Pt[] {
  return flatten(pk.points, Math.PI / 48)
}

/** El punt del contorn més proper a (x, y). */
function closestOnPolygon(x: number, y: number, poly: Pt[]): [number, number] {
  let best = Infinity
  let out: [number, number] = [x, y]
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]!
    const [bx, by] = poly[(i + 1) % poly.length]!
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    const px = ax + t * dx, py = ay + t * dy
    const d2 = (px - x) ** 2 + (py - y) ** 2
    if (d2 < best) {
      best = d2
      out = [px, py]
    }
  }
  return out
}

/** Distància d'un punt al contorn (sense signe). */
function distToPolygon(x: number, y: number, poly: Pt[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]!
    const [bx, by] = poly[(i + 1) % poly.length]!
    const dx = bx - ax, dy = by - ay
    const l2 = dx * dx + dy * dy
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0
    const ex = ax + t * dx - x, ey = ay + t * dy - y
    const d2 = ex * ex + ey * ey
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

/**
 * Fondària del fons arrodonit a `dist` mm del contorn (cap a dins). Radi ≤ fondària: la paret recta fins a
 * `depth − round` i un quart de cercle de radi `round` fins al fons (una pica). Radi més gran que la fondària: un **plat**,
 * un arc gran que surt de la vora (fondària 0) i arriba al fons a `round` mm de la vora, tangent (un plat de dutxa en
 * pendent cap al mig). Els dos coincideixen quan el radi és la fondària.
 */
export function roundedDepth(dist: number, depth: number, round: number): number {
  if (dist >= round) return depth
  const k = round - dist
  if (round <= depth) return Math.max(0, depth - round + Math.sqrt(Math.max(0, round * round - k * k)))
  const R = (round * round + depth * depth) / (2 * depth)
  return Math.max(0, depth - (R - Math.sqrt(Math.max(0, R * R - k * k))))
}

/** Fondària del mapa a (x, y), interpolada (0 fora). */
function mapDepth(m: NonNullable<Pocket["map"]>, x: number, y: number): number {
  const fx = (x - m.x0) / m.step, fy = (y - m.y0) / m.step
  if (fx < 0 || fy < 0 || fx > m.nx - 1 || fy > m.ny - 1) return 0
  const i = Math.min(m.nx - 2, Math.floor(fx)), j = Math.min(m.ny - 2, Math.floor(fy))
  const u = fx - i, v = fy - j
  const at = (a: number, b: number) => m.d[b * m.nx + a] ?? 0
  return (1 - v) * ((1 - u) * at(i, j) + u * at(i + 1, j)) + v * ((1 - u) * at(i, j + 1) + u * at(i + 1, j + 1))
}

/** La funció fondària del buidat (pla, arrodonit o de mapa). */
export function pocketDepthFn(pk: Pocket): (x: number, y: number) => number {
  if (pk.map) {
    const m = pk.map
    return (x, y) => Math.min(pk.depth, Math.max(0, mapDepth(m, x, y)))
  }
  const poly = pocketPolygon(pk)
  const round = pk.round
  return (x, y) => {
    if (!pointInPolygon([x, y], poly)) return 0
    if (!round) return pk.depth
    return roundedDepth(distToPolygon(x, y, poly), pk.depth, round)
  }
}

/** Caixa del buidat a la cara (del contorn o del mapa). */
export function pocketBounds(pk: Pocket): { x0: number; y0: number; x1: number; y1: number } {
  if (pk.map) return { x0: pk.map.x0, y0: pk.map.y0, x1: pk.map.x0 + (pk.map.nx - 1) * pk.map.step, y1: pk.map.y0 + (pk.map.ny - 1) * pk.map.step }
  return bounds(pocketPolygon(pk))
}

/** El pas de graella per a una caixa: `step`, o més gran si passaria de `maxNodes`. */
function gridStep(w: number, h: number, step: number, maxNodes: number): number {
  return Math.max(step, Math.sqrt((Math.max(1, w) * Math.max(1, h)) / maxNodes))
}

/** La fondària a cada node d'una graella que cobreix el buidat amb `margin` mm de més per cada costat. */
export function pocketGrid(pk: Pocket, step: number, margin: number, maxNodes = 400_000, signed = false): DepthGrid {
  const b = pocketBounds(pk)
  const s = gridStep(b.x1 - b.x0 + 2 * margin, b.y1 - b.y0 + 2 * margin, step, maxNodes)
  const x0 = b.x0 - margin, y0 = b.y0 - margin
  const nx = Math.max(2, Math.ceil((b.x1 + margin - x0) / s) + 1)
  const ny = Math.max(2, Math.ceil((b.y1 + margin - y0) / s) + 1)
  const d = new Float32Array(nx * ny)
  // `signed`: el mapa tal qual (negatiu per sobre de la cara), per trobar la vora del 3D.
  const m = pk.map
  const f = signed && m ? (x: number, y: number) => Math.min(pk.depth, mapDepth(m, x, y)) : pocketDepthFn(pk)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) d[j * nx + i] = f(x0 + i * s, y0 + j * s)
  return { x0, y0, step: s, nx, ny, d }
}

/** El buidat té el fons pla (una caixera de les de sempre). */
export const isFlatPocket = (pk: Pocket): boolean => !pk.round && !pk.map

/**
 * El que treu el buidat, per al 3D (coordenades locals de la peça, mm): un prisma del contorn fins a la paret recta
 * (`wall`: tota la fondària si és pla; fins a `depth − round` si és arrodonit) i, si el fons no és pla, un **sòlid de mapa
 * d'alçades** (`field`: triangles tancats, de 1 mm per sobre de la paret fins al fons) a les cel·les on baixa més que la
 * paret. `T`: el gruix (la cara A és a z = T; la B, a z = 0).
 */
export function pocketSolids(pk: Pocket, T: number, maxCells = 10_000): { wall?: { points: [number, number, number][]; dir: [number, number, number] }; field?: { positions: number[]; index: number[] } } {
  const out: ReturnType<typeof pocketSolids> = {}
  const sign = pk.face === "A" ? -1 : 1
  const face = pk.face === "A" ? T : 0
  const z = (depth: number) => face + sign * depth
  const wallDepth = pk.map ? 0 : pk.round ? Math.max(0, pk.depth - pk.round) : pk.depth
  if (wallDepth > 0.01) {
    const pts = pocketPolygon(pk).map(([x, y]) => [x, y, z(-1)] as [number, number, number])
    out.wall = { points: pts, dir: [0, 0, sign * (wallDepth + 1)] }
  }
  if (isFlatPocket(pk)) return out
  const b = pocketBounds(pk)
  const step = gridStep(b.x1 - b.x0, b.y1 - b.y0, 1, maxCells)
  const g = pocketGrid(pk, step, step, maxCells * 1.2, true)
  const top = wallDepth > 0.01 ? wallDepth - 0.5 : -1
  // Cel·les on el fons baixa més que la paret (alguna cantonada).
  const { nx, ny, d } = g
  const th = Math.max(0.02, wallDepth + 0.02)
  const poly = pk.map ? null : pocketPolygon(pk)
  const inCell = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < nx - 1 && j < ny - 1 && Math.max(d[j * nx + i]!, d[j * nx + i + 1]!, d[(j + 1) * nx + i]!, d[(j + 1) * nx + i + 1]!) > th
  // Els nodes de fora d'una cel·la de la vora es posen sobre la línia on el fons passa per `th` (la mitjana dels punts on
  // talla les arestes cap als de dins): la vora segueix el contorn i no fa l'escala de la graella.
  const nodeXY = (i: number, j: number): [number, number] => {
    const k = j * nx + i
    const dk = d[k]!
    const gx = g.x0 + i * g.step, gy = g.y0 + j * g.step
    if (dk > th) return [gx, gy]
    // Amb contorn: el punt del contorn més proper (exacte; la fondària hi salta de cop i interpolar-la faria l'escala).
    if (poly) return closestOnPolygon(gx, gy, poly)
    let sx = 0, sy = 0, n = 0
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di, b = j + dj
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue
      const dm = d[b * nx + a]!
      if (dm <= th) continue
      const t = Math.min(1, Math.max(0, (th - dk) / (dm - dk)))
      sx += gx + di * g.step * t
      sy += gy + dj * g.step * t
      n++
    }
    return n ? [sx / n, sy / n] : [gx, gy]
  }
  const positions: number[] = []
  const index: number[] = []
  const topIdx = new Map<number, number>()
  const botIdx = new Map<number, number>()
  const vert = (map: Map<number, number>, i: number, j: number, depth: number) => {
    const k = j * nx + i
    let v = map.get(k)
    if (v === undefined) {
      v = positions.length / 3
      const [x, y] = nodeXY(i, j)
      positions.push(x, y, z(depth))
      map.set(k, v)
    }
    return v
  }
  const T0 = (i: number, j: number) => vert(topIdx, i, j, top)
  const B0 = (i: number, j: number) => vert(botIdx, i, j, Math.max(top + 0.01, d[j * nx + i]! > th ? d[j * nx + i]! : th))
  // Cara de dalt (mirant cap a fora del sòlid: cap a la cara de la peça) i de baix (cap a dins de la peça).
  const quad = (a: number, b2: number, c: number, e: number, flip: boolean) => {
    if (flip !== (pk.face === "B")) index.push(a, c, b2, a, e, c)
    else index.push(a, b2, c, a, c, e)
  }
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      if (!inCell(i, j)) continue
      quad(T0(i, j), T0(i + 1, j), T0(i + 1, j + 1), T0(i, j + 1), false)
      quad(B0(i, j), B0(i + 1, j), B0(i + 1, j + 1), B0(i, j + 1), true)
      // Parets on la cel·la del costat no hi és.
      if (!inCell(i, j - 1)) quad(T0(i, j), B0(i, j), B0(i + 1, j), T0(i + 1, j), false)
      if (!inCell(i + 1, j)) quad(T0(i + 1, j), B0(i + 1, j), B0(i + 1, j + 1), T0(i + 1, j + 1), false)
      if (!inCell(i, j + 1)) quad(T0(i + 1, j + 1), B0(i + 1, j + 1), B0(i, j + 1), T0(i, j + 1), false)
      if (!inCell(i - 1, j)) quad(T0(i, j + 1), B0(i, j + 1), B0(i, j), T0(i, j), false)
    }
  if (index.length) out.field = { positions, index }
  return out
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** El buidat desplaçat (la peça retallada des d'una altra cantonada). */
export function movePocket(pk: Pocket, dx: number, dy: number): Pocket {
  return {
    ...pk,
    points: pk.points.map((q) => (q.length > 2 ? ([r2(q[0] + dx), r2(q[1] + dy), q[2]!] as [number, number, number]) : ([r2(q[0] + dx), r2(q[1] + dy)] as [number, number]))),
    ...(pk.map ? { map: { ...pk.map, x0: r2(pk.map.x0 + dx), y0: r2(pk.map.y0 + dy) } } : {}),
  }
}

/** El buidat d'una peça girada perquè el costat llarg sigui u (`normalizePanel`): (x, y) → (y, L − x). */
export function rotatePocket(pk: Pocket, L: number): Pocket {
  const out: Pocket = { ...pk, points: pk.points.map((q) => (q.length > 2 ? ([q[1], r2(L - q[0]), q[2]!] as [number, number, number]) : ([q[1], r2(L - q[0])] as [number, number]))) }
  if (pk.map) {
    const m = pk.map
    const d: number[] = new Array(m.nx * m.ny)
    for (let j = 0; j < m.ny; j++) for (let i = 0; i < m.nx; i++) d[(m.nx - 1 - i) * m.ny + j] = m.d[j * m.nx + i]!
    out.map = { x0: m.y0, y0: r2(L - m.x0 - (m.nx - 1) * m.step), step: m.step, nx: m.ny, ny: m.nx, d }
  }
  return out
}
