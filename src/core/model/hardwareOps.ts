import { z } from "zod"
import { signedArea } from "./polygon"
import { repairAtomically } from "./repair"

/**
 * **Generador de mecanitzats** dels ferratges (millores v1 F4, `docs/ferratges-import.md` §7): el que el ferratge fa a la
 * fusta, peça per peça, dit a mà (o llegit de les capes d'un DXF del taller, `core/import/dxfMachining.ts`). Cada
 * operació diu **a quina peça** va (`part`: porta, lateral, base…), a quina **cara** (A/B) o **cantell**, què és (forat,
 * ranura, caixera, contorn) i **on**: en el pla de la peça, amb els dos eixos del moble que hi caben (`P` i `Q`, vegeu
 * `partAxes`), mesurat des del **punt de referència** del ferratge (on el col·loques al moble) o des d'un **cantell** de
 * la peça (de davant, de dalt…, o al mig). Les operacions acaben en `Hole` / `Groove` / `Cutout` normals
 * (`core/build/hardwarePlace.ts`): DXF, .xcs, STEP i CSV sense cap canvi.
 *
 * Pur: sense React ni three. La validació (`machiningProblems`) és la que mana: un ferratge amb una operació dolenta no fa
 * cap forat (mai mig ferratge).
 */

const mm = z.number().finite()

/** Les peces on un ferratge pot mecanitzar (els rols del motor agrupats com els veu l'usuari). */
export const PART_KINDS = [
  { id: "front", label: "Porta / front", roles: ["door", "drawerFront", "flap", "panel", "grille", "hatch"], normal: "z" },
  { id: "side", label: "Lateral", roles: ["side", "divider"], normal: "x" },
  { id: "bottom", label: "Base", roles: ["bottom"], normal: "y" },
  { id: "top", label: "Tapa / tauler de taula", roles: ["top", "worktop"], normal: "y" },
  { id: "shelf", label: "Prestatge", roles: ["shelf", "fixedShelf"], normal: "y" },
  { id: "back", label: "Fons", roles: ["back"], normal: "z" },
  { id: "drawer", label: "Caixa del calaix", roles: ["drawerSide", "drawerBack"], normal: "x" },
  { id: "part", label: "Peça lliure", roles: ["part"], normal: null },
] as const
export type PartKind = (typeof PART_KINDS)[number]["id"]
const PART_IDS = PART_KINDS.map((p) => p.id) as [PartKind, ...PartKind[]]
export const partKindOf = (id: PartKind) => PART_KINDS.find((p) => p.id === id)!

/** El grup d'una peça pel seu rol (`Panel.role`): `null` si no és de cap (llistons, sòcol…). */
export function partKindForRole(role: string): PartKind | null {
  return PART_KINDS.find((p) => (p.roles as readonly string[]).includes(role))?.id ?? null
}

/** Eix del moble: X de costat (esquerra → dreta), Y amunt, Z endavant (del darrere al davant). */
export type WorldAxis = "x" | "y" | "z"
/** Els dos eixos del pla d'una peça amb la normal `n` (en l'ordre X → Y → Z): de cara X·Y, de costat Z·Y, estirada X·Z. */
export function planeAxes(n: WorldAxis): [WorldAxis, WorldAxis] {
  return n === "x" ? ["z", "y"] : n === "y" ? ["x", "z"] : ["x", "y"]
}

/** Com es diuen els dos cantells (mínim, màxim) de cada eix del moble. */
export const AXIS_ENDS: Record<WorldAxis, [string, string]> = { x: ["esquerra", "dreta"], y: ["baix", "dalt"], z: ["darrere", "davant"] }
export const AXIS_NAME: Record<WorldAxis, string> = { x: "De costat", y: "Alçada", z: "Fondària" }

/** Els eixos P i Q d'un grup de peces (la peça lliure no en té de fixos: «Eix 1» i «Eix 2»). */
export function partAxes(kind: PartKind): { p: WorldAxis; q: WorldAxis } | null {
  const n = partKindOf(kind).normal
  if (!n) return null
  const [p, q] = planeAxes(n)
  return { p, q }
}

