import { z } from "zod"
import { roundTo } from "../../lib/format"

/**
 * Forma lliure d'un objecte (per decisió de l'usuari, 2026-10-17: «un editor de malla com el de SolidWorks», xShape): una
 * **caixa de control** (`cage`: vèrtexs i cares) que se suavitza amb **Catmull-Clark** (`subdivide`). Els vèrtexs van de 0 a 1
 * dins de la caixa de l'objecte (w × h × d): canviar les mides l'estira. Pur.
 */

type V3 = [number, number, number]

/** La caixa d'un objecte (mm): cantonada (x, y, z) i mides w × h × d. */
export type ObjectBox = { x: number; y: number; z: number; w: number; h: number; d: number }

/** Clau d'una aresta (els dos vèrtexs, el menor primer): la mateixa per a a–b i b–a. */
export const edgeKey = (a: number, b: number): string => (a < b ? `${a}_${b}` : `${b}_${a}`)

export const MeshCageSchema = z.object({
  /** Vèrtexs de la caixa de control, de 0 a 1 dins de la caixa de l'objecte. */
  v: z.array(z.tuple([z.number(), z.number(), z.number()])).min(4),
  /** Cares (índexs de `v`, antihoraris vistes de fora; quadrats o triangles). */
  f: z.array(z.array(z.number().int().min(0)).min(3)).min(2),
  /** Vegades que se suavitza (1–4; sense, 3). 0: tal com és (un model importat, `meshImport.ts`). */
  level: z.number().int().min(0).max(4).optional(),
  /** Arestes vives (parells d'índexs de `v`): no s'arrodoneixen (un cantell recte, una cantonada). */
  crease: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).optional(),
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

/**
 * Una passada de Catmull-Clark (malla tancada): cada cara de k costats passa a k quadrats. Les **arestes vives** (`crease`)
 * no s'arrodoneixen: el punt de l'aresta és el del mig, un vèrtex amb dues arestes vives les segueix (regla de la corba) i
 * un amb tres o més (una cantonada) no es mou; les meitats segueixen sent vives.
 */
function catmullClark(v: V3[], f: number[][], crease: [number, number][] = []): { v: V3[]; f: number[][]; crease: [number, number][] } {
  const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
  const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
  const facePts = f.map((fc) => mul(fc.reduce((s, i) => add(s, v[i]!), [0, 0, 0] as V3), 1 / fc.length))
  const sharp = new Set(crease.map(([a, b]) => edgeKey(a, b)))
  // Arestes: les cares de cada costat.
  const edges = new Map<string, { a: number; b: number; faces: number[] }>()
  f.forEach((fc, fi) =>
    fc.forEach((a, k) => {
      const b = fc[(k + 1) % fc.length]!
      const key = edgeKey(a, b)
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
    const p = e.faces.length === 2 && !sharp.has(key) ? mul(add(add(v[e.a]!, v[e.b]!), add(facePts[e.faces[0]!]!, facePts[e.faces[1]!]!)), 0.25) : mid
    edgeIdx.set(key, edgeStart + k++)
    out.push(p)
  }
  // Vèrtexs nous: (F + 2R + (n − 3)P) / n; amb arestes vives, la corba o la cantonada.
  const adjFaces: number[][] = v.map(() => [])
  const adjEdges: string[][] = v.map(() => [])
  f.forEach((fc, fi) => fc.forEach((i) => adjFaces[i]!.push(fi)))
  for (const [key, e] of edges) {
    adjEdges[e.a]!.push(key)
    adjEdges[e.b]!.push(key)
  }
  const moved: V3[] = v.map((p, i) => {
    const n = adjEdges[i]!.length
    const vivid = adjEdges[i]!.filter((key) => sharp.has(key))
    if (vivid.length > 2) return p
    if (vivid.length === 2) {
      const other = vivid.map((key) => { const e = edges.get(key)!; return v[e.a === i ? e.b : e.a]! })
      return mul(add(add(mul(p, 6), other[0]!), other[1]!), 1 / 8)
    }
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
      faces.push([a, edgeIdx.get(edgeKey(a, next))!, c, edgeIdx.get(edgeKey(prev, a))!])
    })
  })
  const nextCrease: [number, number][] = []
  for (const key of sharp) {
    const e = edges.get(key)
    if (!e) continue
    const m = edgeIdx.get(key)!
    nextCrease.push([e.a, m], [m, e.b])
  }
  return { v: verts, f: faces, crease: nextCrease }
}

/** La superfície suau de la caixa de control (de 0 a 1), en triangles (antihoraris vistos de fora). */
export function subdivide(cage: MeshCage, level = cage.level ?? 3): { positions: V3[]; triangles: [number, number, number][] } {
  let m = { v: cage.v as V3[], f: cage.f, crease: (cage.crease ?? []) as [number, number][] }
  // Cada passada multiplica les cares per 4: una caixa amb molt de detall en fa menys (si no, la superfície tindria
  // centenars de milers de cares i l'app es quedaria penjada).
  let n = level
  while (n > 0 && cage.f.length * 4 ** n > MAX_FACES) n--
  for (let i = 0; i < n; i++) m = catmullClark(m.v, m.f, m.crease)
  const triangles: [number, number, number][] = []
  for (const fc of m.f) for (let i = 1; i + 1 < fc.length; i++) triangles.push([fc[0]!, fc[i]!, fc[i + 1]!])
  return { positions: m.v, triangles }
}

/** Cares de la superfície suau com a molt (`subdivide`). */
const MAX_FACES = 40_000

/** Punts de la caixa de control com a molt per fer-hi «Més detall» (cada cop en multiplica per 4). */
export const MAX_CAGE_POINTS = 500

/** Una passada de suavitzat aplicada a la mateixa caixa: més punts per modelar («Més detall»). Les arestes vives es queden. */
export function refineCage(cage: MeshCage): MeshCage {
  const m = catmullClark(cage.v as V3[], cage.f, (cage.crease ?? []) as [number, number][])
  return { ...cage, v: m.v, f: m.f, ...(m.crease.length ? { crease: m.crease } : { crease: undefined }) }
}

/** Posa o treu «aresta viva» a les arestes de la caixa que tenen els dos punts triats. */
export function toggleCrease(cage: MeshCage, ids: readonly number[]): MeshCage {
  const sel = new Set(ids)
  const edges = new Map<string, [number, number]>()
  for (const fc of cage.f) fc.forEach((a, k) => {
    const b = fc[(k + 1) % fc.length]!
    if (sel.has(a) && sel.has(b)) edges.set(edgeKey(a, b), [Math.min(a, b), Math.max(a, b)])
  })
  if (!edges.size) return cage
  const cur = new Map((cage.crease ?? []).map(([a, b]) => [edgeKey(a, b), [a, b] as [number, number]]))
  const allOn = [...edges.keys()].every((key) => cur.has(key))
  for (const [key, e] of edges) {
    if (allOn) cur.delete(key)
    else cur.set(key, e)
  }
  const crease = [...cur.values()]
  return { ...cage, crease: crease.length ? crease : undefined }
}

/**
 * La caixa de control dins de [0, 1] amb la caixa que la conté: després d'estirar punts fora (o d'encongir-la), la caixa
 * de l'objecte (`box`, mm) s'ajusta a la forma i els punts tornen de 0 a 1.
 */
export function normalizeCage(cage: MeshCage, box: ObjectBox): { cage: MeshCage; box: ObjectBox } {
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of cage.v) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, p[k]!)
    hi[k] = Math.max(hi[k]!, p[k]!)
  }
  const size = [box.w, box.h, box.d]
  const span = [0, 1, 2].map((k) => Math.max(1e-6, hi[k]! - lo[k]!))
  const v = cage.v.map((p) => p.map((x, k) => roundTo((x - lo[k]!) / span[k]!, 5)) as V3)
  return {
    cage: { ...cage, v },
    box: { x: roundTo(box.x + lo[0]! * size[0]!, 1), y: roundTo(box.y + lo[1]! * size[1]!, 1), z: roundTo(box.z + lo[2]! * size[2]!, 1), w: roundTo(Math.max(1, span[0]! * size[0]!), 1), h: roundTo(Math.max(1, span[1]! * size[1]!), 1), d: roundTo(Math.max(1, span[2]! * size[2]!), 1) },
  }
}

