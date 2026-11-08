import { addBottomPlinth } from "../model/plinthZones"
import { defaultModule, newId, type Composition, type FreePart, type Module, type PartOrient, type Zone } from "../model"
import { PART_AXES } from "../model/freePart"
import { HAFELE_LEGS } from "../model/hafele/hafeleLegs"

/**
 * Un moble del Taulell 3D (el document que desa al navegador, `taulell3d-doc-v2`) → un moble del cnc. Prova de cel
 * (2026-11-07): els mobles paramètrics del Taulell (`cabs`) passen a mòduls del cnc amb una fórmula (amplada, alçada,
 * fondària, gruix, fons, sòcol, columnes, prestatges, calaixos i portes), i les peces soltes que són taulers rectes i
 * alineats, a peces lliures. El que no es pot passar encara (formes, mecanitzats, ferratges) es compta a `skipped`.
 */

/** Un moble paramètric del Taulell (`CABDEF`): els camps que es passen (o que es diuen quan encara no es poden passar). */
export interface TaulellCab {
  id: number | string
  name?: string
  W: number
  H: number
  D: number
  t: number
  tb?: number
  pl?: number
  plinth?: boolean
  feet?: string
  back?: string
  /** Fons per dins: retirada del darrere. En ranura: on comença la ranura. */
  bset?: number
  /** Fondària de la ranura o del galze. */
  bdep?: number
  /** Material del fons: «auto» (el del cos si fa 8 mm o més; si no, HDF), «hdf» o «cos». */
  bmat?: string
  cols?: number
  shelves?: number
  /** Forats de prestatges (System 32): sense, prestatges sense forats. */
  s32?: boolean
  drawers?: number
  drawerH?: number
  /** Alçades dels frontals a mida («50%», «140», «*»). */
  dhs?: string
  /** Sistema de calaix: «fusta» (caixa de fusta) o «dtc». */
  dsys?: string
  doors?: boolean
  cm?: string
  dm?: string
  /** Tapa: «full» (sencera), «rails» (travessers davant i darrere), «front» (només el de davant), «none». */
  topT?: string
  railW?: number
  /** Travessers drets (de cantell): «none», «front», «both». */
  railV?: string
  /** Trencajunt: base, tapa i divisions, aquests mm enrere del davant dels laterals. */
  tj?: number
  /** Reculat dels prestatges (mm enrere del davant). */
  ss?: number
  /** Tipus de material del fons i sòcol unit amb el del costat (el cnc ja uneix els sòcols que es toquen). */
  plinthJoin?: boolean
  /** Girat (graus). */
  rot?: number
  sink?: string
  /** Peces del moble esborrades a mà. */
  del?: string[]
  pos?: [number, number, number]
}

interface TaulellPart {
  id: number | string
  name?: string
  prof?: { type: string; L?: number; W?: number; pts?: [number, number][] }
  T: number
  pos: [number, number, number]
  quat: [number, number, number, number]
  mat?: string
  cab?: number | string
  hidden?: boolean
  feats?: unknown[]
}

/** Un ferratge col·locat a mà (Cabineo, espiga o cargol), a una peça d'un moble (`ref.cab`, `ref.name`). */
interface TaulellHw {
  kind: string
  ref?: { cab?: number | string; name?: string }
  opt?: Record<string, unknown>
}

export interface TaulellDoc {
  name?: string
  cabs?: TaulellCab[]
  parts?: TaulellPart[]
  hw?: TaulellHw[]
  sketches?: unknown[]
}

