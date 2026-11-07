import type { FaceHit } from "../../components/viewer/facePick"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { autoLimits, dynBox, FIT_NOUN, fitWalls, ORIENT_OF_AXIS, partWithBox, wallBoxes, moduleOrigins3, newId, panelAabb, refitParts, type Composition, type FreePart, type Hole, type Panel, type PartOrient, type Vec3, PART_AXES, partSize, circlePts, rectPts, toPlane, type Sketch } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { pieceLocalId } from "./ModelingTree"

/** Les eines del Taulell que es fan clicant una cara de la peça. */
export type FaceToolId = "rect" | "poly" | "circle" | "face" | "dynpanel" | "fitblock" | "shelf" | "band" | "hole" | "cup" | "line32"

/** Les opcions de les eines (les mateixes del Taulell, amb els seus valors per defecte). */
export interface FaceToolOpts {
  fitOrient: PartOrient
  fitGap: number
  /** Tauler dinàmic: desplaçament des de la cara on es recolza. */
  dynOff: number
  /** Cara dinàmica: la cara triada (la peça lliure, l'eix i el costat: 0 el de baix, 1 el de dalt). */
  facePick?: { part: string; a: number; s: 0 | 1 }
  /** Esbós: el croquis que s'està dibuixant (el pla i els punts clicats). */
  draft?: { a: number; level: number; dir: 1 | -1; pts: [number, number][] }
  /** Esbós: el croquis triat (el de l'Extrusió). */
  selSketch?: string
  /** Esbós: les mides escrites del rectangle i el diàmetre del cercle. */
  sketchL: number
  sketchW: number
  sketchD: number
  T: number
  setback: number
  d: number
  depth: number
  cd: number
  cdepth: number
  ld: number
  ldepth: number
  pitch: number
  margin: number
}
export const DEFAULT_FACE_OPTS: FaceToolOpts = { fitOrient: "flat", fitGap: 0, dynOff: 0, sketchL: 600, sketchW: 400, sketchD: 300, T: 19, setback: 1, d: 8, depth: 12, cd: 35, cdepth: 13, ld: 5, ldepth: 12, pitch: 32, margin: 37 }

/** El nom de cada eina (el títol de la seva finestra d'opcions). */
export const FACE_TOOL_LABEL: Record<FaceToolId, string> = { rect: "Rectangle", poly: "Polilínia", circle: "Cercle", face: "Cara dinàmica", dynpanel: "Tauler dinàmic", fitblock: "Bloc condicionat", shelf: "Prestatge", band: "Cantell", hole: "Perforació", cup: "Cassoleta", line32: "Línia 32" }

/** El que diu cada eina mentre és activa (els textos del Taulell). */
export const FACE_TOOL_INFO: Record<FaceToolId, string> = {
  rect: "Rectangle: clica una cara per al primer cantó i després l'altre cantó (o escriu les mides).",
  poly: "Polilínia: clica els punts sobre una cara. Clica el primer punt o «Tanca» per acabar.",
  circle: "Cercle: clica el centre sobre una cara i després un punt de la vora (o escriu el diàmetre).",
  face: "Cara dinàmica: clica una cara d'una peça i escriu la mida nova en aquella direcció (la cara del davant es queda on és).",
  dynpanel: "Tauler dinàmic: clica la cara on es recolza (per exemple la base). Surt el tauler fins a les cares del costat i les segueix si el moble canvia.",
  fitblock: "Bloc condicionat: clica una cara de dins del buit. La peça l'omple i el segueix.",
  shelf: "Prestatge: clica la cara interior d'un lateral.",
  band: "Cantell: clica a prop del cantell de la peça per posar-lo o treure'l.",
  hole: "Perforació: clica la cara on va el forat.",
  cup: "Cassoleta: clica la cara de la porta on va la cassoleta.",
  line32: "Línia 32: clica la cara on va la filera de forats (al llarg de la peça).",
}

export interface FaceToolResult {
  comp?: Composition
  select?: Selection
  /** Opcions noves de l'eina (la cara triada de la Cara dinàmica). */
  opts?: FaceToolOpts
  message: string
  error?: boolean
}