/** Els triangles de la forma en coordenades de la composició (mm). */
export function meshWorldTriangles(o: ObjectBox & { mesh?: MeshCage }): [V3, V3, V3][] {
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
  // Per sobre de la cara (negatiu, fins a −T): la vora exacta és on passa per 0 (el 3D la segueix).
  const d: number[] = Array.from(best, (z) => (Number.isFinite(z) ? roundTo(Math.max(-T, Math.min(T, face === "A" ? T - z : z)), 2) : 0))
  if (!d.some((x) => x > 0.05)) return null
  return { x0: roundTo(x0, 2), y0: roundTo(y0, 2), nx, ny, d }
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
  for (const i of ids) {
    if (done.has(i)) continue
    done.add(i)
    const j = mirror?.[i]
    const onPlane = mirror && j === i
    v[i] = [roundTo(cage.v[i]![0] + (onPlane ? 0 : delta[0]), 5), roundTo(cage.v[i]![1] + delta[1], 5), roundTo(cage.v[i]![2] + delta[2], 5)]
    if (mirror && j !== undefined && j !== i && !done.has(j)) {
      done.add(j)
      v[j] = [roundTo(cage.v[j]![0] - delta[0], 5), roundTo(cage.v[j]![1] + delta[1], 5), roundTo(cage.v[j]![2] + delta[2], 5)]
    }
  }
  return { ...cage, v }
}

