import type { FaceHit } from "../../components/viewer/facePick"
import type { CompositionBuild } from "../../core/build/buildComposition"
import { autoLimits, dynBox, FIT_NOUN, fitWalls, ORIENT_OF_AXIS, partWithBox, wallBoxes, moduleOrigins3, newId, panelAabb, refitParts, type Composition, type FreePart, type Hole, type Module, type Panel, type PartOrient, type Vec3, PART_AXES, partSize, circlePts, fromPlane, partBox, rectPts, toPlane, type Sketch } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { pieceLocalId } from "./ModelingTree"

/** Les eines del Taulell que es fan clicant una cara de la peça. */
export type FaceToolId = "groove" | "rebate" | "cut" | "measure" | "laser" | "dowel" | "screw" | "cabineo" | "rect" | "poly" | "circle" | "face" | "dynpanel" | "fitblock" | "shelf" | "band" | "hole" | "cup" | "line32"

/** Les opcions de les eines (les mateixes del Taulell, amb els seus valors per defecte). */
export interface FaceToolOpts {
  fitOrient: PartOrient
  fitGap: number
  /** Tauler dinàmic: desplaçament des de la cara on es recolza. */
  dynOff: number
  /** Cara dinàmica: la cara triada (la peça lliure, l'eix i el costat: 0 el de baix, 1 el de dalt). */
  facePick?: { part?: string; module?: string; a: number; s: 0 | 1 }
  /** Cara dinàmica (com el Taulell): estirar la peça (o el moble), desplaçar-la, o enganxar-la a una altra cara. */
  faceMode: "pull" | "move" | "mate"
  /** Enganxar: «contact» les cares es toquen, «flush» queden al mateix pla; la separació entre totes dues. */
  mateMode: "contact" | "flush"
  faceGap: number
  /** Enganxar: la cara de la peça que es mou (el primer clic). */
  mateFrom?: { part: string; a: number; s: 0 | 1 }
  /** Esbós: el croquis que s'està dibuixant (el pla i els punts clicats). */
  draft?: { a: number; level: number; dir: 1 | -1; pts: [number, number][] }
  /** Esbós: el croquis triat (el de l'Extrusió). */
  selSketch?: string
  /** Esbós: les mides escrites del rectangle i el diàmetre del cercle. */
  sketchL: number
  sketchW: number
  sketchD: number
  /** Unions (els valors del Taulell): clavilles, cargols i Cabineo. */
  /** Clavilles: la mida (8×40, 8×30, 5×30) i si es reparteixen a tota la junta (si no, una on es clica). */
  dowM: DowelSize
  dowDist: boolean
  dowD: number
  dowF: number
  dowE: number
  dowMargin: number
  dowPitch: number
  /** Cargols: diàmetre i llargada (el nom del cargol i l'avís si no passa del gruix), forat passant i repartiment. */
  scrD: number
  scrL: number
  scrDist: boolean
  scrHole: number
  scrMargin: number
  scrPitch: number
  cabiM: "12" | "8"
  cabiMargin: number
  cabiPitch: number
  /** Cabineo, les mides del mecanitzat (Taulell): butxaca Ø i fondària, 1r forat i pas des del cantell, eix i Ø del cargol. */
  cabiD: number
  cabiDepth: number
  cabiFirst: number
  cabiStep: number
  cabiAxis: number
  cabiSd: number
  /** Ranura i galze (els valors del Taulell). `grOff`: distància fixa al cantell més proper (0: on es clica). */
  grW: number
  grD: number
  grDir: "L" | "A"
  grOff: number
  rbW: number
  rbD: number
  /** Làser: «face» cara a cara (el raig fins a la peça del davant) o «axis» eix a eix (centres de forats o mig del gruix). */
  laserMode: "face" | "axis"
  /** Mesurar i Làser: el primer punt clicat i l'última mesura (es veu com una línia al 3D). */
  measureFrom?: Vec3
  /** Retall: la peça que s'ha de retallar (la primera clicada). */
  cutTarget?: string
  measureLine?: [Vec3, Vec3]
  T: number
  /** Tauler dinàmic: el gruix és el que s'ha escrit (si no, el del moble on va). */
  ownT?: boolean
  /** Bloc, tauler dinàmic i prestatge: el material triat (buit: el del moble on va, o el de la peça clicada). */
  mat: string
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
export const DEFAULT_FACE_OPTS: FaceToolOpts = { fitOrient: "flat", fitGap: 0, dynOff: 0, sketchL: 600, sketchW: 400, sketchD: 300, dowM: "8x40", dowDist: true, dowD: 8, dowF: 12, dowE: 29, dowMargin: 50, dowPitch: 200, scrD: 4, scrL: 60, scrDist: true, scrHole: 4, scrMargin: 50, scrPitch: 300, cabiM: "12", cabiMargin: 50, cabiPitch: 300, cabiD: 15, cabiDepth: 11, cabiFirst: 3.6, cabiStep: 11.2, cabiAxis: 5, cabiSd: 5, grW: 4, grD: 8, grDir: "L", grOff: 0, rbW: 10, rbD: 10, T: 19, laserMode: "face", faceMode: "pull", mateMode: "contact", faceGap: 0, mat: "", setback: 1, d: 8, depth: 12, cd: 35, cdepth: 13, ld: 5, ldepth: 12, pitch: 32, margin: 37 }

/** Les clavilles del Taulell: diàmetre, llargada i fondàries a la cara i al cantell. */
export const DOWELS = { "8x40": { d: 8, L: 40, f: 12, e: 29 }, "8x30": { d: 8, L: 30, f: 12, e: 19 }, "5x30": { d: 5, L: 30, f: 10, e: 21 } } as const
export type DowelSize = keyof typeof DOWELS

/** El nom de cada eina (el títol de la seva finestra d'opcions). */
export const FACE_TOOL_LABEL: Record<FaceToolId, string> = { groove: "Ranura", rebate: "Galze", cut: "Retall", measure: "Mesurar", laser: "Làser", dowel: "Clavilles", screw: "Cargols", cabineo: "Cabineo", rect: "Rectangle", poly: "Polilínia", circle: "Cercle", face: "Cara dinàmica", dynpanel: "Tauler dinàmic", fitblock: "Bloc condicionat", shelf: "Prestatge", band: "Cantell", hole: "Perforació", cup: "Cassoleta", line32: "Línia 32" }

/** El que diu cada eina mentre és activa (els textos del Taulell). */
export const FACE_TOOL_INFO: Record<FaceToolId, string> = {
  groove: "Ranura: clica una cara principal on va la ranura (de punta a punta de la peça).",
  rebate: "Galze: clica una cara principal a prop del cantell.",
  cut: "Retall: clica la peça que s'ha de retallar i després la peça solta que la retalla (fa de tall només en aquella).",
  measure: "Mesurar: clica el primer punt i després el segon.",
  laser: "Làser: clica una cara i mesura fins a la peça del davant.",
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
  /** El que es faria, per a la vista prèvia en verd (forats de les unions), en mm de la composició. */
  ghost?: { min: Vec3; max: Vec3 }[]
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

  if (tool === "cut") {
    if (!o.cutTarget) return { opts: { ...o, cutTarget: p.id }, message: `Peça a retallar: ${p.label}. Ara clica la peça solta que la retalla.` }
    if (!p.id.startsWith("part:")) return { message: "La peça que retalla ha de ser una peça solta (no una d'un moble).", error: true }
    if (p.id === o.cutTarget) return { message: "Clica una altra peça: la que fa el retall.", error: true }
    const id = p.id.slice(5)
    const q = comp.parts?.find((x) => x.id === id)
    if (!q) return { message: "No trobo la peça.", error: true }
    const target = panels.find((x) => x.id === o.cutTarget)
    const only = [...new Set([...(q.effect === "cut" ? (q.cutOnly ?? []) : []), o.cutTarget])]
    return { comp: { ...comp, parts: (comp.parts ?? []).map((x) => (x.id === id ? { ...x, effect: "cut" as const, cutOnly: only } : x)) }, opts: { ...o, cutTarget: undefined }, select: { kind: "part", id }, message: `${q.name} retalla ${target?.label ?? "la peça"}` }
  }
  if (tool === "groove" || tool === "rebate") {
    const l = local(p, pt, n)
    if (l.face === "edge") return { message: "Tria una cara principal, no un cantell.", error: true }
    const m = moduleOf(comp, p)
    if (!m) return { message: "De moment, els mecanitzats a mà van a les peces dels mobles.", error: true }
    let g: { x: number; y: number; w: number; h: number }
    if (tool === "groove") {
      const alongU = (o.grDir === "L") === p.length >= p.width
      const w = o.grW
      const c0 = alongU ? l.v : l.u
      const hi = alongU ? p.width : p.length
      const c = o.grOff > 0 ? (c0 <= hi - c0 ? o.grOff + w / 2 : hi - o.grOff - w / 2) : c0
      g = alongU ? { x: 0, y: r1(c - w / 2), w: p.length, h: w } : { x: r1(c - w / 2), y: 0, w, h: p.width }
    } else {
      const ds = [l.u, p.length - l.u, l.v, p.width - l.v]
      const i = ds.indexOf(Math.min(...ds))
      const w = o.rbW
      g = [
        { x: 0, y: 0, w, h: p.width },
        { x: p.length - w, y: 0, w, h: p.width },
        { x: 0, y: 0, w: p.length, h: w },
        { x: 0, y: p.width - w, w: p.length, h: w },
      ][i]!
    }
    const depth = Math.min(tool === "groove" ? o.grD : o.rbD, p.thickness - 1)
    const id = pieceLocalId(m.id, p.id)
    const cur = m.pieceEdits?.[id] ?? {}
    const next = { ...comp, modules: comp.modules.map((x) => (x.id !== m.id ? x : { ...x, pieceEdits: { ...x.pieceEdits, [id]: { ...cur, grooves: [...(cur.grooves ?? []), { ...g, depth, face: l.face as "A" | "B" }] } } })) }
    return { comp: next, message: `${p.label}: ${tool === "groove" ? `ranura ${o.grW}×${depth}` : `galze ${o.rbW}×${depth}`}` }
  }
  if (tool === "measure") {
    if (!o.measureFrom) return { opts: { ...o, measureFrom: pt, measureLine: undefined }, message: "" }
    const d = sub(pt, o.measureFrom)
    const fmt = (v: number) => String(r1(Math.abs(v))).replace(".", ",")
    return { opts: { ...o, measureFrom: undefined, measureLine: [o.measureFrom, pt] }, message: `Distància: ${fmt(Math.hypot(...d))} mm (X ${fmt(d[0])} · Y ${fmt(d[1])} · Z ${fmt(d[2])})` }
  }
  if (tool === "laser" && o.laserMode === "axis") {
    const q = axisPoint(p, pt, n)
    if (!o.measureFrom) return { opts: { ...o, measureFrom: q.at, measureLine: undefined }, message: `Primer eix: ${q.what}. Clica el segon.` }
    const d = sub(q.at, o.measureFrom)
    const fmt = (v: number) => String(r1(Math.abs(v))).replace(".", ",")
    return { opts: { ...o, measureFrom: undefined, measureLine: [o.measureFrom, q.at] }, message: `Eix a eix: ${fmt(Math.hypot(...d))} mm (X ${fmt(d[0])} · Y ${fmt(d[1])} · Z ${fmt(d[2])})` }
  }
  if (tool === "laser") {
    let best = Infinity
    for (const q of panels) {
      if (q.id === p.id || q.role === "hardware") continue
      const t = rayBox(pt, n, panelAabb(q))
      if (t !== null && t > 0.1 && t < best) best = t
    }
    if (!isFinite(best)) return { message: "Davant d'aquesta cara no hi ha cap peça.", error: true }
    return { opts: { ...o, measureLine: [pt, add3(pt, n, best)] }, message: `Làser: ${String(r1(best)).replace(".", ",")} mm fins a la peça del davant` }
  }
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
    const a = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const side: 0 | 1 = n[a]! > 0 ? 1 : 0
    if (Math.abs(n[a]!) < 0.99) return { message: "Clica una cara d'escaire (no una de biaixada).", error: true }
    if (o.faceMode === "mate") {
      const f = o.mateFrom
      if (!f) {
        if (!p.id.startsWith("part:")) return { message: "Clica la cara d'una peça solta (la que es mou).", error: true }
        const id = p.id.slice(5)
        return { opts: { ...o, mateFrom: { part: id, a, s: side } }, select: { kind: "part", id }, message: `${p.label}: ara clica la cara on s'ha d'enganxar.` }
      }
      const q = comp.parts?.find((x) => x.id === f.part)
      if (!q) return { opts: { ...o, mateFrom: undefined }, message: "No trobo la peça.", error: true }
      if (p.id === `part:${q.id}`) return { message: "Clica una cara d'una altra peça.", error: true }
      if (a !== f.a) return { message: "Les dues cares han de ser paral·leles (gira la peça abans amb Girar).", error: true }
      const contact = o.mateMode === "contact"
      if (contact ? f.s === side : f.s !== side) return { message: contact ? "Per tocar-se, les cares s'han de mirar (gira la peça abans)." : "Per alinear-les, les cares han de mirar cap al mateix costat.", error: true }
      const off: Vec3 = (q.module && moduleOrigins3(comp).get(q.module)) || [0, 0, 0]
      const b = partBox(q)
      const own = (f.s ? b.max[a]! : b.min[a]!) + off[a]!
      const tb = panelAabb(p)
      const level = (side ? tb.max[a]! : tb.min[a]!) + (side ? 1 : -1) * o.faceGap
      const moved = movePart(q, a, level - own)
      return { comp: { ...comp, parts: (comp.parts ?? []).map((x) => (x.id === q.id ? moved : x)) }, opts: { ...o, mateFrom: undefined }, select: { kind: "part", id: q.id }, message: `${q.name} enganxada a ${p.label}` }
    }
    if (p.id.startsWith("part:")) {
      const id = p.id.slice(5)
      return { opts: { ...o, facePick: { part: id, a, s: side } }, select: { kind: "part", id }, message: "" }
    }
    // Una cara d'un moble: si és de fora, en canvia la mida (estirar) o el mou (desplaçar), com al Taulell.
    if (!host) return { message: "Clica una cara d'una peça.", error: true }
    const idx = comp.modules.indexOf(host) + 1
    const own = panels.filter((x) => x.module === idx && !x.id.startsWith("part:") && x.role !== "hardware").map(panelAabb)
    const edge = side ? Math.max(...own.map((b) => b.max[a]!)) : Math.min(...own.map((b) => b.min[a]!))
    if (o.faceMode === "pull" && Math.abs(edge - pt[a]!) > 1) return { message: "En un moble, estira una cara de fora (el lateral, el sostre, el darrere…): en canvia la mida.", error: true }
    return { opts: { ...o, facePick: { module: host.id, a, s: side } }, select: { kind: "module", id: host.id }, message: "" }
  }