/** On es mesura una coordenada: des del punt de referència del ferratge, des d'un cantell (mínim o màxim) o del mig. */
export const PosSchema = z.object({ from: z.enum(["ref", "min", "max", "center"]), at: mm })
export type Pos = z.infer<typeof PosSchema>

/** Cantell d'un forat de cantell: el mínim o el màxim de l'eix P o Q. */
export const EdgeRefSchema = z.enum(["pmin", "pmax", "qmin", "qmax"])
export type EdgeRef = z.infer<typeof EdgeRefSchema>

export const GEN_OP_KINDS = [
  { id: "drill", label: "Forat" },
  { id: "groove", label: "Ranura" },
  { id: "pocket", label: "Caixera" },
  { id: "contour", label: "Contorn" },
] as const
export type GenOpKind = (typeof GEN_OP_KINDS)[number]["id"]

/**
 * Una operació del generador. Posició (`p`, `q`) = el **centre**: del forat, de la ranura (al llarg i a través; una ranura
 * `full` va de cantell a cantell i la seva posició al llarg no compta), de la caixera i l'origen dels punts del contorn.
 */
export const GenOpSchema = z.object({
  id: z.string().min(1),
  part: z.enum(PART_IDS),
  kind: z.enum(["drill", "groove", "pocket", "contour"]),
  /** Cara A o B de la peça, o un cantell (`edge`, només forats). */
  face: z.enum(["A", "B", "edge"]),
  edge: EdgeRefSchema.optional(),
  p: PosSchema,
  q: PosSchema,
  /** Forat: Ø. */
  d: mm.positive().optional(),
  /** Fondària (sense `through`). */
  depth: mm.positive(),
  /** Passant (forat, caixera o contorn: talla tot el gruix). */
  through: z.boolean().optional(),
  /** Ranura: amplada; caixera: mida al llarg de P. */
  w: mm.positive().optional(),
  /** Caixera: mida al llarg de Q. */
  h: mm.positive().optional(),
  /** Ranura: llargada (sense `full`). */
  len: mm.positive().optional(),
  /** Ranura de cantell a cantell (la llargada de la peça). */
  full: z.boolean().optional(),
  /** Ranura: al llarg de quin eix. */
  along: z.enum(["p", "q"]).optional(),
  /** Caixera: radi de les cantonades (el fa la fresa: ha de ser ≥ Ø/2 de la fresa). */
  r: mm.min(0).optional(),
  /** Contorn: punts (p, q) relatius a la posició, tancat. */
  points: z.array(z.tuple([mm, mm])).min(3).optional(),
  /** Eina de la màquina per defecte (codi): dona el Ø (forat) o l'amplada (ranura) i en comprova la fondària. */
  tool: z.string().optional(),
  /** Nom curt (opcional): «Carril de dalt». */
  label: z.string().optional(),
})
export type GenOp = z.infer<typeof GenOpSchema>

/** Els mecanitzats d'un item: tots o cap (una operació dolenta treu tota la llista en llegir-la, mai la meitat). */
export const MachiningListSchema = repairAtomically(z.array(GenOpSchema))

/** Les peces que fa servir una llista d'operacions (en l'ordre de `PART_KINDS`). */
export function machiningParts(ops: readonly GenOp[]): PartKind[] {
  return PART_IDS.filter((id) => ops.some((o) => o.part === id))
}

/** Eina (els camps de `MachineTool` que calen aquí: el core/model no depèn de les màquines). */
export interface GenTool {
  code: string
  kind: string
  diameter: number
  /** Fondària útil (0 = desconeguda). */
  maxDepth: number
  label?: string
}

const n = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")

