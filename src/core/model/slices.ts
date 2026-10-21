import { roundTo } from "../../lib/format"
import { newId, type Composition, type RefObject } from "./composition"
import { PART_AXES, type FreePart, type PartOrient } from "./freePart"
import { subdivide } from "./meshShape"
import { bounds, distToPolygon, pointInPolygon, polygonArea, signedArea, type Pt } from "./polygon"

/**
 * **Mobles de llistons** (per decisió de l'usuari, 2026-10-21: bancs, sofàs, taulells i murals «paramètrics» fets de molts
 * taulers tallats): una drecera que talla una forma lliure (`RefObject` amb `mesh`) en llistons paral·lels. Cada llistó és
 * una **peça lliure normal** amb el contorn de la secció de la forma al mig del seu gruix; un forat de la secció, una peça
 * lliure que talla; les barres roscades que els uneixen, cilindres que tallen. No hi ha cap peça especial: després es
 * poden editar, moure o esborrar com qualsevol altra. Tot va al grup de la forma (que queda amagada), i tornar a tallar
 * en refà el grup. Pur.
 */

type V3 = [number, number, number]

/** Direcció en què s'apilen els llistons (la normal del tauler). */
export type SliceAxis = "x" | "y" | "z"

export interface SliceOptions {
  axis: SliceAxis
  /** Gruix del tauler (mm). */
  thickness: number
  /** Aire entre dos llistons (mm); 0 = encolats l'un contra l'altre. */
  gap: number
  material: string
  /** Barres roscades que travessen els llistons (0–4). */
  rods: number
  /** Ø del forat de les barres (mm). */
  rodDiameter: number
}

export const DEFAULT_SLICES: SliceOptions = { axis: "x", thickness: 19, gap: 15, material: "Roure massís / xapat", rods: 2, rodDiameter: 10 }

/** Orientació de la peça lliure segons la direcció de l'apilat (la normal del tauler és l'eix). */
const SLICE_ORIENT: Record<SliceAxis, PartOrient> = { x: "side", y: "flat", z: "front" }

const AXIS: Record<SliceAxis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 }

/** Peces més petites que això (mm) no es fan: les puntes de la forma als extrems. */
const MIN_SIDE = 15
/** Distància mínima del forat de la barra a la vora del llistó (mm), a més del radi. */
const ROD_MARGIN = 15

interface Mesh {
  positions: V3[]
  triangles: [number, number, number][]
}

/**
 * Seccions d'una malla tancada pel pla `p[a] = c`: els contorns tancats com a llistes de punts 3D. Cada punt és on una
 * aresta de la malla travessa el pla; dos triangles veïns comparteixen el punt (la mateixa aresta), i així els trossos
 * s'encadenen sense toleràncies.
 */
function sectionLoops(mesh: Mesh, a: 0 | 1 | 2, c: number): V3[][] {
  const d = mesh.positions.map((p) => (Math.abs(p[a] - c) < 1e-9 ? 1e-9 : p[a] - c))
  const key = (i: number, j: number) => (i < j ? `${i}_${j}` : `${j}_${i}`)
  const pts = new Map<string, V3>()
  const adj = new Map<string, string[]>()
  const link = (x: string, y: string) => {
    adj.set(x, [...(adj.get(x) ?? []), y])
    adj.set(y, [...(adj.get(y) ?? []), x])
  }
  for (const t of mesh.triangles) {
    const cross: string[] = []
    for (let k = 0; k < 3; k++) {
      const i = t[k]!, j = t[(k + 1) % 3]!
      if (d[i]! > 0 === d[j]! > 0) continue
      const kk = key(i, j)
      if (!pts.has(kk)) {
        const s = d[i]! / (d[i]! - d[j]!)
        const p = mesh.positions[i]!, q = mesh.positions[j]!
        pts.set(kk, [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s])
      }
      cross.push(kk)
    }
    if (cross.length === 2) link(cross[0]!, cross[1]!)
  }
  const seen = new Set<string>()
  const loops: V3[][] = []
  for (const start of adj.keys()) {
    if (seen.has(start)) continue
    const loop: V3[] = []
    let prev: string | undefined
    let cur: string | undefined = start
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      loop.push(pts.get(cur)!)
      const next: string | undefined = adj.get(cur)!.find((n) => n !== prev && !seen.has(n))
      prev = cur
      cur = next
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** Douglas–Peucker d'un contorn tancat (tolerància en mm). */
function simplifyLoop(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 4) return pts
  const far = pts.reduce((best, p, i) => (Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]) > Math.hypot(pts[best]![0] - pts[0]![0], pts[best]![1] - pts[0]![1]) ? i : best), 0)
  const open = (q: Pt[]): Pt[] => {
    const keep = new Uint8Array(q.length)
    keep[0] = keep[q.length - 1] = 1
    const stack: [number, number][] = [[0, q.length - 1]]
    while (stack.length) {
      const [s, e] = stack.pop()!
      const [ax, ay] = q[s]!, [bx, by] = q[e]!
      const len = Math.hypot(bx - ax, by - ay) || 1
      let worst = -1, dmax = tol
      for (let i = s + 1; i < e; i++) {
        const dist = Math.abs((bx - ax) * (ay - q[i]![1]) - (ax - q[i]![0]) * (by - ay)) / len
        if (dist > dmax) {
          dmax = dist
          worst = i
        }
      }
      if (worst >= 0) {
        keep[worst] = 1
        stack.push([s, worst], [worst, e])
      }
    }
    return q.filter((_, i) => keep[i])
  }
  const a = open(pts.slice(0, far + 1))
  const b = open([...pts.slice(far), pts[0]!])
  return [...a, ...b.slice(1, -1)]
}

