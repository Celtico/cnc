import * as pcNs from "polygon-clipping"
import {
  DEFAULT_JOINERY,
  NO_EDGES,
  PART_AXES,
  ccw,
  flatten,
  partBox,
  polygonArea,
  resolveParts,
  compositionKind,
  type Composition,
  type Cutout,
  type EdgeSide,
  type FreePart,
  type Groove,
  type Hole,
  type Joinery,
  type Panel,
  type Pt,
  type Vec3,
} from "../model"
import { normalizePanel } from "./buildCabinet"
import { shapeOutline } from "./buildModule"

// El paquet només té export per defecte (el .d.ts declara els noms): acceptem les dues formes.
const pc = ((pcNs as unknown as { default?: typeof pcNs }).default ?? pcNs) as typeof pcNs

/**
 * Encaixos entre peces lliures, calculats per geometria (com els generadors de «slot and
 * tab» dels programes de CNC). Per a cada parell de peces d'orientació diferent:
 *  - Una entra dins de l'altra i hi acaba (T): pestanyes a la que entra i mortalles a
 *    l'altra (passants si la travessa; si no, ranures cegues de la fondària que hi entra).
 *  - Totes dues s'encreuen (X): mitja fusta; cadascuna amb una ranura fins a la meitat.
 *  - Totes dues hi acaben (L, cantonada): dits alterns (finger joint).
 *  - Només es toquen, el cantell d'una sobre la cara de l'altra: espigues.
 * El joc (`clearance`) eixampla les mortalles i les ranures; les cantonades interiors
 * porten dogbone del Ø de la fresa perquè la peça hi entri fins al fons.
 */
export type PartJointKind = "tab" | "lap" | "finger" | "dowel"
export interface PartJoint {
  kind: PartJointKind
  a: string
  b: string
  /** Per a les pestanyes i les espigues: quina peça entra (o recolza el cantell). */
  into?: string
  /** Pestanyes: mortalla passant (true) o cega. */
  through?: boolean
}

export interface FreePartsBuild {
  panels: Panel[]
  /** Peces que no es tallen a la CNC (ferro, pedra, vidre…): només 3D i llista. */
  extras: Panel[]
  joints: PartJoint[]
  warnings: { message: string; partId: string }[]
}

const TOL = 0.5
type Range = [number, number]
type Axis = 0 | 1 | 2

interface Work {
  part: FreePart
  removals: Pt[][]
  grooves: Groove[]
  holes: Hole[]
}

const DOWEL = { diameter: 8, faceDepth: 12, edgeDepth: 20 }

export const JOINT_LABEL: Record<PartJointKind, string> = {
  tab: "Pestanyes",
  lap: "Mitja fusta",
  finger: "Dits",
  dowel: "Espigues",
}

/** Joc, fresa i pestanyes de la composició (amb els valors per defecte). */
export function joineryOf(comp: Composition): Joinery {
  return { ...DEFAULT_JOINERY, ...comp.joinery }
}

/** Interval local (u o v) d'un interval de la composició sobre l'eix `axis` de la peça. */
function localRange(p: FreePart, axis: Axis, [a, b]: Range): Range {
  const ax = PART_AXES[p.orient]
  const box = partBox(p)
  if (axis === ax.u) return [a - box.min[axis]!, b - box.min[axis]!]
  // Estirada: v = 0 al davant (z màxima), perquè vista de dalt la v vagi cap al fons.
  if (p.orient === "flat") return [box.max[axis]! - b, box.max[axis]! - a]
  return [a - box.min[axis]!, b - box.min[axis]!]
}

/** Rectangle local (u0, u1, v0, v1) d'una caixa donada per dos intervals de la composició. */
function localRect(p: FreePart, ranges: Partial<Record<Axis, Range>>): { u0: number; u1: number; v0: number; v1: number } {
  const ax = PART_AXES[p.orient]
  const [u0, u1] = localRange(p, ax.u, ranges[ax.u]!)
  const [v0, v1] = localRange(p, ax.v, ranges[ax.v]!)
  return { u0, u1, v0, v1 }
}

