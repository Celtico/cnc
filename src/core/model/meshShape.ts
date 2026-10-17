import { z } from "zod"

/**
 * Forma lliure d'un objecte (per decisió de l'usuari, 2026-10-17: «un editor de malla com el de SolidWorks», xShape): una
 * **caixa de control** (`cage`: vèrtexs i cares) que se suavitza amb **Catmull-Clark** (`subdivide`). Els vèrtexs van de 0 a 1
 * dins de la caixa de l'objecte (w × h × d): canviar les mides l'estira. Pur.
 */

type V3 = [number, number, number]

export const MeshCageSchema = z.object({
  /** Vèrtexs de la caixa de control, de 0 a 1 dins de la caixa de l'objecte. */
  v: z.array(z.tuple([z.number(), z.number(), z.number()])).min(4),
  /** Cares (índexs de `v`, antihoraris vistes de fora; quadrats o triangles). */
  f: z.array(z.array(z.number().int().min(0)).min(3)).min(2),
  /** Vegades que se suavitza (1–4; sense, 3). */
  level: z.number().int().min(1).max(4).optional(),
})
export type MeshCage = z.infer<typeof MeshCageSchema>

/**
 * La caixa de partida: un cub de 0 a 1 amb cada cara partida en `n × n` quadrats (n = 2: 26 vèrtexs, 24 cares). Suavitzada,
 * és un coixí: es deforma movent-ne els punts.
 */
export function boxCage(n = 2): MeshCage {
  const v: V3[] = []
  const key = new Map<string, number>()
  const at = (p: V3): number => {
    const k = p.map((x) => Math.round(x * 1e6)).join(",")
    let i = key.get(k)
    if (i === undefined) {
      i = v.length
      v.push(p)
      key.set(k, i)
    }
    return i
  }
  const f: number[][] = []
  // Cada cara: eix normal, signe i els dos eixos del pla (u × v = normal cap a fora).
  const faces: { n: 0 | 1 | 2; s: 0 | 1; u: 0 | 1 | 2; w: 0 | 1 | 2 }[] = [
    { n: 0, s: 1, u: 1, w: 2 },
    { n: 0, s: 0, u: 2, w: 1 },
    { n: 1, s: 1, u: 2, w: 0 },
    { n: 1, s: 0, u: 0, w: 2 },
    { n: 2, s: 1, u: 0, w: 1 },
    { n: 2, s: 0, u: 1, w: 0 },
  ]
  for (const fc of faces)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const pt = (a: number, b: number): number => {
          const p: V3 = [0, 0, 0]
          p[fc.n] = fc.s
          p[fc.u] = a / n
          p[fc.w] = b / n
          return at(p)
        }
        f.push([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)])
      }
  return { v, f }
}

/** Una passada de Catmull-Clark (malla tancada): cada cara de k costats passa a k quadrats. */
function catmullClark(v: V3[], f: number[][]): { v: V3[]; f: number[][] } {
  const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
  const facePts = f.map((fc) => mul(fc.reduce((s, i) => add(s, v[i]!), [0, 0, 0] as V3), 1 / fc.length))
  // Arestes: les cares de cada costat.
  const edges = new Map<string, { a: number; b: number; faces: number[] }>()
  const ek = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
  f.forEach((fc, fi) =>
    fc.forEach((a, k) => {
      const b = fc[(k + 1) % fc.length]!
      const key = ek(a, b)
      const e = edges.get(key) ?? { a, b, faces: [] }
      e.faces.push(fi)
      edges.set(key, e)
    }),
  )
  const out: V3[] = []
  const edgeIdx = new Map<string, number>()
  // Punts de les arestes.
  const edgeStart = v.length + f.length
  let k = 0
  for (const [key, e] of edges) {
    const mid = mul(add(v[e.a]!, v[e.b]!), 0.5)
    const p = e.faces.length === 2 ? mul(add(add(v[e.a]!, v[e.b]!), add(facePts[e.faces[0]!]!, facePts[e.faces[1]!]!)), 0.25) : mid
    edgeIdx.set(key, edgeStart + k++)
    out.push(p)
  }
  // Vèrtexs nous: (F + 2R + (n − 3)P) / n.
  const adjFaces: number[][] = v.map(() => [])
  const adjEdges: string[][] = v.map(() => [])
  f.forEach((fc, fi) => fc.forEach((i) => adjFaces[i]!.push(fi)))
  for (const [key, e] of edges) {
    adjEdges[e.a]!.push(key)
    adjEdges[e.b]!.push(key)
  }
  const moved: V3[] = v.map((p, i) => {
    const n = adjEdges[i]!.length
    if (n < 3 || adjFaces[i]!.length !== n) return p
    const F = mul(adjFaces[i]!.reduce((s, fi) => add(s, facePts[fi]!), [0, 0, 0] as V3), 1 / adjFaces[i]!.length)
    const R = mul(adjEdges[i]!.reduce((s, key) => { const e = edges.get(key)!; return add(s, mul(add(v[e.a]!, v[e.b]!), 0.5)) }, [0, 0, 0] as V3), 1 / n)
    return mul(add(add(F, mul(R, 2)), mul(p, n - 3)), 1 / n)
  })
  const verts: V3[] = [...moved, ...facePts, ...out]
  const faces: number[][] = []
  f.forEach((fc, fi) => {
    const c = v.length + fi
    fc.forEach((a, i) => {
      const next = fc[(i + 1) % fc.length]!
      const prev = fc[(i - 1 + fc.length) % fc.length]!
      faces.push([a, edgeIdx.get(ek(a, next))!, c, edgeIdx.get(ek(prev, a))!])
    })
  })
  return { v: verts, f: faces }
}

