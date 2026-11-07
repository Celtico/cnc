import { addBottomPlinth } from "../model/plinthZones"
import { defaultModule, newId, type Composition, type FreePart, type Module, type PartOrient, type Zone } from "../model"
import { PART_AXES } from "../model/freePart"

/**
 * Un moble del Taulell 3D (el document que desa al navegador, `taulell3d-doc-v2`) → un moble del cnc. Prova de cel
 * (2026-11-07): els mobles paramètrics del Taulell (`cabs`) passen a mòduls del cnc amb una fórmula (amplada, alçada,
 * fondària, gruix, fons, sòcol, columnes, prestatges, calaixos i portes), i les peces soltes que són taulers rectes i
 * alineats, a peces lliures. El que no es pot passar encara (formes, mecanitzats, ferratges) es compta a `skipped`.
 */

/** Un moble paramètric del Taulell (`CABDEF`): només els camps que es fan servir aquí. */
interface TaulellCab {
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
  cols?: number
  shelves?: number
  drawers?: number
  drawerH?: number
  doors?: boolean
  cm?: string
  dm?: string
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

export interface TaulellDoc {
  name?: string
  cabs?: TaulellCab[]
  parts?: TaulellPart[]
}

interface TaulellImport {
  composition: Composition
  name: string
  modules: number
  parts: number
  /** Peces soltes que no s'han pogut passar (formes, peces girades) i mecanitzats que s'han deixat. */
  skipped: { shapes: number; feats: number }
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

/** El fons del Taulell → el del cnc. */
const BACK: Record<string, Module["carcass"]["back"]> = { over: "screwed", inside: "inset", rebate: "groove", groove: "groove", none: "none" }

/** El contingut d'una columna: calaixos a baix (de `drawerH` cadascun) i porta amb prestatges a dalt, com el Taulell. */
function columnZone(c: TaulellCab, width: number, frontH: number): Zone {
  const shelves = c.shelves ? { shelves: { n: c.shelves, adjustable: true } } : {}
  const door: Zone["front"] = { kind: "door", mode: width > 600 ? "double" : "single", hinge: "left" }
  const dh = c.drawerH || 180
  let nd = Math.max(0, Math.min(c.drawers ?? 0, Math.floor(frontH / (c.doors ? dh : 60))))
  if (!c.doors) return nd ? { id: newId(), front: { kind: "drawers", n: nd, heights: Array(nd).fill("auto") } } : { id: newId(), ...shelves }
  if (!nd) return { id: newId(), ...shelves, front: door }
  // Si sota la porta quedarien menys de 120 mm, els calaixos ho omplen tot (com `cabLayout`).
  if (frontH - nd * dh < 120) return { id: newId(), front: { kind: "drawers", n: nd, heights: Array(nd).fill("auto") } }
  nd = Math.max(1, nd)
  return {
    id: newId(),
    split: {
      dir: "h",
      // La primera zona d'una divisió horitzontal és la de baix.
      sizes: [r1(nd * dh), "auto"],
      children: [
        { id: newId(), front: { kind: "drawers", n: nd, heights: Array(nd).fill("auto") } },
        { id: newId(), ...shelves, front: door },
      ],
    },
  }
}

/** Un moble paramètric del Taulell → un mòdul del cnc (la «fórmula»). */
function moduleOfCab(c: TaulellCab, mat: (key: string | undefined) => string, gapBefore = 0): Module {
  const plinth = c.plinth !== false && (c.pl ?? 0) > 0 ? c.pl! : 0
  const legs = c.feet === "axilo" ? (c.pl ?? 0) : 0
  const height = c.H - legs
  const m = defaultModule(newId("m"), c.name || "Mòdul", {
    width: c.W,
    height,
    depth: c.D,
    thickness: c.t,
    material: mat(c.cm),
    frontMaterial: mat(c.dm),
    back: BACK[c.back ?? "over"] ?? "screwed",
    backThickness: c.tb ?? 8,
  })
  const cols = Math.max(1, c.cols ?? 1)
  const frontH = height - plinth
  const col = () => columnZone(c, c.W / cols, frontH)
  const root: Zone = cols > 1 ? { id: `${m.id}-root`, split: { dir: "v", sizes: Array(cols).fill("auto"), children: Array.from({ length: cols }, col) } } : { ...col(), id: `${m.id}-root` }
  const out: Module = { ...m, gapBefore, root }
  return plinth && !legs ? addBottomPlinth(out, plinth) : out
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
  let end = x0
  const modules = cabs.map((c) => {
    const x = c.pos?.[0] ?? 0
    const m = moduleOfCab(c, mat, Math.max(0, r1(x - end)))
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
  return {
    composition: { kind: "moble", modules, references: [], parts },
    name: doc.name?.trim() || "Moble del Taulell",
    modules: modules.length,
    parts: parts.length,
    skipped: { shapes, feats },
  }
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
