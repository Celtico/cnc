import { pocketGrid, type DepthGrid, type Pocket } from "../model"
import type { MachineTool } from "../model/machine"

/**
 * Recorreguts 3D d'un buidat que no és de fons pla (una pica, un relleu fet amb una malla; per decisió de l'usuari,
 * 2026-10-17: «com es pot fresar»). Tot sobre una graella de fondàries (`pocketGrid`, 1 mm):
 * - **Desbast** amb una fresa plana per nivells (`pass` mm cada un): a cada nivell, els contorns concèntrics de la zona on
 *   hi cap la fresa (la superfície «engreixada» pel radi, `erode`), de dins cap a fora, deixant `stockZ`/`stockXY` per a
 *   l'acabat; cada nivell entra en rampa pel primer contorn.
 * - **Acabat** amb la fresa esfèrica (o, si no n'hi ha, la plana): passades per nivells que segueixen les parets
 *   (`waterline`) i passades paral·leles que segueixen el fons (`raster`), amb la punta de l'eina on toca la superfície
 *   sense menjar-se-la (el radi de l'eina ja comptat: «drop cutter»).
 * Coordenades locals de la peça a la cara del buidat (x, y) i z = −fondària (0 a la cara). Pur.
 */

export type P3 = [number, number, number]
type Pt = [number, number]

interface ReliefPass {
  kind: "rough" | "waterline" | "raster"
  /** «desbast Ø12», «acabat parets», «acabat fons». */
  label: string
  tool: MachineTool
  ball: boolean
  /** Trams continus (l'eina no s'aixeca dins d'un tram). */
  paths: P3[][]
}

interface ReliefOptions {
  rough?: { tool: MachineTool; pass: number; stockZ: number; stockXY: number; stepover: number }
  finish?: { tool: MachineTool; ball: boolean; stepover: number; zStep: number }
  /** Pas de la graella (mm). */
  step?: number
  maxNodes?: number
}

/** Valors de sempre: desbast a passades de `pass`, solapament del 45 %, acabat a passos petits. */
export function defaultRelief(rough: MachineTool | undefined, finish: MachineTool | undefined, ball: boolean, pass: number): ReliefOptions {
  return {
    ...(rough ? { rough: { tool: rough, pass: Math.max(1, pass), stockZ: 0.4, stockXY: 0.8, stepover: Math.max(0.5, rough.diameter * 0.45) } } : {}),
    ...(finish ? { finish: { tool: finish, ball, stepover: ball ? Math.max(0.3, finish.diameter * 0.12) : Math.max(0.5, Math.min(1.5, finish.diameter * 0.1)), zStep: ball ? 0.5 : 0.8 } } : {}),
  }
}

/**
 * Fondària màxima de la punta d'una eina de radi `r` centrada a cada node perquè no baixi de la superfície enlloc del que
 * toca: la plana, el mínim de la fondària sota el disc; l'esfèrica, la mateixa idea amb la forma de la bola.
 */
export function erode(g: DepthGrid, r: number, ball: boolean): Float32Array {
  const { nx, ny, d, step } = g
  const k = Math.ceil(r / step)
  const offs: { di: number; dj: number; add: number }[] = []
  for (let dj = -k; dj <= k; dj++)
    for (let di = -k; di <= k; di++) {
      const dist = Math.hypot(di, dj) * step
      if (dist > r + 1e-9) continue
      offs.push({ di, dj, add: ball ? r - Math.sqrt(Math.max(0, r * r - dist * dist)) : 0 })
    }
  const out = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let m = Infinity
      for (const o of offs) {
        const a = i + o.di, b = j + o.dj
        const v = (a < 0 || b < 0 || a >= nx || b >= ny ? 0 : d[b * nx + a]!) + o.add
        if (v < m) {
          m = v
          if (m <= 0) break
        }
      }
      out[j * nx + i] = Math.max(0, m)
    }
  return out
}