const r1 = (v: number) => Math.round(v * 10) / 10
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

/** El mòdul d'una peça construïda (o undefined si és una peça lliure). */
function moduleOf(comp: Composition, p: Panel) {
  return p.id.startsWith("part:") || !p.module ? undefined : comp.modules[p.module - 1]
}

/** El punt a les coordenades de la peça (llarg, ample) i la cara (A: la del gruix cap a +z de la peça). */
function local(p: Panel, pt: Vec3, n: Vec3): { u: number; v: number; face: "A" | "B" | "edge" } {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const d = sub(pt, origin)
  const nz = dot(n, zAxis)
  return { u: dot(d, xAxis), v: dot(d, yAxis), face: nz > 0.5 ? "A" : nz < -0.5 ? "B" : "edge" }
}

function uniqueName(comp: Composition, base: string): string {
  const used = new Set((comp.parts ?? []).map((q) => q.name))
  let k = 1
  while (used.has(`${base} ${k}`)) k++
  return `${base} ${k}`
}

/** Afegeix forats a mà a la peça d'un mòdul (`Module.pieceEdits`). */
function addHoles(comp: Composition, p: Panel, holes: Hole[]): Composition | null {
  const m = moduleOf(comp, p)
  if (!m) return null
  const id = pieceLocalId(m.id, p.id)
  const cur = m.pieceEdits?.[id] ?? {}
  return { ...comp, modules: comp.modules.map((x) => (x.id !== m.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, holes: [...(cur.holes ?? []), ...holes] } } })) }
}