/** Un llistó: el contorn (u, v de la composició) i els seus forats. */
interface Slab {
  /** Cantonada mínima de l'apilat (mm, sobre l'eix). */
  s: number
  outer: Pt[]
  holes: Pt[][]
}

/** Llistons d'una malla (coordenades de la composició): posicions centrades a la forma, `thickness + gap` de pas. */
export function sliceMesh(mesh: Mesh, axis: SliceAxis, thickness: number, gap: number): Slab[][] {
  const a = AXIS[axis]
  const ax = PART_AXES[SLICE_ORIENT[axis]]
  let lo = Infinity, hi = -Infinity
  for (const p of mesh.positions) {
    lo = Math.min(lo, p[a])
    hi = Math.max(hi, p[a])
  }
  const pitch = thickness + Math.max(0, gap)
  const n = Math.floor((hi - lo + Math.max(0, gap)) / pitch)
  if (n < 1) return []
  const start = lo + (hi - lo - (n * thickness + (n - 1) * Math.max(0, gap))) / 2
  const out: Slab[][] = []
  for (let k = 0; k < n; k++) {
    const s = start + k * pitch
    const loops = sectionLoops(mesh, a, s + thickness / 2)
      .map((l) => simplifyLoop(l.map((p): Pt => [p[ax.u], p[ax.v]]), 0.2))
      .filter((l) => {
        const b = bounds(l)
        return l.length >= 3 && b.x1 - b.x0 >= 1 && b.y1 - b.y0 >= 1
      })
    // Parell-senar: un contorn dins d'un nombre senar d'altres és un forat del més petit que el conté.
    const depth = loops.map((l, i) => loops.filter((m, j) => j !== i && pointInPolygon(l[0]!, m)).length)
    const slabs: Slab[] = []
    loops.forEach((l, i) => {
      if (depth[i]! % 2) return
      const b = bounds(l)
      if (b.x1 - b.x0 < MIN_SIDE || b.y1 - b.y0 < MIN_SIDE) return
      const holes = loops.filter((h, j) => depth[j] === depth[i]! + 1 && pointInPolygon(h[0]!, l))
      slabs.push({ s, outer: l, holes })
    })
    out.push(slabs)
  }
  return out
}

/** Nodes del perfil d'una peça lliure (u, v locals des de la cantonada; estirada, la v cap al davant) i la seva caixa. */
function localShape(poly: Pt[], orient: PartOrient): { nodes: { x: number; y: number }[]; u0: number; v0: number; w: number; h: number } {
  const b = bounds(poly)
  const flip = orient === "flat"
  let pts = poly.map(([u, v]): Pt => [roundTo(u - b.x0, 1), roundTo(flip ? b.y1 - v : v - b.y0, 1)])
  if (signedArea(pts) < 0) pts = [...pts].reverse()
  const nodes = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1]![0] || p[1] !== pts[i - 1]![1]).map(([x, y]) => ({ x, y }))
  return { nodes, u0: b.x0, v0: b.y0, w: roundTo(b.x1 - b.x0, 1), h: roundTo(b.y1 - b.y0, 1) }
}

/** Peça lliure del contorn `poly` al llistó que comença a `s`. */
function slabPart(poly: Pt[], s: number, o: SliceOptions, name: string, group: string, cut = false): FreePart {
  const orient = SLICE_ORIENT[o.axis]
  const ax = PART_AXES[orient]
  const { nodes, u0, v0, w, h } = localShape(poly, orient)
  const at: V3 = [0, 0, 0]
  at[ax.n] = roundTo(s, 1)
  at[ax.u] = roundTo(u0, 1)
  at[ax.v] = roundTo(v0, 1)
  return {
    id: newId("p"),
    name,
    orient,
    w,
    h,
    thickness: o.thickness,
    material: o.material,
    x: at[0],
    y: at[1],
    z: at[2],
    shape: nodes,
    group,
    ...(cut ? { effect: "cut" as const } : {}),
  }
}