  if (tool === "dynpanel") {
    const t = [0, 1, 2].reduce((x, k) => (Math.abs(n[k]!) > Math.abs(n[x]!) ? k : x), 0)
    const seed = pt.map((v, i) => v + n[i]! * (2 + o.dynOff)) as Vec3
    const limits = autoLimits(wallBoxes(panels), seed, t, (id) => id === p.id)
    limits.push({ panel: p.id, a: t, s: n[t]! > 0 ? 0 : 1, off: o.dynOff })
    const T = o.ownT ? o.T : (host?.carcass.thickness ?? o.T)
    const dyn = { t, limits }
    const boxes = new Map(panels.map((q) => [q.id, panelAabb(q)] as const))
    const b = dynBox(dyn, (id) => boxes.get(id), T)
    if (!b) return { message: "El tauler queda sense mida: clica una cara que tingui peces al costat.", error: true }
    const off: Vec3 = (host && moduleOrigins3(comp).get(host.id)) || [0, 0, 0]
    const base = uniqueName(comp, "Tauler dinàmic")
    const part = partWithBox({ id: newId("p"), name: base, orient: ORIENT_OF_AXIS[t]!, w: 0, h: 0, thickness: T, material: o.mat || (host?.carcass.material ?? p.material), x: 0, y: 0, z: 0, ...(host ? { module: host.id } : {}), dyn }, b, off)
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
      material: o.mat || (host?.carcass.material ?? p.material),
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
      material: o.mat || (host?.carcass.material ?? p.material),
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

/** La peça lliure desplaçada `d` mm en l'eix `a` (deixa d'estar lligada a cares o a un buit). */
export function movePart(p: FreePart, a: number, d: number): FreePart {
  const key = (["x", "y", "z"] as const)[a]!
  return { ...p, fit: undefined, dyn: undefined, [key]: r1(p[key] + d) }
}

/** La mida del moble en l'eix `a` (amplada, alçada, fondària) i el nom, per a la Cara dinàmica. */
export const MODULE_DIM: [keyof Pick<Module["carcass"], "width" | "height" | "depth">, string][] = [
  ["width", "Amplada del moble"],
  ["height", "Alçada del moble"],
  ["depth", "Fondària del moble"],
]

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
  const dist = tool === "dowel" ? o.dowDist : o.scrDist
  const ss = edgeOn && dist ? spread(lo, hi, tool === "dowel" ? o.dowMargin : o.scrMargin, tool === "dowel" ? o.dowPitch : o.scrPitch) : [at]
  if (!ss.length) return { message: "La junta és massa curta.", error: true }
  const pts = ss.map((s) => add3(c, L, s - at))
  if (tool === "screw") {
    const holes = pts.map((w) => {
      const [u, v] = toLocal(P, w)
      return { x: r1(u), y: r1(v), diameter: o.scrHole, depth: T, face: l.face as "A" | "B" }
    })
    const ghost = pts.map((w) => rod(w, nW, 2, -o.scrL + 2, o.scrD))
    const next = addAll(comp, [[P, holes]])
    if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
    const warn = o.scrL <= T ? ` · el cargol (${o.scrL}) no passa del gruix (${r1(T)})` : ""
    return { comp: next, ghost, message: `${holes.length} × Cargol ${o.scrD} × ${o.scrL} a ${P.label} → ${R.label}${warn}` }
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
  const ghost = pts.map((w) => rod(add3(w, nW, -T), nW, f, -o.dowE, o.dowD))
  const next = addAll(comp, [
    [P, ph],
    [R, rh],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
  return { comp: next, ghost, message: `${ph.length} × Clavilla ${o.dowM.replace("x", "×")} · ${P.label} → ${R.label}${f < o.dowF ? ` · fondària a la cara reduïda a ${f}` : ""}` }
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
      const c = o.cabiFirst + k * o.cabiStep
      const [x, y] = alongU ? [u, eC + inward * c] : [eC + inward * c, u]
      return { x: r1(x), y: r1(y), diameter: o.cabiD, depth: o.cabiDepth, face }
    }),
  )
  const out = sub(at(0, -1, 0), at(0, 0, 0))
  const qFace = faceTo(Q, out.map((v) => -v) as Vec3)
  const screws: Hole[] = us.map((u) => {
    const [x, y] = toLocal(Q, at(u, 0, top ? T - o.cabiAxis : o.cabiAxis))
    return { x: r1(x), y: r1(y), diameter: o.cabiSd, depth: o.cabiM === "12" ? 12 : 8, face: qFace }
  })
  const ghost = [
    ...pockets.map((h) => rod(fromLocal(P, h.x, h.y, top ? T : 0), top ? P.placement.zAxis : (P.placement.zAxis.map((v) => -v) as Vec3), 0, -o.cabiDepth, o.cabiD)),
    ...us.map((u) => rod(at(u, 0, top ? T - o.cabiAxis : o.cabiAxis), out, 0, o.cabiM === "12" ? 12 : 8, o.cabiSd)),
  ]
  const next = addAll(comp, [
    [P, pockets],
    [Q, screws],
  ])
  if (!next) return { message: "De moment, les unions van a les peces dels mobles.", error: true, ghost }
  return { comp: next, ghost, message: `${us.length} × Cabineo ${o.cabiM}: ${P.label} amb ${Q.label}` }
}

/** Làser eix a eix: el centre del forat clicat (si n'hi ha un a sota del ratolí) o el mig del gruix de la peça. */
function axisPoint(P: Panel, pt: Vec3, n: Vec3): { at: Vec3; what: string } {
  const l = local(P, pt, n)
  if (l.face !== "edge") {
    const h = P.holes.find((x) => (x.face ?? "A") === l.face && Math.hypot(x.x - l.u, x.y - l.v) <= x.diameter / 2 + 3)
    if (h) return { at: fromLocal(P, h.x, h.y, P.thickness / 2), what: `forat Ø${h.diameter} de ${P.label}` }
    return { at: fromLocal(P, l.u, l.v, P.thickness / 2), what: `mig del gruix de ${P.label}` }
  }
  return { at: pt, what: `cantell de ${P.label}` }
}

/** La caixa d'una barra de diàmetre `d` al llarg de `n` (de `a` a `b` mm des de `c`), per a la vista prèvia. */
function rod(c: Vec3, n: Vec3, a: number, b: number, d: number): { min: Vec3; max: Vec3 } {
  const p = add3(c, n, a)
  const q = add3(c, n, b)
  const min = [0, 1, 2].map((k) => Math.min(p[k]!, q[k]!) - (Math.abs(n[k]!) > 0.5 ? 0 : d / 2)) as Vec3
  const max = [0, 1, 2].map((k) => Math.max(p[k]!, q[k]!) + (Math.abs(n[k]!) > 0.5 ? 0 : d / 2)) as Vec3
  return { min, max }
}

/** On talla el raig (des de `o`, cap a `d`) la caixa, o null. */
function rayBox(o: Vec3, d: Vec3, b: { min: Vec3; max: Vec3 }): number | null {
  let t0 = -Infinity
  let t1 = Infinity
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]!) < 1e-9) {
      if (o[k]! < b.min[k]! || o[k]! > b.max[k]!) return null
      continue
    }
    const a = (b.min[k]! - o[k]!) / d[k]!
    const c = (b.max[k]! - o[k]!) / d[k]!
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
  }
  return t1 >= t0 && t1 > 0 ? Math.max(0, t0) : null
}