/** Volum amb signe (positiu si les cares miren cap a fora). */
function signedVolume(v: V3[], f: number[][]): number {
  let vol = 0
  for (const fc of f)
    for (let i = 1; i + 1 < fc.length; i++) {
      const p = v[fc[0]!]!, q = v[fc[i]!]!, r = v[fc[i + 1]!]!
      vol += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6
    }
  return vol
}

/**
 * Forma de revolució (com la «Revolució» de SolidWorks): el perfil `[radi, alçada, viva?]` de dalt a baix (radi i alçada de 0
 * a 1; radi 0 = el punt de l'eix) girat en `n` costats al voltant de l'eix vertical. Els anells amb `viva` fan aresta viva
 * (un cantell recte).
 */
function revolveCage(profile: [number, number, boolean?][], n = 8): MeshCage {
  const v: V3[] = []
  const rings: number[][] = profile.map(([r, y]) => {
    if (r < 1e-6) {
      v.push([0.5, y, 0.5])
      return [v.length - 1]
    }
    return Array.from({ length: n }, (_, k) => {
      const t = (k / n) * Math.PI * 2 + Math.PI / n
      v.push([0.5 + 0.5 * r * Math.cos(t), y, 0.5 + 0.5 * r * Math.sin(t)])
      return v.length - 1
    })
  })
  const f: number[][] = []
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i]!, b = rings[i + 1]!
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n
      if (a.length === 1 && b.length === 1) continue
      if (a.length === 1) f.push([a[0]!, b[k1]!, b[k]!])
      else if (b.length === 1) f.push([a[k]!, a[k1]!, b[0]!])
      else f.push([a[k]!, a[k1]!, b[k1]!, b[k]!])
    }
  }
  const faces = signedVolume(v, f) < 0 ? f.map((fc) => [...fc].reverse()) : f
  const crease: [number, number][] = []
  profile.forEach(([, , viva], i) => {
    const ring = rings[i]!
    if (viva && ring.length > 1) for (let k = 0; k < n; k++) crease.push([ring[k]!, ring[(k + 1) % n]!])
  })
  return { v, f: faces, ...(crease.length ? { crease } : {}) }
}

/** La caixa de partida amb les dotze arestes del cub vives: una caixa amb les cares lleugerament bombades. */
function sharpBoxCage(): MeshCage {
  const c = boxCage()
  const onEdge = (p: V3) => p.filter((x) => x === 0 || x === 1).length >= 2
  const crease: [number, number][] = []
  const seen = new Set<string>()
  for (const fc of c.f)
    fc.forEach((a, k) => {
      const b = fc[(k + 1) % fc.length]!
      const pa = c.v[a]!, pb = c.v[b]!
      // Del mateix cantell del cub: tots dos hi són i comparteixen les dues coordenades de la vora.
      const shared = [0, 1, 2].filter((i) => (pa[i] === 0 || pa[i] === 1) && pa[i] === pb[i]).length
      const key = edgeKey(a, b)
      if (onEdge(pa) && onEdge(pb) && shared >= 2 && !seen.has(key)) {
        seen.add(key)
        crease.push([a, b])
      }
    })
  return { ...c, crease }
}