/** El punt (u, v) cau dins del llistó amb marge per al forat de la barra. */
function holdsRod(slab: Slab, p: Pt, clear: number): boolean {
  if (!pointInPolygon(p, slab.outer) || distToPolygon(p[0], p[1], slab.outer) < clear) return false
  return slab.holes.every((h) => !pointInPolygon(p, h) && distToPolygon(p[0], p[1], h) >= clear)
}

/**
 * Barres que uneixen els llistons: es busca, per franges del costat llarg de la forma, el punt que travessa més llistons
 * seguits amb marge (radi + `ROD_MARGIN`); la barra va del primer al darrer. Torna el punt (u, v) i els llistons.
 */
function placeRods(stack: Slab[][], o: SliceOptions): { at: Pt; from: number; to: number }[] {
  if (o.rods < 1) return []
  const all = stack.flat()
  if (!all.length) return []
  const b = bounds(all.flatMap((s) => s.outer))
  const clear = o.rodDiameter / 2 + ROD_MARGIN
  const step = Math.max(8, Math.min(b.x1 - b.x0, b.y1 - b.y0) / 30)
  const longU = b.x1 - b.x0 >= b.y1 - b.y0
  const span = longU ? b.x1 - b.x0 : b.y1 - b.y0
  const rods: { at: Pt; from: number; to: number }[] = []
  for (let r = 0; r < o.rods; r++) {
    let best: { at: Pt; from: number; to: number; score: number } | undefined
    const band0 = (span * r) / o.rods, band1 = (span * (r + 1)) / o.rods
    for (let x = b.x0 + step / 2; x < b.x1; x += step)
      for (let y = b.y0 + step / 2; y < b.y1; y += step) {
        const along = (longU ? x - b.x0 : y - b.y0)
        if (along < band0 || along >= band1) continue
        const p: Pt = [x, y]
        // La tira més llarga de llistons seguits que el contenen.
        let run = 0, from = -1, bestRun = 0, bestFrom = -1
        stack.forEach((slabs, k) => {
          if (slabs.some((s) => holdsRod(s, p, clear))) {
            if (run === 0) from = k
            run++
            if (run > bestRun) {
              bestRun = run
              bestFrom = from
            }
          } else run = 0
        })
        if (bestRun < 2) continue
        // A igual tira, la més a prop del mig de la franja.
        const mid = (band0 + band1) / 2
        const score = bestRun * 1e6 - Math.abs(along - mid)
        if (!best || score > best.score) best = { at: p, from: bestFrom, to: bestFrom + bestRun - 1, score }
      }
    if (best) rods.push({ at: [roundTo(best.at[0], 1), roundTo(best.at[1], 1)], from: best.from, to: best.to })
  }
  return rods
}

interface SliceResult {
  parts: FreePart[]
  rods: RefObject[]
  /** Llistons fets (peces que no tallen). */
  count: number
  /** Avisos per a l'usuari (en català). */
  warnings: string[]
}