/** Costat de la peça (local) on queda l'extrem mínim o màxim d'un dels seus eixos del pla. */
function edgeAt(p: FreePart, axis: Axis, side: "min" | "max"): EdgeSide {
  const ax = PART_AXES[p.orient]
  if (axis === ax.u) return side === "min" ? "left" : "right"
  const low = p.orient === "flat" ? side === "max" : side === "min"
  return low ? "bottom" : "top"
}

/** Cara (A = local z = gruix) que queda al costat mínim o màxim de la normal. */
function faceAt(p: FreePart, side: "min" | "max"): "A" | "B" {
  // front: z local = +Z · side: z local = −X · flat: z local = +Y.
  if (p.orient === "side") return side === "min" ? "A" : "B"
  return side === "max" ? "A" : "B"
}

/** Rectangle a treure, amb dogbones a les cantonades que queden dins de la peça. */
function cutRect(w: Work, r: { u0: number; u1: number; v0: number; v1: number }, j: Joinery) {
  const { w: W, h: H } = w.part
  const poly: Pt[] = [
    [r.u0, r.v0],
    [r.u1, r.v0],
    [r.u1, r.v1],
    [r.u0, r.v1],
  ]
  w.removals.push(poly)
  const rad = j.tool / 2
  if (j.dogbones === false || rad <= 0) return
  const inside = (u: number, v: number) => u > 0.01 && u < W - 0.01 && v > 0.01 && v < H - 0.01
  for (const [cu, cv, su, sv] of [
    [r.u0, r.v0, 1, 1],
    [r.u1, r.v0, -1, 1],
    [r.u1, r.v1, -1, -1],
    [r.u0, r.v1, 1, -1],
  ] as const) {
    if (!inside(cu, cv)) continue
    // Cercle del radi de la fresa que passa per la cantonada, amb el centre sobre la diagonal.
    const cx = cu + (su * rad) / Math.SQRT2
    const cy = cv + (sv * rad) / Math.SQRT2
    w.removals.push(Array.from({ length: 20 }, (_, i) => [cx + rad * Math.cos((i / 20) * Math.PI * 2), cy + rad * Math.sin((i / 20) * Math.PI * 2)] as Pt))
  }
}

/** Posicions (centres) repartides al llarg d'un interval: n peces d'amplada ~`width`. */
function tabCentres(r: Range, width: number): { centres: number[]; tw: number } {
  const len = r[1] - r[0]
  const n = Math.max(1, Math.floor((len + width) / (2 * width)))
  const tw = Math.min(width, len / (2 * n) + (n === 1 ? len / 4 : 0))
  return { centres: Array.from({ length: n }, (_, i) => r[0] + (len * (i + 0.5)) / n), tw }
}

/**
 * Construeix les peces lliures: encaixos entre elles i un Panel per peça (contorn amb
 * les osques, mortalles passants com a talls, ranures cegues i espigues).
 */