/** La superfície suau de la caixa de control (de 0 a 1), en triangles (antihoraris vistos de fora). */
export function subdivide(cage: MeshCage, level = cage.level ?? 3): { positions: V3[]; triangles: [number, number, number][] } {
  let m = { v: cage.v as V3[], f: cage.f }
  for (let i = 0; i < level; i++) m = catmullClark(m.v, m.f)
  const triangles: [number, number, number][] = []
  for (const fc of m.f) for (let i = 1; i + 1 < fc.length; i++) triangles.push([fc[0]!, fc[i]!, fc[i + 1]!])
  return { positions: m.v, triangles }
}

/** Una passada de suavitzat aplicada a la mateixa caixa: més punts per modelar («Més detall»). */
export function refineCage(cage: MeshCage): MeshCage {
  const m = catmullClark(cage.v as V3[], cage.f)
  return { ...cage, v: m.v, f: m.f }
}

/**
 * La caixa de control dins de [0, 1] amb la caixa que la conté: després d'estirar punts fora (o d'encongir-la), la caixa
 * de l'objecte (`box`, mm) s'ajusta a la forma i els punts tornen de 0 a 1.
 */
export function normalizeCage(cage: MeshCage, box: { x: number; y: number; z: number; w: number; h: number; d: number }): { cage: MeshCage; box: { x: number; y: number; z: number; w: number; h: number; d: number } } {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of cage.v) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, p[k]!)
    hi[k] = Math.max(hi[k]!, p[k]!)
  }
  const size = [box.w, box.h, box.d]
  const span = [0, 1, 2].map((k) => Math.max(1e-6, hi[k]! - lo[k]!))
  const r = (x: number) => Math.round(x * 1e5) / 1e5
  const rm = (x: number) => Math.round(x * 10) / 10
  const v = cage.v.map((p) => p.map((x, k) => r((x - lo[k]!) / span[k]!)) as V3)
  return {
    cage: { ...cage, v },
    box: { x: rm(box.x + lo[0]! * size[0]!), y: rm(box.y + lo[1]! * size[1]!), z: rm(box.z + lo[2]! * size[2]!), w: rm(Math.max(1, span[0]! * size[0]!)), h: rm(Math.max(1, span[1]! * size[1]!)), d: rm(Math.max(1, span[2]! * size[2]!)) },
  }
}

/** Els triangles de la forma en coordenades de la composició (mm). */
export function meshWorldTriangles(o: { x: number; y: number; z: number; w: number; h: number; d: number; mesh?: MeshCage }): [V3, V3, V3][] {
  if (!o.mesh) return []
  const s = subdivide(o.mesh)
  const pts = s.positions.map((p): V3 => [o.x + p[0] * o.w, o.y + p[1] * o.h, o.z + p[2] * o.d])
  return s.triangles.map((t): [V3, V3, V3] => [pts[t[0]]!, pts[t[1]]!, pts[t[2]]!])
}