/** Fa l'eina `tool` amb el clic `hit`. */
export function runFaceTool(tool: FaceToolId, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, hit: FaceHit): FaceToolResult {
  const { panel: p, point: pt, normal: n } = hit
  const panels = build?.panels ?? []
  const host = moduleOf(comp, p)

  if (tool === "rect" || tool === "poly" || tool === "circle") {
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const d = o.draft
    const q = toPlane(d?.a ?? a, pt)
    if (!d) {
      const draft = { a, level: r1(pt[a]!), dir: (n[a]! > 0 ? 1 : -1) as 1 | -1, pts: [q] }
      return { opts: { ...o, draft }, message: "" }
    }
    if (tool === "rect") return finishSketch(comp, o, rectPts(d.pts[0]!, q), true)
    if (tool === "circle") return finishSketch(comp, o, circlePts(d.pts[0]!, 2 * Math.hypot(q[0] - d.pts[0]![0], q[1] - d.pts[0]![1])), false)
    const first = d.pts[0]!
    if (d.pts.length >= 3 && Math.hypot(q[0] - first[0], q[1] - first[1]) < 15) return finishSketch(comp, o, d.pts, false)
    return { opts: { ...o, draft: { ...d, pts: [...d.pts, q] } }, message: "" }
  }

  if (tool === "face") {
    if (!p.id.startsWith("part:")) return { message: "La mida de les peces d'un moble la porta el moble: canvia-la a les opcions del moble.", error: true }
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const id = p.id.slice(5)
    return { opts: { ...o, facePick: { part: id, a, s: n[a]! > 0 ? 1 : 0 } }, select: { kind: "part", id }, message: "" }
  }

  if (tool === "dynpanel") {
    const t = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const seed = pt.map((v, i) => v + n[i]! * (2 + o.dynOff)) as Vec3
    const limits = autoLimits(wallBoxes(panels), seed, t, (id) => id === p.id)
    limits.push({ panel: p.id, a: t, s: n[t]! > 0 ? 0 : 1, off: o.dynOff })
    const T = host?.carcass.thickness ?? o.T
    const dyn = { t, limits }
    const boxes = new Map(panels.map((q) => [q.id, panelAabb(q)] as const))
    const b = dynBox(dyn, (id) => boxes.get(id), T)
    if (!b) return { message: "El tauler queda sense mida: clica una cara que tingui peces al costat.", error: true }
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const base = uniqueName(comp, "Tauler dinàmic")
    const part = partWithBox({ id: newId("p"), name: base, orient: ORIENT_OF_AXIS[t]!, w: 0, h: 0, thickness: T, material: host?.carcass.material ?? p.material, x: 0, y: 0, z: 0, ...(host ? { module: host.id } : {}), dyn }, b, off)
    return { comp: { ...comp, parts: [...(comp.parts ?? []), part] }, select: { kind: "part", id: part.id }, message: `${base}: ${r1(part.w)} × ${r1(part.h)} mm, lligat a ${limits.length} cares` }
  }

  if (tool === "fitblock") {
    const ax = { flat: 1, side: 0, front: 2 }[o.fitOrient]
    const seed = pt.map((v, i) => v + n[i]! * 2) as Vec3
    if (Math.abs(n[ax]!) > 0.5) seed[ax] = pt[ax]! + Math.sign(n[ax]!) * (o.T / 2 + 0.5)
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const name = uniqueName(comp, FIT_NOUN[o.fitOrient])
    const part: FreePart = {
      id: newId("p"),
      name,
      orient: o.fitOrient,
      w: 10,
      h: 10,
      thickness: o.T,
      material: host?.carcass.material ?? p.material,
      x: seed[0] - 5 - off[0],
      y: seed[1] - 5 - off[1],
      z: seed[2] - 5 - off[2],
      ...(host ? { module: host.id } : {}),
      fit: { gap: o.fitGap },
    }
    const next = { ...comp, parts: [...(comp.parts ?? []), part] }
    const fitted = refitParts(next, panels).find((q) => q.id === part.id)!
    if (fitted.w === 10 && fitted.h === 10) return { message: "Aquí no hi ha cap buit tancat. Clica una cara de dins del buit (un lateral, la base, el fons…).", error: true }
    return { comp: { ...next, parts: next.parts.map((q) => (q.id === part.id ? fitted : q)) }, select: { kind: "part", id: part.id }, message: `${name}: ${r1(fitted.w)} × ${r1(fitted.h)} mm, ajustat al buit` }
  }

  if (tool === "shelf") {
    if (Math.abs(n[1]) > 0.3) return { message: "Clica una cara vertical (la cara interior d'un lateral).", error: true }
    const a = Math.abs(n[0]) >= Math.abs(n[2]) ? 0 : 2
    const b = a === 0 ? 2 : 0
    const s = Math.sign(n[a]!)
    const from = pt[a]! + s * 0.5
    let dist = Infinity
    for (const w of fitWalls(panels.filter((q) => q.id !== p.id && !q.id.startsWith("part:")))) {
      const others = [1, b].every((k) => w.min[k]! < pt[k]! && w.max[k]! > pt[k]!)
      if (!others) continue
      const d = s > 0 ? w.min[a]! - from : from - w.max[a]!
      if (d >= 0 && d < dist) dist = d
    }
    if (!isFinite(dist) || dist > 3000) return { message: "No hi ha cap tauler davant per recolzar el prestatge.", error: true }
    const own = panelAabb(p)
    const z0 = own.min[b]!
    const z1 = own.max[b]! - (b === 2 ? o.setback : 0)
    if (z1 - z0 < 20) return { message: "Fondària insuficient.", error: true }
    const len = dist + 0.5
    const x0 = s > 0 ? pt[a]! : pt[a]! - len
    const y = Math.round(pt[1]!)
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const min: Vec3 = [0, 0, 0]
    min[a] = x0
    min[b] = z0
    min[1] = y
    const name = uniqueName(comp, "Prestatge")
    const part: FreePart = {
      id: newId("p"),
      name,
      orient: "flat",
      w: r1(a === 0 ? len : z1 - z0),
      h: r1(a === 0 ? z1 - z0 : len),
      thickness: o.T,
      material: host?.carcass.material ?? p.material,
      x: r1(min[0] - off[0]),
      y: r1(min[1] - off[1]),
      z: r1(min[2] - off[2]),
      ...(host ? { module: host.id } : {}),
    }
    return { comp: { ...comp, parts: [...(comp.parts ?? []), part] }, select: { kind: "part", id: part.id }, message: `${name}: ${r1(part.w)} × ${r1(part.h)} mm` }
  }

  const l = local(p, pt, n)
  if (tool === "band") {
    if (!host) return { message: "El cantell, de moment, a les peces dels mobles.", error: true }
    const ds: [keyof Panel["edges"], number][] = [
      ["left", Math.abs(l.u)],
      ["right", Math.abs(p.length - l.u)],
      ["bottom", Math.abs(l.v)],
      ["top", Math.abs(p.width - l.v)],
    ]
    const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
    const id = pieceLocalId(host.id, p.id)
    const cur = host.pieceEdits?.[id] ?? {}
    const on = !p.edges[edge]
    return {
      comp: { ...comp, modules: comp.modules.map((x) => (x.id !== host.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, edges: { ...cur.edges, [edge]: on } } } })) },
      message: `${p.label}: cantell ${on ? "posat" : "tret"}`,
    }
  }

  if (l.face === "edge") return { message: "Clica la cara de la peça, no el cantell.", error: true }
  const face = l.face
  const holes: Hole[] =
    tool === "hole"
      ? [{ x: r1(l.u), y: r1(l.v), diameter: o.d, depth: Math.min(o.depth, p.thickness - 1), face }]
      : tool === "cup"
        ? [{ x: r1(l.u), y: r1(l.v), diameter: o.cd, depth: Math.min(o.cdepth, p.thickness - 1), face }]
        : Array.from({ length: Math.max(0, Math.floor((p.length - 2 * o.margin) / o.pitch) + 1) }, (_, k) => ({ x: r1(o.margin + k * o.pitch), y: r1(l.v), diameter: o.ld, depth: Math.min(o.ldepth, p.thickness - 1), face }))
  if (!holes.length) return { message: "La peça és massa curta per a la filera.", error: true }
  const next = addHoles(comp, p, holes)
  if (!next) return { message: "De moment, els mecanitzats a mà van a les peces dels mobles.", error: true }
  const what = tool === "hole" ? `Perforació Ø${o.d}×${o.depth}` : tool === "cup" ? `Cassoleta Ø${o.cd}×${o.cdepth}` : `Línia de ${holes.length} forats Ø${o.ld}`
  return { comp: next, message: `${p.label}: ${what}` }
}

