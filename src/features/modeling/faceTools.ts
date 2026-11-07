import type { FaceHit } from "../../components/viewer/facePick"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { autoLimits, dynBox, FIT_NOUN, fitWalls, ORIENT_OF_AXIS, partWithBox, wallBoxes, moduleOrigins3, newId, panelAabb, refitParts, type Composition, type FreePart, type Hole, type Panel, type PartOrient, type Vec3, PART_AXES, partSize, circlePts, rectPts, toPlane, type Sketch } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { pieceLocalId } from "./ModelingTree"

/** Les eines del Taulell que es fan clicant una cara de la peça. */
export type FaceToolId = "dowel" | "screw" | "cabineo" | "rect" | "poly" | "circle" | "face" | "dynpanel" | "fitblock" | "shelf" | "band" | "hole" | "cup" | "line32"

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
  /** Unions (els valors del Taulell): clavilles, cargols i Cabineo. */
  dowD: number
  dowF: number
  dowE: number
  dowMargin: number
  dowPitch: number
  scrHole: number
  scrMargin: number
  scrPitch: number
  cabiM: "12" | "8"
  cabiMargin: number
  cabiPitch: number
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
export const DEFAULT_FACE_OPTS: FaceToolOpts = { fitOrient: "flat", fitGap: 0, dynOff: 0, sketchL: 600, sketchW: 400, sketchD: 300, dowD: 8, dowF: 12, dowE: 29, dowMargin: 50, dowPitch: 200, scrHole: 4, scrMargin: 50, scrPitch: 300, cabiM: "12", cabiMargin: 50, cabiPitch: 300, T: 19, setback: 1, d: 8, depth: 12, cd: 35, cdepth: 13, ld: 5, ldepth: 12, pitch: 32, margin: 37 }

/** El nom de cada eina (el títol de la seva finestra d'opcions). */
export const FACE_TOOL_LABEL: Record<FaceToolId, string> = { dowel: "Clavilles", screw: "Cargols", cabineo: "Cabineo", rect: "Rectangle", poly: "Polilínia", circle: "Cercle", face: "Cara dinàmica", dynpanel: "Tauler dinàmic", fitblock: "Bloc condicionat", shelf: "Prestatge", band: "Cantell", hole: "Perforació", cup: "Cassoleta", line32: "Línia 32" }