/** Talla la forma lliure `o` en llistons dins del grup `group`. */
export function sliceObject(o: RefObject, opts: SliceOptions, group: string): SliceResult {
  if (o.shape !== "mesh" || !o.mesh) return { parts: [], rods: [], count: 0, warnings: ["Només es pot tallar en llistons una forma lliure."] }
  const s = subdivide(o.mesh)
  const mesh: Mesh = { positions: s.positions.map((p): V3 => [o.x + p[0] * o.w, o.y + p[1] * o.h, o.z + p[2] * o.d]), triangles: s.triangles }
  const stack = sliceMesh(mesh, opts.axis, opts.thickness, opts.gap)
  const parts: FreePart[] = []
  let n = 0
  stack.forEach((slabs) => {
    if (!slabs.length) return
    n++
    slabs.forEach((slab, i) => {
      const name = `Llistó ${n}${slabs.length > 1 ? String.fromCharCode(97 + i) : ""}`
      parts.push(slabPart(slab.outer, slab.s, opts, name, group))
      slab.holes.forEach((h, j) => {
        const b = bounds(h)
        if (b.x1 - b.x0 >= 2 && b.y1 - b.y0 >= 2 && polygonArea(h) > 4) parts.push(slabPart(h, slab.s, opts, `Buit ${name}${slab.holes.length > 1 ? `.${j + 1}` : ""}`, group, true))
      })
    })
  })
  const warnings: string[] = []
  if (!n) warnings.push(`La forma és massa prima per a llistons de ${opts.thickness} mm.`)
  const a = AXIS[opts.axis]
  const ax = PART_AXES[SLICE_ORIENT[opts.axis]]
  const placed = placeRods(stack, opts)
  const rods = placed.map(({ at, from, to }, i): RefObject => {
    const s0 = stack[from]![0]!.s
    const s1 = stack[to]![0]!.s + opts.thickness
    const min: V3 = [0, 0, 0], size: V3 = [0, 0, 0]
    min[a] = roundTo(s0, 1)
    size[a] = roundTo(s1 - s0, 1)
    min[ax.u] = roundTo(at[0] - opts.rodDiameter / 2, 1)
    min[ax.v] = roundTo(at[1] - opts.rodDiameter / 2, 1)
    size[ax.u] = size[ax.v] = opts.rodDiameter
    return { id: newId("r"), name: `Barra ${i + 1} Ø${opts.rodDiameter} · ${Math.round(s1 - s0)} mm`, group, effect: "cut", shape: "cylinder", axis: opts.axis, x: min[0], y: min[1], z: min[2], w: size[0], h: size[1], d: size[2] }
  })
  if (opts.rods > 0 && n) {
    const held = new Set(placed.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from + k)))
    const loose = stack.filter((slabs, k) => slabs.length && !held.has(k)).length
    if (!placed.length) warnings.push("No hi cap cap barra: la forma és massa prima o canvia massa d'un llistó a l'altre. Uneix-los d'una altra manera (encolats, amb separació 0).")
    else if (loose) warnings.push(`${loose} llistons no els travessa cap barra: uneix-los d'una altra manera o posa-hi més barres.`)
  }
  return { parts, rods, count: parts.filter((p) => !p.effect).length, warnings }
}

/**
 * La drecera «Tallar en llistons»: treu els llistons i les barres d'abans del grup de la forma, hi posa els nous i amaga
 * la forma (es pot tornar a mostrar, editar i tornar a tallar). El grup és el de la forma o, si no en té, el seu nom.
 */
export function applySlices(comp: Composition, refId: string, opts: SliceOptions): { comp: Composition; result: SliceResult } {
  const o = comp.references.find((r) => r.id === refId)
  if (!o) return { comp, result: { parts: [], rods: [], count: 0, warnings: [] } }
  const group = o.group ?? uniqueGroup(comp, `${o.name} · llistons`)
  const result = sliceObject(o, opts, group)
  if (!result.count) return { comp, result }
  const references = comp.references.filter((r) => r.id === refId || r.group !== group).map((r) => (r.id === refId ? { ...r, group, hidden: true } : r))
  return {
    comp: { ...comp, parts: [...(comp.parts ?? []).filter((p) => p.group !== group), ...result.parts], references: [...references, ...result.rods] },
    result,
  }
}

/** Un nom de grup que no fa servir ningú. */
function uniqueGroup(comp: Composition, base: string): string {
  const used = new Set([...(comp.parts ?? []), ...comp.references, ...(comp.models ?? [])].flatMap((x) => (x.group ? [x.group] : [])))
  if (!used.has(base)) return base
  let i = 2
  while (used.has(`${base} ${i}`)) i++
  return `${base} ${i}`
}

/** Les opcions amb què es va tallar la forma (els llistons i les barres del seu grup), o les de per defecte. */
export function currentSlices(comp: Composition, refId: string): SliceOptions {
  const o = comp.references.find((r) => r.id === refId)
  const group = o?.group
  const slats = group ? (comp.parts ?? []).filter((p) => p.group === group && !p.effect) : []
  if (!slats.length) return DEFAULT_SLICES
  const axis = (Object.keys(SLICE_ORIENT) as SliceAxis[]).find((a) => SLICE_ORIENT[a] === slats[0]!.orient) ?? "x"
  const key = (["x", "y", "z"] as const)[AXIS[axis]]
  const at = [...new Set(slats.map((p) => p[key]))].sort((a, b) => a - b)
  const pitch = at.length > 1 ? Math.min(...at.slice(1).map((v, i) => v - at[i]!)) : slats[0]!.thickness + DEFAULT_SLICES.gap
  const rods = comp.references.filter((r) => r.group === group && r.id !== refId && r.shape === "cylinder")
  return {
    axis,
    thickness: slats[0]!.thickness,
    gap: Math.max(0, roundTo(pitch - slats[0]!.thickness, 1)),
    material: slats[0]!.material,
    rods: Math.min(4, rods.length),
    rodDiameter: rods[0] ? Math.min(rods[0].w, rods[0].h, rods[0].d) : DEFAULT_SLICES.rodDiameter,
  }
}