/** La peça amb la mida `size` en l'eix `a`, movent la cara `s` (l'altra es queda). Deixa de ser lligada (bloc o tauler dinàmic). */
export function resizePartFace(p: FreePart, a: number, s: 0 | 1, size: number): FreePart {
  const ax = PART_AXES[p.orient]
  const key = (["x", "y", "z"] as const)[a]!
  const old = partSize(p)[a]!
  const dim = a === ax.n ? { thickness: size } : a === ax.u ? { w: size } : { h: size }
  return { ...p, ...dim, fit: undefined, dyn: undefined, ...(s === 0 ? { [key]: r1(p[key] + old - size) } : {}) }
}

/** Desa el croquis que s'estava dibuixant amb aquests punts (en queda triat) o diu per què no. */
export function finishSketch(comp: Composition, o: FaceToolOpts, pts: [number, number][], rect: boolean): FaceToolResult {
  const d = o.draft
  if (!d) return { message: "Clica una cara per començar el croquis.", error: true }
  const us = pts.map((q) => q[0])
  const vs = pts.map((q) => q[1])
  if (pts.length < 3 || Math.max(...us) - Math.min(...us) < 1 || Math.max(...vs) - Math.min(...vs) < 1) return { message: "Mida massa petita.", error: true }
  const fmt = (v: number) => String(r1(v)).replace(".", ",")
  const name = rect ? `Rectangle ${fmt(Math.max(...us) - Math.min(...us))}×${fmt(Math.max(...vs) - Math.min(...vs))}` : pts.length === 48 ? `Cercle Ø${fmt(Math.max(...us) - Math.min(...us))}` : `Contorn ${pts.length} punts`
  const sk: Sketch = { id: newId("s"), name, a: d.a, level: d.level, dir: d.dir, pts, ...(rect ? { rect: true } : {}) }
  return { comp: { ...comp, sketches: [...(comp.sketches ?? []), sk] }, opts: { ...o, draft: undefined, selSketch: sk.id }, message: `${name}: fet. L'Extrusió en fa una peça.` }
}