/** El contorn és un rectangle d'eixos (es pot fer com una caixera cega): la caixa [p0, q0, p1, q1], o `null`. */
export function axisRect(pts: readonly (readonly [number, number])[]): [number, number, number, number] | null {
  const ps = dedupe(pts)
  if (ps.length !== 4) return null
  const xs = [...new Set(ps.map((p) => round(p[0])))]
  const ys = [...new Set(ps.map((p) => round(p[1])))]
  if (xs.length !== 2 || ys.length !== 2) return null
  // Els quatre vèrtexs, cadascun una cantonada diferent, i els costats d'eixos (no en diagonal).
  for (let i = 0; i < 4; i++) {
    const a = ps[i]!
    const b = ps[(i + 1) % 4]!
    if (round(a[0]) !== round(b[0]) && round(a[1]) !== round(b[1])) return null
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
const round = (v: number) => Math.round(v * 1000) / 1000
function dedupe(pts: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) out.push([p[0], p[1]])
  }
  if (out.length > 1 && Math.hypot(out[0]![0] - out.at(-1)![0], out[0]![1] - out.at(-1)![1]) < 1e-6) out.pop()
  return out
}

/** Descripció curta d'una operació: «Ranura 8 × 10, de cantell a cantell, cara A». */
export function genOpText(op: GenOp): string {
  const face = op.face === "edge" ? "al cantell" : `cara ${op.face}`
  const depth = op.through ? "passant" : `× ${n(op.depth)}`
  switch (op.kind) {
    case "drill":
      return `Forat Ø${n(op.d ?? 0)} ${depth}, ${face}`
    case "groove":
      return `Ranura ${n(op.w ?? 0)} ${depth}, ${op.full ? "de cantell a cantell" : `de ${n(op.len ?? 0)}`}, ${face}`
    case "pocket":
      return `Caixera ${n(op.w ?? 0)} × ${n(op.h ?? 0)} ${depth}, ${face}`
    case "contour":
      return `Contorn de ${op.points?.length ?? 0} punts ${op.through ? "passant" : `× ${n(op.depth)}`}, ${face}`
  }
}

/** Un problema d'una operació (per a l'editor i per al moble: amb algun, el ferratge no fa cap forat). */
export interface GenOpProblem {
  op: string
  message: string
}

/**
 * Problemes d'una llista d'operacions (pur). `tools` = les eines de la màquina per defecte (si n'hi ha): una operació
 * amb `tool` ha de trobar-la, ser del tipus que toca (broca per als forats, fresa per a la resta), fer el Ø o cabre a
 * l'amplada i arribar a la fondària (`maxDepth`, si es coneix).
 */
