import type { Pocket } from "./panel"
import { bounds, closestOnPolygon, distToPolygon, flatten, pointInPolygon, type Pt } from "./polygon"

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

/** Empremta del mapa (FNV-1a de les fondàries a 0,01 mm), un cop per array. */
const MAP_HASH = new WeakMap<readonly number[], string>()
function mapHash(d: readonly number[]): string {
  let h = MAP_HASH.get(d)
  if (h) return h
  let x = 0x811c9dc5
  for (const v of d) {
    x ^= Math.round(v * 100) | 0
    x = Math.imul(x, 0x01000193)
  }
  h = `${d.length}:${(x >>> 0).toString(36)}`
  MAP_HASH.set(d, h)
  return h
}

/**
 * Una clau curta del buidat (per a memòries i per saber si una peça ha canviat): el buidat en JSON, amb el mapa resumit en
 * una empremta (un relleu porta centenars de milers de fondàries: passar-les a text a cada reconstrucció era el més lent).
 */
export function pocketKey(pk: Pocket): string {
  return JSON.stringify(pk.map ? { ...pk, map: { ...pk.map, d: mapHash(pk.map.d) } } : pk)
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
  // La vora, on el fons ja baixa 0,3 mm: més a prop de la cara, el booleà deixa trossets gairebé plans (punts a la cara).
  const th = Math.max(0.3, wallDepth + 0.3)
  const poly = pk.map ? null : pocketPolygon(pk)
  // Cada cel·la es parteix en dos triangles i cada triangle es retalla per on el fons passa per `th` (interpolat a les
  // arestes; amb contorn, el punt va a sobre del contorn): la vora segueix la línia exacta, sense punxes de la graella.
  const positions: number[] = []
  const index: number[] = []
  const ids = new Map<string, [number, number]>()
  const nodeXY = (k: number): [number, number] => [g.x0 + (k % nx) * g.step, g.y0 + Math.floor(k / nx) * g.step]
  /** Vèrtex de dalt i de baix d'un node de dins (`b < 0`) o del punt de l'aresta a–b on el fons passa per `th`. */
  const vtx = (a: number, b2: number): [number, number] => {
    const key = b2 < 0 ? `n${a}` : a < b2 ? `e${a}_${b2}` : `e${b2}_${a}`
    let v = ids.get(key)
    if (v) return v
    let x: number, y: number, depth: number
    if (b2 < 0) {
      ;[x, y] = nodeXY(a)
      depth = d[a]!
    } else {
      const [ax, ay] = nodeXY(a), [bx, by] = nodeXY(b2)
      const da = d[a]!, db = d[b2]!
      const t = Math.min(1, Math.max(0, (th - da) / (db - da)))
      x = ax + (bx - ax) * t
      y = ay + (by - ay) * t
      if (poly) [x, y] = closestOnPolygon(x, y, poly)
      depth = th
    }
    const i0 = positions.length / 3
    positions.push(x, y, z(top), x, y, z(Math.max(top + 0.01, depth)))
    v = [i0, i0 + 1]
    ids.set(key, v)
    return v
  }
  const up = pk.face === "B"
  const tri = (a: number, b2: number, c: number, flip: boolean) => (flip !== up ? index.push(a, c, b2) : index.push(a, b2, c))
  const quad = (a: number, b2: number, c: number, e: number) => (up ? index.push(a, e, c, a, c, b2) : index.push(a, b2, c, a, c, e))
  const border = (a: number, b2: number) => {
    const ia = a % nx, ja = Math.floor(a / nx), ib = b2 % nx, jb = Math.floor(b2 / nx)
    return (ia === ib && (ia === 0 || ia === nx - 1)) || (ja === jb && (ja === 0 || ja === ny - 1))
  }
  const clip = (c: [number, number, number]) => {
    const ins = c.map((k) => d[k]! > th)
    if (!ins.some(Boolean)) return
    // El polígon retallat (antihorari) i, per a cada costat, si és un tall (paret) o un costat de la graella.
    const pts: [number, number][] = []
    const cut: boolean[] = []
    for (let k = 0; k < 3; k++) {
      const a = c[k]!, b2 = c[(k + 1) % 3]!
      if (ins[k]) {
        pts.push(vtx(a, -1))
        cut.push(false)
        if (!ins[(k + 1) % 3]) {
          pts.push(vtx(a, b2))
          cut.push(true)
        }
      } else if (ins[(k + 1) % 3]) {
        pts.push(vtx(a, b2))
        cut.push(false)
      }
    }
    for (let k = 1; k + 1 < pts.length; k++) {
      tri(pts[0]![0], pts[k]![0], pts[k + 1]![0], false)
      tri(pts[0]![1], pts[k]![1], pts[k + 1]![1], true)
    }
    // Parets: als talls i a la vora de la graella (el mapa arriba fins al cantell de la peça).
    for (let k = 0; k < pts.length; k++) {
      const P = pts[k]!, Q = pts[(k + 1) % pts.length]!
      if (cut[k]) quad(P[0], P[1], Q[1], Q[0])
    }
    for (let k = 0; k < 3; k++) {
      const a = c[k]!, b2 = c[(k + 1) % 3]!
      if (!border(a, b2) || !(ins[k] || ins[(k + 1) % 3])) continue
      const P = ins[k] ? vtx(a, -1) : vtx(a, b2), Q = ins[(k + 1) % 3] ? vtx(b2, -1) : vtx(a, b2)
      quad(P[0], P[1], Q[1], Q[0])
    }
  }
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const k00 = j * nx + i, k10 = k00 + 1, k01 = k00 + nx, k11 = k01 + 1
      clip([k00, k10, k11])
      clip([k00, k11, k01])
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