/** La vista prèvia d'una eina amb el ratolí a sobre d'una cara (en verd, com al Taulell): la peça que sortiria o el croquis a mig fer. */
export function previewFaceTool(tool: FaceToolId, o: FaceToolOpts, comp: Composition, build: CompositionBuild | undefined, hit: FaceHit): { box?: { min: Vec3; max: Vec3 }; boxes?: { min: Vec3; max: Vec3 }[]; pts?: Vec3[]; closed?: boolean } | null {
  if (tool === "dowel" || tool === "screw" || tool === "cabineo") {
    const r = runFaceTool(tool, o, comp, build, hit)
    return r.ghost?.length ? { boxes: r.ghost } : null
  }
  if (tool === "laser" || tool === "measure") {
    const r = runFaceTool(tool, { ...o, measureFrom: tool === "measure" ? o.measureFrom : o.laserMode === "axis" ? o.measureFrom : undefined }, comp, build, hit)
    const line = r.opts?.measureLine
    return line && (tool === "laser" ? o.laserMode === "face" || !!o.measureFrom : !!o.measureFrom) ? { pts: line, closed: false } : null
  }
  if (tool === "dynpanel" || tool === "fitblock" || tool === "shelf") {
    const r = runFaceTool(tool, o, comp, build, hit)
    const q = !r.error && r.comp?.parts?.[r.comp.parts.length - 1]
    if (!q) return null
    const off: Vec3 = (q.module && moduleOrigins3(comp).get(q.module)) || [0, 0, 0]
    const b = partBox(q)
    return { box: { min: b.min.map((v, k) => v + off[k]!) as Vec3, max: b.max.map((v, k) => v + off[k]!) as Vec3 } }
  }
  const d = o.draft
  if ((tool === "rect" || tool === "circle" || tool === "poly") && d) {
    const q = toPlane(d.a, hit.point)
    const lift = (x: [number, number]) => fromPlane(d.a, d.level + d.dir * 0.5, x)
    if (tool === "rect") return { pts: rectPts(d.pts[0]!, q).map(lift), closed: true }
    if (tool === "circle") return { pts: circlePts(d.pts[0]!, 2 * Math.hypot(q[0] - d.pts[0]![0], q[1] - d.pts[0]![1])).map(lift), closed: true }
    return { pts: [...d.pts, q].map(lift), closed: false }
  }
  return null
}