/** El que diu cada eina mentre és activa (els textos del Taulell). */
export const FACE_TOOL_INFO: Record<FaceToolId, string> = {
  dowel: "Clavilles: clica la cara de fora del tauler on darrere hi ha el cantell de l'altra peça.",
  screw: "Cargols: clica la cara per on entra el cargol (p. ex. la cara de fora del lateral). Es centra al cantell de la peça de darrere.",
  cabineo: "Cabineo: clica la cara del tauler que porta el connector, a prop del cantell que toca l'altra peça.",
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

  if (tool === "dowel" || tool === "screw") return jointTool(tool, o, comp, panels, hit)
  if (tool === "cabineo") return cabineoTool(o, comp, panels, hit)

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

const add3 = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
/** Un punt (mm de la composició) en coordenades de la peça: llarg, ample i gruix. */
function toLocal(p: Panel, w: Vec3): [number, number, number] {
  const d = sub(w, p.placement.origin)
  return [dot(d, p.placement.xAxis), dot(d, p.placement.yAxis), dot(d, p.placement.zAxis)]
}
function fromLocal(p: Panel, u: number, v: number, t: number): Vec3 {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  return [0, 1, 2].map((k) => o[k]! + x[k]! * u + y[k]! * v + z[k]! * t) as Vec3
}
/** La peça (que no és `skip`) on cau el punt, si n'hi ha. */
function panelAt(panels: Panel[], w: Vec3, skip: string): Panel | undefined {
  return panels.find((q) => {
    if (q.id === skip || q.role === "hardware") return false
    const b = panelAabb(q)
    return [0, 1, 2].every((k) => b.min[k]! - 0.6 <= w[k]! && b.max[k]! + 0.6 >= w[k]!)
  })
}
/** Repartits a la junta [lo, hi]: amb marge als extrems i un pas màxim; com a mínim dos (un si no hi caben). */
function spread(lo: number, hi: number, margin: number, pitch: number): number[] {
  const span = hi - lo - 2 * margin
  if (span < 1) return hi - lo >= 1 ? [(lo + hi) / 2] : []
  const n = Math.max(2, Math.ceil(span / Math.max(20, pitch) - 1e-6) + 1)
  return Array.from({ length: n }, (_, k) => r1(lo + margin + (span * k) / (n - 1)))
}
/** La cara (A o B) d'una peça que mira cap a `n`. */
const faceTo = (p: Panel, n: Vec3): "A" | "B" => (dot(n, p.placement.zAxis) > 0 ? "A" : "B")
/** Un forat al cantell d'una peça al punt local (u, v): el cantell més proper. */
function edgeHole(p: Panel, u: number, v: number, d: number, depth: number): Hole {
  const ds: [Panel["edges"] extends Record<infer K, unknown> ? K : never, number][] = [
    ["left", Math.abs(u)],
    ["right", Math.abs(p.length - u)],
    ["bottom", Math.abs(v)],
    ["top", Math.abs(p.width - v)],
  ]
  const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
  const x = edge === "left" ? 0 : edge === "right" ? p.length : r1(u)
  const y = edge === "bottom" ? 0 : edge === "top" ? p.width : r1(v)
  return { x, y, diameter: d, depth, face: "edge", edge }
}
/** Afegeix els forats a cada peça (només les dels mobles); null si alguna és una peça lliure. */
function addAll(comp: Composition, list: [Panel, Hole[]][]): Composition | null {
  let c: Composition | null = comp
  for (const [p, hs] of list) if (c && hs.length) c = addHoles(c, p, hs)
  return c
}

/** Clavilles i cargols (port de `scrPlan` / `dowPlan` del Taulell): repartits a la junta, centrats al cantell de la peça de darrere. */
function jointTool(tool: "dowel" | "screw", o: FaceToolOpts, comp: Composition, panels: Panel[], hit: FaceHit): FaceToolResult {
  const { panel: P, point: pt, normal: n } = hit
  const l = local(P, pt, n)
  if (l.face === "edge") return { message: "Clica la cara del tauler, no el cantell.", error: true }
  const nW: Vec3 = l.face === "A" ? P.placement.zAxis : (P.placement.zAxis.map((v) => -v) as Vec3)
  const T = P.thickness
  const R = panelAt(panels, add3(pt, nW, -(T + 1)), P.id)
  if (!R) return { message: tool === "dowel" ? "Clica la cara de fora d'un tauler que toqui el cantell d'una altra peça." : "Darrere d'aquesta cara no hi ha cap peça.", error: true }
  const tR = R.placement.zAxis
  const edgeOn = Math.abs(dot(tR, nW)) < 0.5
  if (tool === "dowel" && !edgeOn) return { message: "Clica la cara de fora d'un tauler que toqui el cantell d'una altra peça.", error: true }
  // El punt, al mig del gruix de la peça de darrere; la junta va en la tercera direcció.
  const rc = fromLocal(R, R.length / 2, R.width / 2, R.thickness / 2)
  const c = edgeOn ? add3(pt, tR, dot(sub(rc, pt), tR)) : pt
  const L: Vec3 = edgeOn ? [nW[1]! * tR[2]! - nW[2]! * tR[1]!, nW[2]! * tR[0]! - nW[0]! * tR[2]!, nW[0]! * tR[1]! - nW[1]! * tR[0]!] : P.placement.xAxis
  const pb = panelAabb(P)
  const rb = panelAabb(R)
  const proj = (b: { min: Vec3; max: Vec3 }) => {
    const vs = [0, 1, 2].map((k) => (L[k]! >= 0 ? [b.min[k]!, b.max[k]!] : [b.max[k]!, b.min[k]!]))
    return [vs.reduce((s, v, k) => s + v[0]! * L[k]!, 0), vs.reduce((s, v, k) => s + v[1]! * L[k]!, 0)]
  }
  const [p0, p1] = proj(pb)
  const [q0, q1] = proj(rb)
  const lo = Math.max(p0!, q0!)
  const hi = Math.min(p1!, q1!)
  const at = dot(c, L)
  const ss = edgeOn ? spread(lo, hi, tool === "dowel" ? o.dowMargin : o.scrMargin, tool === "dowel" ? o.dowPitch : o.scrPitch) : [at]
  if (!ss.length) return { message: "La junta és massa curta.", error: true }
  const pts = ss.map((s) => add3(c, L, s - at))
  if (tool === "screw") {
    const holes = pts.map((w) => {
      const [u, v] = toLocal(P, w)
      return { x: r1(u), y: r1(v), diameter: o.scrHole, depth: T, face: l.face as "A" | "B" }
    })
    const next = addAll(comp, [[P, holes]])
    if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true }
    return { comp: next, message: `${holes.length} × cargol a ${P.label} → ${R.label}` }
  }
  const f = Math.min(o.dowF, r1(T - 4))
  const inner = faceTo(P, nW.map((v) => -v) as Vec3)
  const ph = pts.map((w) => {
    const [u, v] = toLocal(P, w)
    return { x: r1(u), y: r1(v), diameter: o.dowD, depth: f, face: inner }
  })
  const rh = pts.map((w) => {
    const [u, v] = toLocal(R, add3(w, nW, -T))
    return edgeHole(R, u, v, o.dowD, o.dowE)
  })
  const next = addAll(comp, [
    [P, ph],
    [R, rh],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true }
  return { comp: next, message: `${ph.length} × clavilla Ø${o.dowD} · ${P.label} → ${R.label}${f < o.dowF ? ` · fondària a la cara reduïda a ${f}` : ""}` }
}

/** Cabineo (port de `cabiPlan` del Taulell): tres buidats Ø15 encavalcats a la cara, a tocar del cantell, i el cargol a l'altra peça. */
function cabineoTool(o: FaceToolOpts, comp: Composition, panels: Panel[], hit: FaceHit): FaceToolResult {
  const { panel: P, point: pt, normal: n } = hit
  const l = local(P, pt, n)
  if (l.face === "edge") return { message: "Clica la cara del tauler que porta el connector (no el cantell).", error: true }
  const T = P.thickness
  const ds: [string, number][] = [
    ["left", l.u],
    ["right", P.length - l.u],
    ["bottom", l.v],
    ["top", P.width - l.v],
  ]
  const [edge] = ds.reduce((x, y) => (y[1] < x[1] ? y : x))
  const alongU = edge === "bottom" || edge === "top"
  const eC = edge === "left" ? 0 : edge === "right" ? P.length : edge === "bottom" ? 0 : P.width
  const inward = edge === "left" || edge === "bottom" ? 1 : -1
  const at = (along: number, from: number, t: number) => (alongU ? fromLocal(P, along, eC + inward * from, t) : fromLocal(P, eC + inward * from, along, t))
  const probe = add3(at(alongU ? l.u : l.v, 0, T / 2), sub(at(alongU ? l.u : l.v, -1, T / 2), at(alongU ? l.u : l.v, 0, T / 2)))
  const Q = panelAt(panels, probe, P.id)
  if (!Q) return { message: "Aquest cantell no toca cap altra peça. Clica a prop del cantell que s'uneix (per exemple, la base a tocar del lateral).", error: true }
  // La junta: on es toquen les dues peces al llarg del cantell.
  const qs = [0, Q.length].flatMap((a) => [0, Q.width].flatMap((b) => [0, Q.thickness].map((c) => toLocal(P, fromLocal(Q, a, b, c))[alongU ? 0 : 1])))
  const len = alongU ? P.length : P.width
  const lo = Math.max(0, Math.min(...qs))
  const hi = Math.min(len, Math.max(...qs))
  const m = o.cabiMargin
  if (hi - lo < 2 * m - 1) return { message: `La junta fa ${r1(hi - lo)} mm: massa curta per al Cabineo amb ${m} mm de marge.`, error: true }
  const us = spread(lo, hi, m, o.cabiPitch)
  const face = l.face
  const top = face === "A"
  const pockets: Hole[] = us.flatMap((u) =>
    [0, 1, 2].map((k) => {
      const c = 3.6 + k * 11.2
      const [x, y] = alongU ? [u, eC + inward * c] : [eC + inward * c, u]
      return { x: r1(x), y: r1(y), diameter: 15, depth: 11, face }
    }),
  )
  const out = sub(at(0, -1, 0), at(0, 0, 0))
  const qFace = faceTo(Q, out.map((v) => -v) as Vec3)
  const screws: Hole[] = us.map((u) => {
    const [x, y] = toLocal(Q, at(u, 0, top ? T - 5 : 5))
    return { x: r1(x), y: r1(y), diameter: 5, depth: o.cabiM === "12" ? 12 : 8, face: qFace }
  })
  const next = addAll(comp, [
    [P, pockets],
    [Q, screws],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true }
  return { comp: next, message: `${us.length} × Cabineo ${o.cabiM}: ${P.label} amb ${Q.label}` }
}