/**
 * Formes de partida de l'editor (per decisió de l'usuari, 2026-10-17: «una col·lecció de formes per no començar sempre amb
 * l'ovalat», «cantons rectes»): cada una ja amb les arestes vives que toquen.
 */
export const START_SHAPES: { id: string; label: string; make: () => MeshCage }[] = [
  { id: "pillow", label: "Coixí", make: () => boxCage() },
  { id: "box", label: "Caixa", make: () => sharpBoxCage() },
  { id: "cylinder", label: "Cilindre", make: () => revolveCage([[0, 1], [1, 1, true], [1, 0, true], [0, 0]]) },
  { id: "bowl", label: "Pica", make: () => revolveCage([[0, 1], [1, 1, true], [0.97, 0.45], [0.65, 0.04], [0, 0]]) },
  { id: "steps", label: "Esglaons", make: () => revolveCage([[0, 1], [0.4, 1, true], [0.4, 0.66, true], [0.7, 0.66, true], [0.7, 0.33, true], [1, 0.33, true], [1, 0, true], [0, 0]]) },
  { id: "cone", label: "Con", make: () => revolveCage([[0, 1], [1, 1, true], [0, 0]]) },
  { id: "sphere", label: "Esfera", make: () => revolveCage([[0, 1], [0.75, 0.93], [1, 0.5], [0.75, 0.07], [0, 0]]) },
]

/**
 * Extrudeix les cares que tenen tots els punts triats (com l'«Extrudir» de l'xShape): els punts de la zona es dupliquen,
 * es mouen `dist` (de 0 a 1 de la caixa) cap a fora de la cara (la normal mitjana) i les vores de la zona fan cares noves
 * de costat. Torna la caixa i els punts nous (els que queden triats).
 */
export function extrudeFaces(cage: MeshCage, ids: readonly number[], dist: number): { cage: MeshCage; ids: number[] } {
  const sel = new Set(ids)
  const region = cage.f.map((fc, i) => (fc.every((a) => sel.has(a)) ? i : -1)).filter((i) => i >= 0)
  if (!region.length) return { cage, ids: [...ids] }
  const v = cage.v.map((p) => [...p] as V3)
  // Normal mitjana de la zona (Newell).
  const nrm: V3 = [0, 0, 0]
  for (const fi of region) {
    const fc = cage.f[fi]!
    fc.forEach((a, k) => {
      const p = v[a]!, q = v[fc[(k + 1) % fc.length]!]!
      nrm[0] += (p[1] - q[1]) * (p[2] + q[2])
      nrm[1] += (p[2] - q[2]) * (p[0] + q[0])
      nrm[2] += (p[0] - q[0]) * (p[1] + q[1])
    })
  }
  const len = Math.hypot(...nrm) || 1
  const dir: V3 = [nrm[0] / len, nrm[1] / len, nrm[2] / len]
  const inRegion = new Set(region.flatMap((fi) => cage.f[fi]!))
  const map = new Map<number, number>()
  for (const a of inRegion) {
    map.set(a, v.length)
    const p = v[a]!
    v.push([p[0] + dir[0] * dist, p[1] + dir[1] * dist, p[2] + dir[2] * dist])
  }
  // Vores de la zona: arestes que només són d'una cara de la zona (amb el sentit d'aquella cara).
  const count = new Map<string, number>()
  for (const fi of region) cage.f[fi]!.forEach((a, k, fc) => count.set(edgeKey(a, fc[(k + 1) % fc.length]!), (count.get(edgeKey(a, fc[(k + 1) % fc.length]!)) ?? 0) + 1))
  const f = cage.f.map((fc, i) => (region.includes(i) ? fc.map((a) => map.get(a)!) : fc))
  for (const fi of region) {
    const fc = cage.f[fi]!
    fc.forEach((a, k) => {
      const b = fc[(k + 1) % fc.length]!
      if (count.get(edgeKey(a, b)) !== 1) return
      f.push([a, b, map.get(b)!, map.get(a)!])
    })
  }
  return { cage: { ...cage, v, f }, ids: [...map.values()] }
}