/** Contorns tancats on `f` passa per `iso` (marching squares; la zona `f > iso` queda a l'esquerra: antihoraris). */
export function isoLoops(f: ArrayLike<number>, nx: number, ny: number, x0: number, y0: number, step: number, iso: number): Pt[][] {
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny ? -Infinity : f[j * nx + i]! - iso)
  // Punt d'un costat de cel·la: horitzontals (h) entre (i, j)–(i+1, j); verticals (v) entre (i, j)–(i, j+1).
  const point = (key: string): Pt => {
    const [t, si, sj] = key.split(":")
    const i = Number(si), j = Number(sj)
    const a = at(i, j)
    const b = t === "h" ? at(i + 1, j) : at(i, j + 1)
    const s = Number.isFinite(a) && Number.isFinite(b) && a !== b ? a / (a - b) : 0.5
    return t === "h" ? [x0 + (i + s) * step, y0 + j * step] : [x0 + i * step, y0 + (j + s) * step]
  }
  const next = new Map<string, string>()
  for (let j = -1; j < ny; j++)
    for (let i = -1; i < nx; i++) {
      const v00 = at(i, j) > 0, v10 = at(i + 1, j) > 0, v11 = at(i + 1, j + 1) > 0, v01 = at(i, j + 1) > 0
      const c = (v00 ? 1 : 0) | (v10 ? 2 : 0) | (v11 ? 4 : 0) | (v01 ? 8 : 0)
      if (c === 0 || c === 15) continue
      const B = `h:${i}:${j}`, R = `v:${i + 1}:${j}`, Tt = `h:${i}:${j + 1}`, L = `v:${i}:${j}`
      // Segments orientats amb la zona de dins a l'esquerra.
      const segs: [string, string][] = []
      switch (c) {
        case 1: segs.push([B, L]); break
        case 2: segs.push([R, B]); break
        case 3: segs.push([R, L]); break
        case 4: segs.push([Tt, R]); break
        case 5: {
          const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4
          if (mid > 0) segs.push([B, R], [Tt, L])
          else segs.push([B, L], [Tt, R])
          break
        }
        case 6: segs.push([Tt, B]); break
        case 7: segs.push([Tt, L]); break
        case 8: segs.push([L, Tt]); break
        case 9: segs.push([B, Tt]); break
        case 10: {
          const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4
          if (mid > 0) segs.push([L, B], [R, Tt])
          else segs.push([R, B], [L, Tt])
          break
        }
        case 11: segs.push([R, Tt]); break
        case 12: segs.push([L, R]); break
        case 13: segs.push([B, R]); break
        case 14: segs.push([L, B]); break
      }
      for (const [a, b] of segs) next.set(a, b)
    }
  const loops: Pt[][] = []
  const done = new Set<string>()
  for (const start of next.keys()) {
    if (done.has(start)) continue
    const loop: Pt[] = []
    let k: string | undefined = start
    while (k && !done.has(k)) {
      done.add(k)
      loop.push(point(k))
      k = next.get(k)
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** Distància (mm) de cada node de dins (`mask`) al node de fora més proper (exacta, Felzenszwalb). */
export function distanceInside(mask: Uint8Array, nx: number, ny: number, step: number): Float32Array {
  const INF = 1e20
  const f = new Float64Array(Math.max(nx, ny))
  const g = new Float64Array(nx * ny)
  for (let k = 0; k < nx * ny; k++) g[k] = mask[k] ? INF : 0
  const dt = (n: number, get: (q: number) => number, set: (q: number, v: number) => void) => {
    const v = new Int32Array(n)
    const z = new Float64Array(n + 1)
    for (let q = 0; q < n; q++) f[q] = get(q)
    let kk = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q = 1; q < n; q++) {
      let s = (f[q]! + q * q - (f[v[kk]!]! + v[kk]! * v[kk]!)) / (2 * q - 2 * v[kk]!)
      while (s <= z[kk]!) {
        kk--
        s = (f[q]! + q * q - (f[v[kk]!]! + v[kk]! * v[kk]!)) / (2 * q - 2 * v[kk]!)
      }
      kk++
      v[kk] = q
      z[kk] = s
      z[kk + 1] = INF
    }
    kk = 0
    for (let q = 0; q < n; q++) {
      while (z[kk + 1]! < q) kk++
      set(q, (q - v[kk]!) * (q - v[kk]!) + f[v[kk]!]!)
    }
  }
  for (let i = 0; i < nx; i++) dt(ny, (q) => g[q * nx + i]!, (q, val) => (g[q * nx + i] = val))
  for (let j = 0; j < ny; j++) dt(nx, (q) => g[j * nx + q]!, (q, val) => (g[j * nx + q] = val))
  const out = new Float32Array(nx * ny)
  for (let k = 0; k < nx * ny; k++) out[k] = mask[k] ? Math.sqrt(g[k]!) * step : 0
  return out
}

/** Valor interpolat d'un camp de nodes a (x, y). */
function sample(f: Float32Array, g: DepthGrid, x: number, y: number): number {
  const fx = (x - g.x0) / g.step, fy = (y - g.y0) / g.step
  if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return 0
  const i = Math.min(g.nx - 2, Math.floor(fx)), j = Math.min(g.ny - 2, Math.floor(fy))
  const u = fx - i, v = fy - j
  const a = f[j * g.nx + i]!, b = f[j * g.nx + i + 1]!, c = f[(j + 1) * g.nx + i]!, e = f[(j + 1) * g.nx + i + 1]!
  return (1 - v) * ((1 - u) * a + u * b) + v * ((1 - u) * c + u * e)
}

/** Treu els punts que són a la recta dels del costat (± `tol` mm). */
function simplify3(pts: P3[], tol = 0.02): P3[] {
  if (pts.length < 3) return pts
  const out: P3[] = [pts[0]!]
  for (let k = 1; k < pts.length - 1; k++) {
    const a = out[out.length - 1]!, b = pts[k]!, c = pts[k + 1]!
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const l2 = ac[0]! ** 2 + ac[1]! ** 2 + ac[2]! ** 2
    const t = l2 ? (ab[0]! * ac[0]! + ab[1]! * ac[1]! + ab[2]! * ac[2]!) / l2 : 0
    const e = Math.hypot(ab[0]! - t * ac[0]!, ab[1]! - t * ac[1]!, ab[2]! - t * ac[2]!)
    if (e > tol || t < 0 || t > 1) out.push(b)
  }
  out.push(pts[pts.length - 1]!)
  return out
}

const r3 = (v: number) => Math.round(v * 1000) / 1000
const loopLength = (l: Pt[]) => l.reduce((s, p, k) => s + Math.hypot(l[(k + 1) % l.length]![0] - p[0], l[(k + 1) % l.length]![1] - p[1]), 0)

/** Un contorn tancat a la fondària `z`, començant al punt més a prop de `from`; amb `rampFrom`, hi baixa en rampa. */
function loopPath(loop: Pt[], z: number, from: Pt | null, ramp: { from: number; length: number } | null): P3[] {
  let s = 0
  if (from) {
    let best = Infinity
    loop.forEach((p, k) => {
      const d = Math.hypot(p[0] - from[0], p[1] - from[1])
      if (d < best) {
        best = d
        s = k
      }
    })
  }
  const ring = [...loop.slice(s), ...loop.slice(0, s)]
  const out: P3[] = []
  if (ramp && ramp.from > z) {
    const len = Math.min(ramp.length, loopLength(ring))
    let acc = 0
    out.push([r3(ring[0]![0]), r3(ring[0]![1]), r3(-ramp.from)])
    for (let k = 1; k <= ring.length && acc < len; k++) {
      const a = ring[k - 1]!, b = ring[k % ring.length]!
      acc += Math.hypot(b[0] - a[0], b[1] - a[1])
      const zz = ramp.from + (z - ramp.from) * Math.min(1, acc / len)
      out.push([r3(b[0]), r3(b[1]), r3(-zz)])
    }
  }
  for (const p of ring) out.push([r3(p[0]), r3(p[1]), r3(-z)])
  out.push([r3(ring[0]![0]), r3(ring[0]![1]), r3(-z)])
  return out
}

/** Desbast per nivells amb la fresa plana. */
function roughPass(g: DepthGrid, o: NonNullable<ReliefOptions["rough"]>): ReliefPass {
  const R = o.tool.diameter / 2
  const zf = erode(g, R, false)
  let zmax = 0
  for (const v of zf) zmax = Math.max(zmax, v)
  const bottom = zmax - o.stockZ
  const paths: P3[][] = []
  const levels: number[] = []
  for (let z = o.pass; z < bottom - 1e-6; z += o.pass) levels.push(z)
  if (bottom > 0.05) levels.push(bottom)
  let prev = 0
  const n = g.nx * g.ny
  for (const z of levels) {
    const mask = new Uint8Array(n)
    for (let k = 0; k < n; k++) mask[k] = zf[k]! - o.stockZ >= z - 1e-6 ? 1 : 0
    const dist = distanceInside(mask, g.nx, g.ny, g.step)
    // Contorns concèntrics: del més endins al de la vora (`stockXY` de la zona).
    const rings: { c: number; loops: Pt[][] }[] = []
    let dmax = 0
    for (const v of dist) if (v > dmax) dmax = v
    for (let c = o.stockXY + g.step / 2; c <= dmax; c += o.stepover) {
      const loops = isoLoops(dist, g.nx, g.ny, g.x0, g.y0, g.step, c)
      if (!loops.length) break
      rings.push({ c, loops })
    }
    rings.reverse()
    let cur: P3[] | null = null
    for (const { loops } of rings)
      for (const loop of loops) {
        const last = cur?.[cur.length - 1]
        const from: Pt | null = last ? [last[0], last[1]] : null
        // Enllaç a la mateixa fondària si el contorn nou és al costat i el pas no surt de la zona.
        const path = loopPath(loop, z, from, null)
        const link = last && Math.hypot(path[0]![0] - last[0], path[0]![1] - last[1]) <= o.stepover * 1.6 && sample(dist, g, (path[0]![0] + last[0]) / 2, (path[0]![1] + last[1]) / 2) > 0
        if (cur && link) cur.push(...path)
        else {
          cur = loopPath(loop, z, from, { from: prev, length: 3 * o.tool.diameter })
          paths.push(cur)
        }
      }
    prev = z
  }
  return { kind: "rough", label: `desbast Ø${r3(o.tool.diameter)} a passades de ${r3(o.pass)} mm`, tool: o.tool, ball: false, paths: paths.map((p) => simplify3(p)) }
}

/** Acabat: parets per nivells i fons en passades paral·leles a X. */
function finishPasses(g: DepthGrid, o: NonNullable<ReliefOptions["finish"]>): ReliefPass[] {
  const R = o.tool.diameter / 2
  const t = erode(g, R, o.ball)
  let tmax = 0
  for (const v of t) tmax = Math.max(tmax, v)
  const name = `${o.ball ? "esfèrica" : "plana"} Ø${r3(o.tool.diameter)}`
  const walls: P3[][] = []
  for (let z = o.zStep; z < tmax + 1e-6; z += o.zStep)
    for (const loop of isoLoops(t, g.nx, g.ny, g.x0, g.y0, g.step, z - 1e-3)) walls.push(simplify3(loopPath(loop, z, null, null)))
  const raster: P3[][] = []
  let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity
  for (let j = 0; j < g.ny; j++)
    for (let i = 0; i < g.nx; i++)
      if (t[j * g.nx + i]! > 0.02) {
        y0 = Math.min(y0, g.y0 + j * g.step)
        y1 = Math.max(y1, g.y0 + j * g.step)
        x0 = Math.min(x0, g.x0 + i * g.step)
        x1 = Math.max(x1, g.x0 + i * g.step)
      }
  if (Number.isFinite(y0)) {
    const ds = Math.min(g.step, 1)
    let flip = false
    let cur: P3[] | null = null
    for (let y = y0; y <= y1 + 1e-6; y += o.stepover) {
      const runs: P3[][] = []
      let run: P3[] = []
      for (let x = x0 - ds; x <= x1 + ds + 1e-6; x += ds) {
        const v = sample(t, g, x, y)
        if (v > 0.02) run.push([r3(x), r3(y), r3(-v)])
        else if (run.length) {
          runs.push(run)
          run = []
        }
      }
      if (run.length) runs.push(run)
      const ordered = flip ? runs.reverse().map((r) => r.reverse()) : runs
      for (const r of ordered) {
        const last = cur?.[cur.length - 1]
        const first = r[0]!
        // Enllaç seguint la superfície si la fila nova comença al costat i el pas no surt del buidat.
        let joined = false
        if (cur && last && Math.hypot(first[0] - last[0], first[1] - last[1]) <= o.stepover * 2.5) {
          const n = Math.max(1, Math.ceil(Math.hypot(first[0] - last[0], first[1] - last[1]) / ds))
          const link: P3[] = []
          for (let k = 1; k < n; k++) {
            const x = last[0] + ((first[0] - last[0]) * k) / n, y2 = last[1] + ((first[1] - last[1]) * k) / n
            const v = sample(t, g, x, y2)
            if (v <= 0.02) break
            link.push([r3(x), r3(y2), r3(-v)])
          }
          if (link.length === n - 1) {
            cur.push(...link, ...r)
            joined = true
          }
        }
        if (!joined) {
          cur = [...r]
          raster.push(cur)
        }
      }
      flip = !flip
    }
  }
  return [
    ...(walls.length ? [{ kind: "waterline" as const, label: `acabat de les parets (${name}, cada ${r3(o.zStep)} mm)`, tool: o.tool, ball: o.ball, paths: walls }] : []),
    ...(raster.length ? [{ kind: "raster" as const, label: `acabat del fons (${name}, passades a ${r3(o.stepover)} mm)`, tool: o.tool, ball: o.ball, paths: raster.map((p) => simplify3(p)) }] : []),
  ]
}

/** Els recorreguts del buidat: desbast i acabat (els que tinguin eina). */
export function reliefPlan(pk: Pocket, o: ReliefOptions): ReliefPass[] {
  // És lent (segons en un relleu gran) i el programa de la peça i el del tauler en demanen el mateix: es recorda.
  const key = JSON.stringify([pk, o])
  const hit = PLANS.get(key)
  if (hit) return hit
  const out = computePlan(pk, o)
  PLANS.set(key, out)
  if (PLANS.size > 16) PLANS.delete(PLANS.keys().next().value!)
  return out
}

/** Els últims plans calculats (clau: el buidat i les opcions en JSON). */
const PLANS = new Map<string, ReliefPass[]>()

function computePlan(pk: Pocket, o: ReliefOptions): ReliefPass[] {
  const margin = Math.max(o.rough?.tool.diameter ?? 0, o.finish?.tool.diameter ?? 0) / 2 + 3
  const g = pocketGrid(pk, o.step ?? 1, margin, o.maxNodes ?? 400_000)
  return [...(o.rough ? [roughPass(g, o.rough)] : []), ...(o.finish ? finishPasses(g, o.finish) : [])]
}

/** Punts de tots els recorreguts (per comptar-los: un programa massa llarg és un avís). */
export const reliefPoints = (passes: ReliefPass[]): number => passes.reduce((s, p) => s + p.paths.reduce((a, q) => a + q.length, 0), 0)