interface TaulellImport {
  composition: Composition
  name: string
  modules: number
  parts: number
  /** Peces soltes que no s'han pogut passar (formes, peces girades) i mecanitzats que s'han deixat. */
  skipped: { shapes: number; feats: number }
  /** El que el moble del Taulell porta i el cnc encara no fa (una frase per cosa): es diu en obrir-lo. */
  warnings: string[]
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** Gira el vector `v` amb el quaternió `q` ([x, y, z, w]). */
function rotate([qx, qy, qz, qw]: readonly number[], [vx, vy, vz]: readonly number[]): [number, number, number] {
  const tx = 2 * (qy! * vz! - qz! * vy!)
  const ty = 2 * (qz! * vx! - qx! * vz!)
  const tz = 2 * (qx! * vy! - qy! * vx!)
  return [vx! + qw! * tx + (qy! * tz - qz! * ty), vy! + qw! * ty + (qz! * tx - qx! * tz), vz! + qw! * tz + (qx! * ty - qy! * tx)]
}

/** L'eix del món (0 x, 1 y, 2 z) d'un vector alineat, o -1 si va de biaix. */
function axisOf(v: readonly number[]): number {
  const i = v.findIndex((c) => Math.abs(Math.abs(c) - 1) < 1e-3)
  return i >= 0 && v.every((c, k) => k === i || Math.abs(c) < 1e-3) ? i : -1
}

const ORIENT_BY_NORMAL: Record<number, PartOrient> = { 0: "side", 1: "flat", 2: "front" }

/** Una peça solta del Taulell (perfil al pla x–z local, gruix cap a y local) → peça lliure, si és recta i alineada. */
function freePartOf(p: TaulellPart, material: string): FreePart | null {
  if (p.prof?.type !== "rect" || !p.prof.L || !p.prof.W) return null
  const n = axisOf(rotate(p.quat, [0, 1, 0]))
  if (n < 0 || axisOf(rotate(p.quat, [1, 0, 0])) < 0) return null
  // La caixa al món: les vuit cantonades del tauler.
  const corners: [number, number, number][] = []
  for (const x of [0, p.prof.L]) for (const y of [0, p.T]) for (const z of [0, p.prof.W]) corners.push(rotate(p.quat, [x, y, z]))
  const min = [0, 1, 2].map((a) => Math.min(...corners.map((c) => c[a]!)) + p.pos[a]!)
  const max = [0, 1, 2].map((a) => Math.max(...corners.map((c) => c[a]!)) + p.pos[a]!)
  const orient = ORIENT_BY_NORMAL[n]!
  const ax = PART_AXES[orient]
  return {
    id: newId("p"),
    name: p.name || "Tauler",
    orient,
    w: r1(max[ax.u]! - min[ax.u]!),
    h: r1(max[ax.v]! - min[ax.v]!),
    thickness: r1(p.T),
    material,
    x: r1(min[0]!),
    y: r1(min[1]!),
    z: r1(min[2]!),
  }
}

/** El fons del Taulell → el del cnc. El galze no el tenim: va en ranura (es diu). */
const BACK: Record<string, Module["carcass"]["back"]> = { over: "screwed", inside: "inset", rebate: "groove", groove: "groove", none: "none" }

/** La pota AXILO 78 de la biblioteca (la de mobles), amb les retirades del Taulell: el tub a 54,5 dels laterals, a 49,5 del darrere de la base i a 50 + gruix + 40,5 del davant. */
function axiloLeg(c: TaulellCab, baseZ0: number) {
  const item = HAFELE_LEGS.find((h) => h.id === "leg-hafele-axilo78-screw-moble")
  if (!item) return undefined
  const side = 10 + 97 - 52.5
  return { ...item, params: { ...item.params, inset: side, insetLeft: side, insetRight: side, insetBack: r1(baseZ0 + 10 + 39.5), insetFront: r1(50 + c.t + 40.5) } }
}

/** Les alçades dels frontals de calaix (de baix a dalt), com `cabLayout` del Taulell. `fill`: ocupen tot el front. */
function drawerLayout(c: TaulellCab, frontH: number): { hs: number[]; fill: boolean } {
  const dh0 = c.drawerH || 180
  let nd: number
  let dh: number
  let fill: boolean
  if (!c.doors && (c.drawers ?? 0) > 0) {
    nd = Math.max(1, Math.min(c.drawers!, Math.floor(frontH / 60)))
    dh = frontH / nd
    fill = true
  } else {
    nd = Math.max(0, Math.min(c.drawers ?? 0, Math.floor(frontH / dh0)))
    dh = dh0
    fill = nd > 0 && frontH - nd * dh < 120
    if (fill) dh = frontH / nd
  }
  let hs: number[] = Array(nd).fill(dh)
  // Composició a mida: «50%» = part de l'alçada; «140» = frontal de 140 mm (+ 3 de junta); «*» o buit = el que quedi.
  const sp = String(c.dhs ?? "").trim()
  if (nd > 0 && sp) {
    const tk = sp.split(/[,;]/).map((x) => x.trim())
    const own: (number | null)[] = []
    let used = 0
    for (let i = 0; i < nd; i++) {
      const v = tk[i] || "*"
      const pc = v.match(/^([\d.]+)\s*%$/)
      const h = pc ? (frontH * +pc[1]!) / 100 : /^[\d.]+$/.test(v) ? +v + 3 : null
      own.push(h !== null && h >= 60 ? h : null)
      if (h !== null && h >= 60) used += h
    }
    const free = own.filter((h) => h === null).length
    const total = fill ? frontH : Math.max(nd * dh, used + free * dh0)
    const rest = free ? (total - used) / free : 0
    if ((!free || rest >= 60) && used + rest * free <= frontH + 0.5) {
      hs = own.map((h) => h ?? rest)
      fill = Math.abs(hs.reduce((a, b) => a + b, 0) - frontH) <= 0.5
    }
  }
  return { hs, fill }
}

/** El contingut d'una columna: calaixos a baix i porta amb prestatges a dalt, com el Taulell (`cabLayout`). */
function columnZone(c: TaulellCab, k: number, cols: number, colW: number, frontH: number): Zone {
  const shelves = c.shelves ? { shelves: { n: c.shelves, adjustable: c.s32 !== false, ...(c.ss !== undefined ? { setback: Math.max(0, Math.min(300, c.ss)) } : {}) } } : {}
  // Dues portes si la columna (amb la meitat de cada divisió) passa de 620 mm; una sola, frontissa cap a fora.
  const door: Zone["front"] = { kind: "door", mode: colW > 620 ? "double" : "single", hinge: k < cols / 2 ? "left" : "right" }
  const { hs, fill } = drawerLayout(c, frontH)
  const drawers = (heights: number[]): Zone => ({ id: newId(), front: { kind: "drawers", n: heights.length, heights: heights.map((h) => r1(h)) } })
  if (!hs.length) return { id: newId(), ...shelves, ...(c.doors ? { front: door } : {}) }
  if (fill || !c.doors) return { ...drawers(hs), front: { kind: "drawers", n: hs.length, heights: fill ? Array(hs.length).fill("auto") : hs.map((h) => r1(h)) } }
  return {
    id: newId(),
    split: {
      dir: "h",
      // La primera zona d'una divisió horitzontal és la de baix.
      sizes: [r1(hs.reduce((a, b) => a + b, 0)), "auto"],
      children: [{ id: newId(), front: { kind: "drawers", n: hs.length, heights: Array(hs.length).fill("auto") } }, { id: newId(), ...shelves, front: door }],
    },
  }
}

/** La tapa del Taulell → la del cnc (els travessers, la mateixa regla per a tots els mòduls). */
function topOf(c: TaulellCab): Module["carcass"]["top"] {
  const w = c.railW ?? 100
  if (c.topT === "none") return { kind: "none" }
  if (c.topT === "front") return { kind: "rails", width: Math.max(30, Math.min(600, w)), back: false }
  if (c.topT === "rails") return { kind: "rails", width: Math.max(30, Math.min(600, w)), back: true }
  return { kind: "full" }
}

/** Un moble paramètric del Taulell → un mòdul del cnc (la «fórmula»): cada opció del Taulell, a la seva opció del cnc. */
export function moduleOfCab(c: TaulellCab, mat: (key: string | undefined) => string, gapBefore: number, warn: (s: string) => void): Module {
  const name = c.name || "Mòdul"
  const pl = c.pl ?? 0
  const legs = c.feet === "axilo" ? pl : 0
  const height = c.H - legs
  const back = BACK[c.back ?? "over"] ?? "screwed"
  const tb = c.tb ?? 8
  const bset = c.bset ?? 10
  // Material del fons: «auto» = el del cos si fa 8 mm o més, si no HDF.
  const backMaterial = c.bmat === "hdf" || (c.bmat !== "cos" && tb < 8) ? mat("hdf") : mat(c.cm)
  // Fons per dins: la base i el sostre comencen al fons (al Taulell); al cnc arriben al darrere (es diu, no canvia el tall gaire).
  const baseZ0 = c.back === "inside" ? bset : 0
  const leg = legs ? axiloLeg(c, baseZ0) : undefined
  const m = defaultModule(newId("m"), name, {
    width: c.W,
    height,
    depth: c.D,
    thickness: c.t,
    material: mat(c.cm),
    frontMaterial: mat(c.dm),
    back,
    backThickness: tb,
    backMaterial,
    top: topOf(c),
    ...(c.tj ? { breakJoint: Math.max(0, Math.min(20, c.tj)) } : {}),
    ...(c.back === "inside" ? { backInsetSetback: bset } : {}),
    ...(c.back === "groove" ? { backSetback: bset, grooveDepth: Math.max(3, Math.min(15, Math.min(c.bdep ?? 8, c.t - 3))) } : {}),
    ...(c.back === "rebate" ? { backSetback: 0, grooveDepth: Math.max(3, Math.min(15, Math.min(c.bdep ?? 8, c.t - 3))) } : {}),
    // Potes AXILO: la base «Potes» amb la pota de la biblioteca i, si n'hi ha, el sòcol clipat a 50 mm del davant.
    ...(legs ? { base: { kind: "legs" as const, height: legs, ...(leg ? { hardware: leg } : {}), ...(c.plinth !== false && pl >= 40 ? { plinth: { setback: 50 } } : {}) } } : {}),
  })
  const cols = Math.max(1, Math.round(c.cols ?? 1))
  const plinth = !legs && c.plinth !== false && pl >= 40 ? pl : 0
  const frontH = c.H - pl
  const colW = c.W / cols
  const col = (k: number) => columnZone(c, k, cols, colW, frontH)
  const root: Zone = cols > 1 ? { id: `${m.id}-root`, split: { dir: "v", sizes: Array(cols).fill("auto"), children: Array.from({ length: cols }, (_, k) => col(k)) } } : { ...col(0), id: `${m.id}-root` }
  const rot = c.rot === 90 || c.rot === 180 || c.rot === 270 ? { rot: c.rot as 90 | 180 | 270 } : {}
  const out: Module = { ...m, gapBefore, root, ...rot }

  // El que el cnc encara no fa, perquè no es perdi sense saber-ho.
  if (c.back === "rebate") warn(`«${name}»: el fons en galze passa en ranura (el cnc encara no fa galze).`)
  if (c.railV && c.railV !== "none") warn(`«${name}»: els travessers drets (de cantell) passen plans.`)
  if (c.dsys === "dtc") warn(`«${name}»: els calaixos DTC passen amb la guia de calaix del mòdul.`)
  if (c.sink && c.sink !== "none") warn(`«${name}»: el forat de l'aigüera encara no es passa.`)
  if (c.rot && !rot.rot) warn(`«${name}»: el gir de ${c.rot}° no es passa (només 90, 180 i 270).`)
  if (c.del?.length) warn(`«${name}»: ${c.del.length === 1 ? "la peça esborrada" : "les peces esborrades"} a mà (${c.del.join(", ")}) hi tornen a ser.`)
  return plinth ? addBottomPlinth(out, plinth) : out
}

/**
 * Tot el document: els mobles paramètrics en ordre d'esquerra a dreta (l'espai entre ells, `gapBefore`) i les peces
 * soltes. `mat` dona el nom del material del cnc per a una clau de material del Taulell.
 */
export function fromTaulell(doc: TaulellDoc, mat: (key: string | undefined) => string): TaulellImport {
  const cabs = [...(doc.cabs ?? [])].sort((a, b) => (a.pos?.[0] ?? 0) - (b.pos?.[0] ?? 0))
  // El primer moble del Taulell queda a l'origen del cnc (x = 0); les peces soltes es mouen igual.
  const x0 = cabs.length ? (cabs[0]!.pos?.[0] ?? 0) : 0
  const z0 = cabs.length ? (cabs[0]!.pos?.[2] ?? 0) : 0
  const warnings: string[] = []
  const warn = (w: string) => warnings.push(w)
  let end = x0
  const modules = cabs.map((c) => {
    const x = c.pos?.[0] ?? 0
    const m = moduleOfCab(c, mat, Math.max(0, r1(x - end)), warn)
    end = Math.max(end, x) + c.W
    return m
  })
  const loose = (doc.parts ?? []).filter((p) => p.cab === undefined && !p.hidden)
  const parts: FreePart[] = []
  let shapes = 0
  for (const p of loose) {
    const fp = freePartOf(p, mat(p.mat))
    if (fp) parts.push({ ...fp, x: r1(fp.x - x0), z: r1(fp.z - z0) })
    else shapes++
  }
  const feats = loose.reduce((n, p) => n + (p.feats?.length ?? 0), 0)
  if (shapes) warn(`${shapes} ${shapes === 1 ? "peça solta amb forma o girada encara no es passa" : "peces soltes amb forma o girades encara no es passen"}.`)
  if (feats) warn(`${feats} ${feats === 1 ? "mecanitzat de les peces soltes encara no es passa" : "mecanitzats de les peces soltes encara no es passen"}.`)
  // Els mecanitzats fets a mà a les peces dels mobles (es conserven quan el Taulell refà el moble).
  const own = (doc.parts ?? []).filter((p) => p.cab !== undefined).reduce((n, p) => n + (p.feats ?? []).filter((f) => !(f as { gen?: unknown }).gen && !(f as { cg?: unknown }).cg).length, 0)
  if (own) warn(`${own} ${own === 1 ? "mecanitzat fet a mà" : "mecanitzats fets a mà"} a les peces dels mobles encara no es passen.`)
  // Unions i ferratges col·locats (Cabineo, espigues, cargols): el cnc fa les seves unions de la caixa (Preferències › Ferratges).
  const hw = new Map<string, number>()
  for (const h of doc.hw ?? []) hw.set(h.kind, (hw.get(h.kind) ?? 0) + 1)
  const HW_NAME: Record<string, string> = { cabineo: "Cabineo", dowel: "espigues", screw: "cargols" }
  if (hw.size) warn(`Unions del Taulell: ${[...hw].map(([k, n]) => `${n} × ${HW_NAME[k] ?? k}`).join(", ")}. El cnc hi posa les unions de la caixa del mòdul (Preferències › Ferratges).`)
  return {
    composition: { kind: "moble", modules, references: [], parts },
    name: doc.name?.trim() || "Moble del Taulell",
    modules: modules.length,
    parts: parts.length,
    skipped: { shapes, feats },
    warnings,
  }
}

/** És un projecte del Taulell 3D (el `.taulell` que baixa «Baixa fitxer», o el document que desa al navegador)? */
export function isTaulellDoc(raw: unknown): raw is TaulellDoc {
  if (!raw || typeof raw !== "object" || "format" in raw) return false
  const d = raw as Record<string, unknown>
  return Array.isArray(d.cabs) && Array.isArray(d.parts) && Array.isArray(d.sketches)
}

/** Els materials bàsics del Taulell (`MATS`): clau → nom. */
const TAULELL_BASIC: Record<string, string> = {
  mel: "Melamina blanca",
  roure: "Roure",
  faig: "Faig",
  noguera: "Noguera",
  grafit: "Melamina grafit",
  lacat: "Lacat salvia",
  mdf: "MDF cru",
  hdf: "HDF blanc",
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()

/**
 * Clau de material del Taulell → nom d'un material del cnc: pel nom (el bàsic o el dels materials de proveïdor del Taulell,
 * `userMats`), si n'hi ha un d'igual a `names` (Preferències); si no, `fallback`.
 */
export function taulellMaterial(key: string | undefined, names: readonly string[], fallback: string, userMats: readonly { k?: string; n?: string }[] = []): string {
  const name = (key && (userMats.find((m) => m.k === key)?.n ?? TAULELL_BASIC[key])) || ""
  return (name && names.find((n) => norm(n) === norm(name))) || fallback
}