/**
 * Forma estirada al llarg de X (com el «Recobriment» de SolidWorks): una secció (anell de punts `[z, y]`, mm) a cada
 * posició `xs` (mm), unides amb quadrats i tapades als extrems. Totes les seccions amb el mateix nombre de punts. Els
 * costats `sharp` (índex j = del punt j al j + 1 de l'anell) queden plans al llarg de tota la forma (arestes vives): el
 * terra d'un banc, la paret d'un prestatge. Amb `inner` (un anell per secció, amb tants punts com el de fora i en el
 * mateix sentit), la forma és un tub: té un forat de banda a banda (una butaca de bucle, una taula amb un buit). Amb
 * `flatEnds`, les vores de les dues tapes són vives: els extrems queden tallats rectes (sense arrodonir). Torna la caixa
 * (mm, cantonada a 0) i la caixa de control de 0 a 1. Pur.
 */
export function loftCage(
  rings: [number, number][][],
  xs: number[],
  sharp: number[] = [],
  inner?: [number, number][][],
  flatEnds = false,
): { cage: MeshCage; box: ObjectBox } {
  const k = rings[0]!.length
  const n = rings.length
  const mm: V3[] = [...rings, ...(inner ?? [])].flatMap((ring, i) => ring.map(([z, y]): V3 => [xs[i % n]!, y, z]))
  const r = (i: number, j: number) => i * k + ((j + k) % k)
  const q = (i: number, j: number) => (n + i) * k + ((j + k) % k)
  const last = n - 1
  const f: number[][] = []
  for (let i = 0; i < last; i++) for (let j = 0; j < k; j++) f.push([r(i, j), r(i, j + 1), r(i + 1, j + 1), r(i + 1, j)])
  if (inner) {
    for (let i = 0; i < last; i++) for (let j = 0; j < k; j++) f.push([q(i + 1, j), q(i + 1, j + 1), q(i, j + 1), q(i, j)])
    for (let j = 0; j < k; j++) f.push([r(0, j + 1), r(0, j), q(0, j), q(0, j + 1)], [r(last, j), r(last, j + 1), q(last, j + 1), q(last, j)])
  } else f.push(Array.from({ length: k }, (_, j) => r(0, k - 1 - j)), Array.from({ length: k }, (_, j) => r(last, j)))
  const faces = signedVolume(mm, f) < 0 ? f.map((fc) => [...fc].reverse()) : f
  const crease: [number, number][] = []
  for (const j of sharp) {
    for (let i = 0; i < last; i++) crease.push([r(i, j), r(i + 1, j)], [r(i, j + 1), r(i + 1, j + 1)])
    crease.push([r(0, j), r(0, j + 1)], [r(last, j), r(last, j + 1)])
  }
  if (flatEnds)
    for (let j = 0; j < k; j++) {
      crease.push([r(0, j), r(0, j + 1)], [r(last, j), r(last, j + 1)])
      if (inner) crease.push([q(0, j), q(0, j + 1)], [q(last, j), q(last, j + 1)])
    }
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of mm) for (let a = 0; a < 3; a++) {
    lo[a] = Math.min(lo[a]!, p[a]!)
    hi[a] = Math.max(hi[a]!, p[a]!)
  }
  const span = [0, 1, 2].map((a) => Math.max(1e-6, hi[a]! - lo[a]!))
  const v = mm.map((p) => p.map((x, a) => roundTo((x - lo[a]!) / span[a]!, 5)) as V3)
  const unique = [...new Map(crease.map(([a, b]) => [edgeKey(a, b), [Math.min(a, b), Math.max(a, b)] as [number, number]])).values()]
  return {
    cage: { v, f: faces, ...(unique.length ? { crease: unique } : {}) },
    box: { x: roundTo(lo[0]!, 1), y: roundTo(lo[1]!, 1), z: roundTo(lo[2]!, 1), w: roundTo(span[0]!, 1), h: roundTo(span[1]!, 1), d: roundTo(span[2]!, 1) },
  }
}