export function machiningProblems(ops: readonly GenOp[], tools?: readonly GenTool[]): GenOpProblem[] {
  const out: GenOpProblem[] = []
  const ids = new Set<string>()
  for (const op of ops) {
    const add = (message: string) => out.push({ op: op.id, message })
    if (ids.has(op.id)) add("Id repetit.")
    ids.add(op.id)
    const size = (v: number | undefined, what: string, max = 3000) => {
      if (v === undefined || !(v > 0)) add(`Falta ${what}.`)
      else if (v > max) add(`${what[0]!.toUpperCase()}${what.slice(1)} de ${n(v)} mm: massa gran.`)
    }
    if (!op.through && !(op.depth > 0 && op.depth <= 100)) add(`Fondària de ${n(op.depth)} mm.`)
    if (op.face === "edge") {
      if (op.kind !== "drill") add("Al cantell només hi van forats.")
      if (!op.edge) add("Falta el cantell.")
      if (op.through) add("Un forat de cantell no pot ser passant.")
    } else if (op.edge) add("Un forat de cara no porta cantell.")
    if (op.kind === "drill") size(op.d, "el Ø", 100)
    if (op.kind === "groove") {
      size(op.w, "l'amplada", 200)
      if (!op.full) size(op.len, "la llargada")
      if (!op.along) add("Falta cap on va la ranura.")
    }
    if (op.kind === "pocket") {
      size(op.w, "la mida al llarg", 2000)
      size(op.h, "la mida a través", 2000)
      if (op.r !== undefined && op.w && op.h && op.r > Math.min(op.w, op.h) / 2 + 1e-9) add(`Radi de ${n(op.r)} mm: més gran que mitja caixera.`)
    }
    if (op.kind === "contour") {
      const pts = op.points ?? []
      if (pts.length < 3) add("El contorn necessita almenys 3 punts.")
      else if (Math.abs(signedArea(pts as [number, number][])) < 0.5) add("El contorn no tanca cap superfície.")
      else if (!op.through && !axisRect(pts)) add("Un contorn que no és passant ha de ser un rectangle (la peça no té fresats cecs en corba): fes-lo passant o una caixera.")
    }
    // Les dues coordenades des de la referència o d'un cantell; una ranura de cantell a cantell no en té al llarg.
    for (const k of ["p", "q"] as const) if (!Number.isFinite(op[k].at)) add(`Posició ${k.toUpperCase()} no vàlida.`)
    if (op.tool && tools) {
      const t = tools.find((x) => x.code === op.tool)
      if (!t) add(`L'eina «${op.tool}» no és a la màquina per defecte.`)
      else {
        const name = t.label ?? t.code
        if (op.kind === "drill") {
          if (t.kind !== "drill") add(`«${name}» no és una broca.`)
          else if (op.d !== undefined && Math.abs(t.diameter - op.d) > 0.01) add(`La broca «${name}» fa Ø${n(t.diameter)}, no Ø${n(op.d)}.`)
        } else {
          if (t.kind !== "router") add(`«${name}» no és una fresa.`)
          const narrow = op.kind === "groove" ? op.w : op.kind === "pocket" ? Math.min(op.w ?? 0, op.h ?? 0) : undefined
          if (narrow !== undefined && narrow > 0 && t.diameter > narrow + 0.01) add(`La fresa «${name}» (Ø${n(t.diameter)}) no hi cap (${n(narrow)} mm).`)
          if (op.kind === "pocket" && op.r !== undefined && op.r + 0.01 < t.diameter / 2) add(`La fresa «${name}» fa les cantonades de radi ${n(t.diameter / 2)} mm (més que ${n(op.r)}).`)
        }
        if (!op.through && t.maxDepth > 0 && op.depth > t.maxDepth + 1e-9) add(`«${name}» només arriba a ${n(t.maxDepth)} mm (la fondària és ${n(op.depth)}).`)
      }
    }
  }
  return out
}

/** Repetició d'un ferratge col·locat: `count` còpies separades `spacing` mm al llarg de P o Q. */
export const RepeatSchema = z.object({ axis: z.enum(["p", "q"]), count: z.number().int().min(1).max(100), spacing: mm })
export type Repeat = z.infer<typeof RepeatSchema>

/** On va un ferratge col·locat: una peça d'un mòdul (`panel` = l'id de la peça al mòdul, com la fa el constructor) o una peça lliure. */
export const PlacementTargetSchema = z.object({
  part: z.enum(PART_IDS),
  module: z.string().optional(),
  panel: z.string().optional(),
  freePart: z.string().optional(),
})
export type PlacementTarget = z.infer<typeof PlacementTargetSchema>

/** Etiqueta del cantell d'un forat de cantell, segons els eixos del grup («cantell de davant»). */
export function edgeLabel(kind: PartKind, e: EdgeRef): string {
  const ax = partAxes(kind)
  if (!ax) return { pmin: "Cantell 1r eix, inici", pmax: "Cantell 1r eix, final", qmin: "Cantell 2n eix, inici", qmax: "Cantell 2n eix, final" }[e]
  const axis = e[0] === "p" ? ax.p : ax.q
  const end = AXIS_ENDS[axis][e.endsWith("min") ? 0 : 1]
  return `Cantell ${axis === "y" ? (end === "dalt" ? "de dalt" : "de baix") : end === "esquerra" ? "esquerre" : end === "dreta" ? "dret" : end === "davant" ? "de davant" : "de darrere"}`
}