/**
 * Fondària de la forma vista des d'una cara (el que se'n pot fresar des de dalt): els triangles ja passats a coordenades
 * de la peça (x, y al pla, z = gruix), es rasteritzen a una graella de `step` mm i cada node es queda el punt més baix
 * (cara A: `top − z mínima`) o més alt (cara B: `z màxima`) de la forma. 0 on no n'hi ha. Pur.
 */
export function rasterDepth(tris: [V3, V3, V3][], face: "A" | "B", T: number, step: number, clip: { x0: number; y0: number; x1: number; y1: number }): { x0: number; y0: number; nx: number; ny: number; d: number[] } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of tris) for (const p of t) {
    x0 = Math.min(x0, p[0])
    y0 = Math.min(y0, p[1])
    x1 = Math.max(x1, p[0])
    y1 = Math.max(y1, p[1])
  }
  x0 = Math.max(clip.x0, Math.floor(x0 / step) * step - step)
  y0 = Math.max(clip.y0, Math.floor(y0 / step) * step - step)
  x1 = Math.min(clip.x1, x1 + step)
  y1 = Math.min(clip.y1, y1 + step)
  if (!(x1 > x0 && y1 > y0)) return null
  const nx = Math.max(2, Math.ceil((x1 - x0) / step) + 1), ny = Math.max(2, Math.ceil((y1 - y0) / step) + 1)
  const best = new Float64Array(nx * ny).fill(face === "A" ? Infinity : -Infinity)
  for (const [a, b, c] of tris) {
    const minx = Math.min(a[0], b[0], c[0]), maxx = Math.max(a[0], b[0], c[0])
    const miny = Math.min(a[1], b[1], c[1]), maxy = Math.max(a[1], b[1], c[1])
    const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
    if (Math.abs(den) < 1e-12) continue
    const i0 = Math.max(0, Math.ceil((minx - x0) / step)), i1 = Math.min(nx - 1, Math.floor((maxx - x0) / step))
    const j0 = Math.max(0, Math.ceil((miny - y0) / step)), j1 = Math.min(ny - 1, Math.floor((maxy - y0) / step))
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const px = x0 + i * step, py = y0 + j * step
        const l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den
        const l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den
        const l3 = 1 - l1 - l2
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue
        const z = l1 * a[2] + l2 * b[2] + l3 * c[2]
        const k = j * nx + i
        if (face === "A" ? z < best[k]! : z > best[k]!) best[k] = z
      }
  }
  const r = (v: number) => Math.round(v * 100) / 100
  const d: number[] = Array.from(best, (z) => (Number.isFinite(z) ? r(Math.max(0, Math.min(T, face === "A" ? T - z : z))) : 0))
  if (!d.some((x) => x > 0.05)) return null
  return { x0: r(x0), y0: r(y0), nx, ny, d }
}

/** Per a cada vèrtex, el seu simètric respecte del pla del mig en X (x → 1 − x), o ell mateix si és al pla. */
export function mirrorPairs(cage: MeshCage, tol = 1e-4): number[] {
  return cage.v.map((p, i) => {
    const j = cage.v.findIndex((q) => Math.abs(q[0] - (1 - p[0])) < tol && Math.abs(q[1] - p[1]) < tol && Math.abs(q[2] - p[2]) < tol)
    return j >= 0 ? j : i
  })
}

/**
 * Mou els vèrtexs `ids` (de 0 a 1 de la caixa) `delta`; amb `mirror` (`mirrorPairs`), els simètrics fan el mateix amb la X
 * al revés (i els del pla del mig no es mouen en X).
 */
export function moveVertices(cage: MeshCage, ids: readonly number[], delta: [number, number, number], mirror?: readonly number[]): MeshCage {
  const v = cage.v.map((p) => [...p] as [number, number, number])
  const done = new Set<number>()
  const r = (x: number) => Math.round(x * 1e5) / 1e5
  for (const i of ids) {
    if (done.has(i)) continue
    done.add(i)
    const j = mirror?.[i]
    const onPlane = mirror && j === i
    v[i] = [r(cage.v[i]![0] + (onPlane ? 0 : delta[0])), r(cage.v[i]![1] + delta[1]), r(cage.v[i]![2] + delta[2])]
    if (mirror && j !== undefined && j !== i && !done.has(j)) {
      done.add(j)
      v[j] = [r(cage.v[j]![0] - delta[0]), r(cage.v[j]![1] + delta[1]), r(cage.v[j]![2] + delta[2])]
    }
  }
  return { ...cage, v }
}