export function buildFreeParts(comp: Composition, moduleNumber: number): FreePartsBuild {
  // Coordenades de la composició (les enganxades a un mòdul el segueixen).
  // Les que tallen no són peces: les fa `partCutters` (a `buildComposition`).
  const parts = resolveParts(comp).filter((p) => p.effect !== "cut")
  const j = joineryOf(comp)
  const cl = j.clearance
  const work = new Map<string, Work>(parts.map((p) => [p.id, { part: p, removals: [], grooves: [], holes: [] }]))
  const joints: PartJoint[] = []
  const warnings: FreePartsBuild["warnings"] = []
  const dowel = comp.modules[0]?.hardware?.dowel ?? DOWEL

  // Els encaixos són del Flat-pack: a la resta de mobles les peces lliures van soles.
  const joinery = compositionKind(comp) === "lliure"
  for (let i = 0; i < (joinery ? parts.length : 0); i++) {
    for (let k = i + 1; k < parts.length; k++) {
      const A = parts[i]!
      const B = parts[k]!
      const bA = partBox(A)
      const bB = partBox(B)
      const lo = [0, 1, 2].map((a) => Math.max(bA.min[a]!, bB.min[a]!))
      const hi = [0, 1, 2].map((a) => Math.min(bA.max[a]!, bB.max[a]!))
      const ov = (a: number) => hi[a]! - lo[a]!
      if (A.orient === B.orient) {
        // Paral·leles: no hi ha encaix possible; si s'encavalquen, és un error de disseny.
        if (ov(0) > TOL && ov(1) > TOL && ov(2) > TOL) warnings.push({ partId: A.id, message: `«${A.name}» i «${B.name}» s'encavalquen (són paral·leles, no s'hi pot fer encaix).` })
        continue
      }
      const nA = PART_AXES[A.orient].n
      const nB = PART_AXES[B.orient].n
      const L = (3 - nA - nB) as Axis
      if (ov(L) < 1) continue
      const dA = ov(nA)
      const dB = ov(nB)
      if (dA < -TOL || dB < -TOL) continue
      // Ferro, pedra, vidre…: ni encaixos ni avisos (es munten a part).
      if (A.nest === false || B.nest === false) continue
      if (A.joints === false || B.joints === false) {
        if (dA > TOL && dB > TOL) warnings.push({ partId: A.id, message: `«${A.name}» i «${B.name}» s'encavalquen i una no fa encaixos.` })
        continue
      }
      const wA = work.get(A.id)!
      const wB = work.get(B.id)!
      const rL: Range = [lo[L]!, hi[L]!]

      if (dA > TOL && dB > TOL) {
        // A travessa B si surt pels dos costats del gruix de B (i a l'inrevés).
        const aCrosses = bA.min[nB]! < bB.min[nB]! - TOL && bA.max[nB]! > bB.max[nB]! + TOL
        const bCrosses = bB.min[nA]! < bA.min[nA]! - TOL && bB.max[nA]! > bA.max[nA]! + TOL
        if (!aCrosses && bCrosses) tab(wA, wB, nB, nA)
        else if (!bCrosses && aCrosses) tab(wB, wA, nA, nB)
        else if (!aCrosses && !bCrosses) finger()
        else lap()
      } else if (Math.abs(dB) <= TOL && dA >= A.thickness - TOL) dowels(wA, wB, nB, nA)
      else if (Math.abs(dA) <= TOL && dB >= B.thickness - TOL) dowels(wB, wA, nA, nB)

      /** T: `T` entra dins del gruix de `M` i hi acaba. nM = normal de M; nT = normal de T. */
      function tab(T: Work, M: Work, nM: Axis, nT: Axis) {
        const bT = partBox(T.part)
        const bM = partBox(M.part)
        const through = ov(nM) >= M.part.thickness - TOL
        // T arriba des del costat mínim de M si el seu cos hi queda per sota.
        const fromMin = bT.min[nM]! < bM.min[nM]! - TOL
        const depth: Range = [lo[nM]!, hi[nM]!]
        const reach: Range = fromMin ? [depth[0], depth[1] + 1] : [depth[0] - 1, depth[1]]
        const { centres, tw } = tabCentres(rL, j.tabWidth)
        // Osques de T entre pestanyes (i als extrems, obertes si arriben a la vora de T).
        const edges = [rL[0], ...centres.flatMap((c) => [c - tw / 2, c + tw / 2]), rL[1]]
        for (let g = 0; g < edges.length; g += 2) {
          let g0 = edges[g]!
          let g1 = edges[g + 1]!
          if (g1 - g0 < 0.5) continue
          if (g === 0 && g0 <= bT.min[L]! + TOL) g0 -= 1
          if (g === edges.length - 2 && g1 >= bT.max[L]! - TOL) g1 += 1
          cutRect(T, localRect(T.part, { [L]: [g0, g1], [nM]: reach }), j)
        }
        // Mortalles a M, una per pestanya, amb el joc.
        for (const c of centres) {
          const rect = localRect(M.part, { [L]: [c - tw / 2 - cl / 2, c + tw / 2 + cl / 2], [nT]: [lo[nT]! - cl / 2, hi[nT]! + cl / 2] })
          if (through) cutRect(M, rect, j)
          else
            M.grooves.push({
              x: r2(rect.u0),
              y: r2(rect.v0),
              w: r2(rect.u1 - rect.u0),
              h: r2(rect.v1 - rect.v0),
              depth: r2(depth[1] - depth[0]),
              face: faceAt(M.part, fromMin ? "min" : "max"),
              tag: "mortise",
            })
        }
        joints.push({ kind: "tab", a: A.id, b: B.id, into: T.part.id, through })
      }

      /** Mitja fusta: A amb la ranura cap al costat màxim de L, B cap al mínim, fins a la meitat. */
      function lap() {
        const mid = (rL[0] + rL[1]) / 2
        cutRect(wA, localRect(A, { [L]: [mid, bA.max[L]! + 1], [nB]: [lo[nB]! - cl / 2, hi[nB]! + cl / 2] }), j)
        cutRect(wB, localRect(B, { [L]: [bB.min[L]! - 1, mid], [nA]: [lo[nA]! - cl / 2, hi[nA]! + cl / 2] }), j)
        joints.push({ kind: "lap", a: A.id, b: B.id })
      }

      /** Cantonada: dits alterns. Els extrems queden a A; B en treu els parells. */
      function finger() {
        const len = rL[1] - rL[0]
        let n = Math.max(3, Math.round(len / j.tabWidth))
        if (n % 2 === 0) n += 1
        const seg = len / n
        // Cap on s'acaba cada peça dins del gruix de l'altra (per obrir l'osca cap enfora).
        const aOut: Range = bA.min[nB]! >= bB.min[nB]! - TOL ? [lo[nB]! - 1, hi[nB]!] : [lo[nB]!, hi[nB]! + 1]
        const bOut: Range = bB.min[nA]! >= bA.min[nA]! - TOL ? [lo[nA]! - 1, hi[nA]!] : [lo[nA]!, hi[nA]! + 1]
        for (let s = 0; s < n; s++) {
          let s0 = rL[0] + s * seg - cl / 2
          let s1 = rL[0] + (s + 1) * seg + cl / 2
          if (s % 2 === 1) cutRect(wA, localRect(A, { [L]: [s0, s1], [nB]: aOut }), j)
          else {
            if (s === 0 && rL[0] <= bB.min[L]! + TOL) s0 -= 1
            if (s === n - 1 && rL[1] >= bB.max[L]! - TOL) s1 += 1
            cutRect(wB, localRect(B, { [L]: [s0, s1], [nA]: bOut }), j)
          }
        }
        joints.push({ kind: "finger", a: A.id, b: B.id })
      }

      /** El cantell de T recolza sobre la cara de M: espigues (forat al cantell i a la cara). */
      function dowels(T: Work, M: Work, nM: Axis, nT: Axis) {
        const bT = partBox(T.part)
        const bM = partBox(M.part)
        const len = rL[1] - rL[0]
        const count = len < 80 ? 1 : Math.max(2, Math.round(len / 250) + 1)
        const e = Math.min(50, len / 4)
        const at = count === 1 ? [rL[0] + len / 2] : Array.from({ length: count }, (_, q) => rL[0] + e + (q * (len - 2 * e)) / (count - 1))
        // T toca M pel seu costat màxim (M queda per sobre) o pel mínim.
        const tSide: "min" | "max" = Math.abs(bT.max[nM]! - bM.min[nM]!) <= TOL ? "max" : "min"
        const edge = edgeAt(T.part, nM, tSide)
        const mid = (lo[nT]! + hi[nT]!) / 2
        for (const c of at) {
          const pt = localRect(T.part, { [L]: [c, c], [nM]: [bT[tSide][nM]!, bT[tSide][nM]!] })
          T.holes.push({ x: r2(pt.u0), y: r2(pt.v0), diameter: dowel.diameter, depth: dowel.edgeDepth, face: "edge", edge, tag: "dowel" })
          const q = localRect(M.part, { [L]: [c, c], [nT]: [mid, mid] })
          M.holes.push({ x: r2(q.u0), y: r2(q.v0), diameter: dowel.diameter, depth: Math.min(dowel.faceDepth, M.part.thickness - 4), face: faceAt(M.part, tSide === "max" ? "min" : "max"), tag: "dowel" })
        }
        joints.push({ kind: "dowel", a: A.id, b: B.id, into: T.part.id })
      }
    }
  }

  // Centre del conjunt: la vista explosionada aparta cada peça cap enfora.
  const boxes = parts.map(partBox)
  const centre = [0, 1, 2].map((a) => (Math.min(...boxes.map((b) => b.min[a]!)) + Math.max(...boxes.map((b) => b.max[a]!))) / 2)

  const panels: Panel[] = []
  const extras: Panel[] = []
  for (const p of parts) {
    const w = work.get(p.id)!
    const { outline, cutouts, pieces } = partContour(p, w.removals)
    if (pieces > 1) warnings.push({ partId: p.id, message: `«${p.name}» queda partida en ${pieces} trossos pels encaixos: revisa'n la posició.` })
    ;(p.nest === false ? extras : panels).push(normalizePanel({
      id: `part:${p.id}`,
      name: p.name,
      label: p.name,
      role: "part",
      length: p.w,
      width: p.h,
      thickness: p.thickness,
      material: p.material,
      grain: p.grain === "v" ? "y" : p.grain === "none" ? "none" : "x",
      edges: p.edged && p.nest !== false ? { left: true, right: true, bottom: true, top: true } : { ...NO_EDGES },
      holes: w.holes,
      grooves: w.grooves,
      ...(cutouts.length ? { cutouts } : {}),
      ...(outline ? { outline } : {}),
      module: moduleNumber,
      placement: placementOf(p, centre as Vec3),
    }))
  }
  return { panels, extras, joints, warnings }
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Contorn final: la forma (o el rectangle) menys les osques; els forats interiors, talls. */
function partContour(p: FreePart, removals: Pt[][]): { outline?: Panel["outline"]; cutouts: Cutout[]; pieces: number } {
  const exact = p.shape ? shapeOutline(p.shape, p.w, p.h) : undefined
  if (!removals.length) return { ...(exact ? { outline: exact } : {}), cutouts: [], pieces: 1 }
  const base: Pt[] = exact
    ? flatten(exact)
    : [
        [0, 0],
        [p.w, 0],
        [p.w, p.h],
        [0, p.h],
      ]
  const res = pc.difference([base], ...removals.map((r) => [r]))
  if (!res.length) return { cutouts: [], pieces: 0 }
  const ringOf = (r: Pt[]): Pt[] => {
    const q = r.map(([x, y]) => [r2(x), r2(y)] as Pt)
    const last = q[q.length - 1]!
    if (q.length > 1 && last[0] === q[0]![0] && last[1] === q[0]![1]) q.pop()
    return ccw(q)
  }
  const main = res.reduce((best, poly) => (polygonArea(poly[0] as Pt[]) > polygonArea(best[0] as Pt[]) ? poly : best))
  const outer = ringOf(main[0] as Pt[])
  const cutouts: Cutout[] = main.slice(1).map((h) => ({ kind: "polygon", points: ringOf(h as Pt[]), tag: "mortise" }))
  const isRect = !exact && outer.length === 4 && outer.every(([x, y]) => (x === 0 || x === p.w) && (y === 0 || y === p.h))
  return { ...(isRect ? {} : { outline: outer }), cutouts, pieces: res.length }
}

/** Col·locació: base dextrogira amb u, v al pla de la peça i el gruix (z local) a la normal. */
function placementOf(p: FreePart, centre: Vec3): Panel["placement"] {
  const b = partBox(p)
  const n = PART_AXES[p.orient].n
  const out = (b.min[n]! + b.max[n]!) / 2 >= centre[n]! ? 1 : -1
  const explodeDir: Vec3 = [0, 0, 0]
  explodeDir[n] = out
  if (p.orient === "front") return { origin: [b.min[0], b.min[1], b.min[2]], xAxis: [1, 0, 0], yAxis: [0, 1, 0], zAxis: [0, 0, 1], explodeDir }
  if (p.orient === "side") return { origin: [b.max[0], b.min[1], b.min[2]], xAxis: [0, 0, 1], yAxis: [0, 1, 0], zAxis: [-1, 0, 0], explodeDir }
  return { origin: [b.min[0], b.min[1], b.max[2]], xAxis: [1, 0, 0], yAxis: [0, 0, -1], zAxis: [0, 1, 0], explodeDir }
}
