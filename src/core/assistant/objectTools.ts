import { z } from "zod"
import {
  CompositionSchema,
  duplicateGroup,
  insertPartCopy,
  materialCategory,
  moveGroupBy,
  newId,
  partBox,
  partChoices,
  partGroups,
  reorientPart,
  tidyPart,
  type Composition,
  type FreePart,
  type PartOrient,
  type PNode,
  type Settings,
} from "../model"
import { ellipse, roundRect } from "../model/objectShapes"
import { OBJECT_SYSTEM_PROMPT } from "./prompt"
import { fail, parseToolInput, r1, toolDefs, toolFailure, type AssistantToolSet, type ToolRun } from "./toolset"

/**
 * Eines de l'assistent IA per als **objectes** (docs/xat-ia.md): un objecte és una composició del tipus `objecte` amb
 * només peces lliures (sofàs, làmpades, plantes…; decoratiu, no es fabrica). Les eines fan les mateixes operacions que
 * l'Editor sobre les peces (`freePart.ts`, `editOps.ts`: `reorientPart`, `insertPartCopy`, grups `moveGroupBy`,
 * `duplicateGroup`) i les formes senzilles d'`objectShapes.ts` (rectangle arrodonit, el·lipse). Pures; cada entrada es
 * valida amb zod i un error torna el motiu en català.
 */

const mm = z.number().finite()
const size = mm.positive().max(20000)
const partRef = z.string().min(1).describe("Id de la peça (de get_object) o el seu nom, si és únic.")
const orient = z.enum(["front", "side", "flat"]).describe("front: dreta de cara (w = amplada X, h = alçada Y, gruix en Z). side: dreta de costat (w = fondària Z, h = alçada Y, gruix en X). flat: estirada (w = amplada X, h = fondària Z, gruix = alçada Y).")
const shape = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("rectangle") }),
    z.object({ kind: z.literal("rounded"), radius: mm.positive().max(5000).describe("Radi de les cantonades (mm).") }),
    z.object({ kind: z.literal("ellipse") }),
    z.object({ kind: z.literal("circle").describe("Cercle: h passa a ser igual que w.") }),
  ])
  .describe("Forma de la peça al seu pla (w × h): rectangle, rectangle amb les cantonades arrodonides, el·lipse o cercle.")

export const OBJECT_TOOL_INPUTS = {
  get_object: z.object({}).describe("Resum de l'objecte obert: peces amb id, nom, orientació, mides, gruix, posició, caixa, material, forma i grup; models 3D; i els materials que es poden triar."),
  add_part: z
    .object({
      name: z.string().min(1).max(80).optional().describe("Nom de la peça (per defecte «Peça N»)."),
      orient,
      w: size,
      h: size,
      thickness: size.describe("Gruix (mm). En una peça estirada (flat), és l'alçada del bloc."),
      x: mm.min(-20000).max(20000).describe("Cantonada mínima (esquerra) en X."),
      y: mm.min(0).max(20000).default(0).describe("Cantonada de baix en Y (0 = a terra)."),
      z: mm.min(-20000).max(20000).describe("Cantonada mínima (darrere) en Z."),
      material: z.string().min(1).describe("Nom exacte d'un material de get_object › materials."),
      shape: shape.optional(),
      group: z.string().min(1).max(80).optional().describe("Grup (nom) on va la peça: les del mateix grup es mouen juntes."),
    })
    .describe("Afegeix una peça a l'objecte (no es fabrica: només es veu)."),
  update_part: z
    .object({
      part: partRef,
      name: z.string().min(1).max(80).optional(),
      orient: orient.optional().describe("Nova orientació (es conserva el centre; w i h es queden)."),
      w: size.optional(),
      h: size.optional(),
      thickness: size.optional(),
      x: mm.min(-20000).max(20000).optional(),
      y: mm.min(0).max(20000).optional(),
      z: mm.min(-20000).max(20000).optional(),
      material: z.string().min(1).optional(),
      shape: shape.optional(),
      group: z.union([z.string().min(1).max(80), z.null()]).optional().describe("Grup nou, o null per treure-la del grup."),
    })
    .describe("Canvia el que es doni d'una peça (la resta es queda)."),
  remove_part: z.object({ part: partRef }).describe("Elimina una peça."),
  duplicate_part: z
    .object({ part: partRef, dx: mm.min(-20000).max(20000).optional(), dy: mm.min(-20000).max(20000).optional(), dz: mm.min(-20000).max(20000).optional() })
    .describe("Duplica una peça (mateix grup). Sense desplaçament, la còpia va al costat (X); amb dx/dy/dz, a la posició de l'original més el desplaçament."),
  set_group: z
    .object({ parts: z.array(partRef).min(1).max(200), group: z.union([z.string().min(1).max(80), z.null()]).describe("Nom del grup (nou o existent), o null per treure-les del grup.") })
    .describe("Posa unes peces en un grup (o les en treu)."),
  move_group: z
    .object({ group: z.string().min(1), dx: mm.min(-20000).max(20000).default(0), dy: mm.min(-20000).max(20000).default(0), dz: mm.min(-20000).max(20000).default(0) })
    .describe("Mou totes les peces d'un grup (mm). Cap peça baixa de terra."),
  duplicate_group: z.object({ group: z.string().min(1) }).describe("Duplica un grup sencer al costat (X), amb un nom de grup nou."),
} as const

export type ObjectToolName = keyof typeof OBJECT_TOOL_INPUTS

export interface ObjectToolContext {
  settings: Pick<Settings, "materials">
}

type In<N extends ObjectToolName> = z.output<(typeof OBJECT_TOOL_INPUTS)[N]>
type Done = { doc: Composition; result: Record<string, unknown> }

/** Aplica una eina a l'objecte. Mai llança. */
export function runObjectTool(comp: Composition, name: string, raw: unknown, ctx: ObjectToolContext): ToolRun<Composition> {
  const parsed = parseToolInput(OBJECT_TOOL_INPUTS, name, raw)
  if (!parsed.ok) return parsed
  try {
    const out = apply(comp, name as ObjectToolName, parsed.data as never, ctx)
    if (out.doc !== comp) {
      const check = CompositionSchema.safeParse(out.doc)
      if (!check.success) return { ok: false, error: `El canvi faria un objecte no vàlid (${check.error.issues[0]?.path.join(".")}: ${check.error.issues[0]?.message}); no s'ha aplicat.` }
    }
    return { ok: true, doc: out.doc, result: out.result }
  } catch (e) {
    return toolFailure(name, e)
  }
}

const parts = (comp: Composition) => comp.parts ?? []

function findPart(comp: Composition, ref: string): FreePart {
  const list = parts(comp)
  const byId = list.find((p) => p.id === ref)
  if (byId) return byId
  const byName = list.filter((p) => p.name === ref || p.name.toLowerCase() === ref.toLowerCase())
  if (byName.length === 1) return byName[0]!
  if (byName.length > 1) fail(`Hi ha ${byName.length} peces que es diuen «${ref}»: fes servir l'id (${byName.map((p) => p.id).join(", ")}).`)
  fail(`No hi ha cap peça «${ref}». Crida get_object per veure els ids.`)
}

function pickMaterial(ctx: ObjectToolContext, name: string): string {
  const choices = partChoices(ctx.settings.materials)
  const hit = choices.find((m) => m.name === name) ?? choices.find((m) => m.name.toLowerCase() === name.toLowerCase())
  if (!hit) fail(`El material «${name}» no és a Preferències (o és un fons). Tria'n un de get_object › materials.`)
  return hit.name
}

/** Contorn de la forma triada a w × h (sense: rectangle). */
function shapeNodes(kind: In<"add_part">["shape"], w: number, h: number): PNode[] | undefined {
  if (!kind || kind.kind === "rectangle") return undefined
  if (kind.kind === "rounded") {
    if (kind.radius * 2 > Math.min(w, h)) fail(`El radi (${kind.radius} mm) no hi cap: com a molt la meitat del costat curt (${Math.floor(Math.min(w, h) / 2)} mm).`)
    return roundRect(w, h, kind.radius)
  }
  return ellipse(w, h)
}

const close = (a: PNode[], b: PNode[]) =>
  a.length === b.length &&
  a.every((n, i) => {
    const m = b[i]!
    const v = (p?: [number, number], q?: [number, number]) => (!p && !q) || (!!p && !!q && Math.abs(p[0] - q[0]) < 0.05 && Math.abs(p[1] - q[1]) < 0.05)
    return Math.abs(n.x - m.x) < 0.05 && Math.abs(n.y - m.y) < 0.05 && v(n.in, m.in) && v(n.out, m.out)
  })

/** Quina forma senzilla és (la de les eines) o «custom» (feta amb l'editor de perfils). */
export function partShapeKind(p: Pick<FreePart, "shape">): { kind: "rectangle" | "rounded" | "ellipse" | "circle" | "custom"; radius?: number } {
  const s = p.shape as PNode[] | undefined
  if (!s?.length) return { kind: "rectangle" }
  const xs = s.map((n) => n.x), ys = s.map((n) => n.y)
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys)
  if (Math.min(...xs) === 0 && Math.min(...ys) === 0) {
    if (close(s, ellipse(w, h))) return { kind: Math.abs(w - h) < 0.05 ? "circle" : "ellipse" }
    if (s.length === 8 && close(s, roundRect(w, h, s[0]!.y))) return { kind: "rounded", radius: r1(s[0]!.y) }
  }
  return { kind: "custom" }
}

function nextPartName(comp: Composition): string {
  const used = new Set(parts(comp).map((p) => p.name))
  let n = parts(comp).length + 1
  while (used.has(`Peça ${n}`)) n++
  return `Peça ${n}`
}

const replacePart = (comp: Composition, p: FreePart): Composition => ({ ...comp, parts: parts(comp).map((x) => (x.id === p.id ? p : x)) })

function apply(comp: Composition, name: ObjectToolName, input: never, ctx: ObjectToolContext): Done {
  switch (name) {
    case "get_object":
      return { doc: comp, result: {} }
    case "add_part": {
      const i = input as In<"add_part">
      const h = i.shape?.kind === "circle" ? i.w : i.h
      const shapeNow = shapeNodes(i.shape, i.w, h)
      const p: FreePart = tidyPart({
        id: newId("p"),
        name: i.name?.trim() || nextPartName(comp),
        orient: i.orient,
        w: i.w,
        h,
        thickness: i.thickness,
        material: pickMaterial(ctx, i.material),
        x: i.x,
        y: i.y,
        z: i.z,
        nest: false,
        ...(shapeNow ? { shape: shapeNow } : {}),
        ...(i.group ? { group: i.group.trim() } : {}),
      })
      return { doc: { ...comp, parts: [...parts(comp), p] }, result: { part_id: p.id, name: p.name } }
    }
    case "update_part": {
      const i = input as In<"update_part">
      const old = findPart(comp, i.part)
      const was = partShapeKind(old)
      let p: FreePart = i.orient ? reorientPart(old, i.orient as PartOrient) : { ...old }
      if (i.name !== undefined) p.name = i.name.trim()
      if (i.w !== undefined) p.w = i.w
      if (i.h !== undefined) p.h = i.h
      if (i.thickness !== undefined) p.thickness = i.thickness
      if (i.x !== undefined) p.x = i.x
      if (i.y !== undefined) p.y = i.y
      if (i.z !== undefined) p.z = i.z
      if (i.material !== undefined) p.material = pickMaterial(ctx, i.material)
      if (i.group !== undefined) {
        if (i.group === null) delete p.group
        else p.group = i.group.trim()
      }
      // La forma: la nova, o la d'abans refeta a la mida nova (un arrodonit es queda amb el mateix radi).
      const next = i.shape ?? (was.kind === "rounded" ? { kind: "rounded" as const, radius: was.radius! } : was.kind === "ellipse" || was.kind === "circle" ? { kind: was.kind } : undefined)
      if (next?.kind === "circle") {
        if (i.w !== undefined && i.h !== undefined && i.w !== i.h) fail("Un cercle té w = h.")
        const d = i.h !== undefined && i.w === undefined ? p.h : p.w
        p.w = d
        p.h = d
      }
      if (next) {
        const nodes = shapeNodes(next, p.w, p.h)
        if (nodes) p.shape = nodes
        else delete p.shape
      }
      // La resta de materials: com la UI, sempre sense nesting (és un objecte).
      p.nest = false
      p = tidyPart(p)
      return { doc: replacePart(comp, p), result: { part_id: p.id, name: p.name } }
    }
    case "remove_part": {
      const p = findPart(comp, (input as In<"remove_part">).part)
      return { doc: { ...comp, parts: parts(comp).filter((x) => x.id !== p.id) }, result: { removed: p.name, part_id: p.id } }
    }
    case "duplicate_part": {
      const i = input as In<"duplicate_part">
      const src = findPart(comp, i.part)
      const r = insertPartCopy(comp, src)
      let doc = r.comp
      if (i.dx !== undefined || i.dy !== undefined || i.dz !== undefined) {
        const copy = parts(doc).find((p) => p.id === r.id)!
        const y = src.y + (i.dy ?? 0)
        if (y < 0) fail("La còpia quedaria sota terra (y < 0).")
        doc = replacePart(doc, { ...copy, x: src.x + (i.dx ?? 0), y, z: src.z + (i.dz ?? 0) })
      }
      return { doc, result: { part_id: r.id, name: parts(doc).find((p) => p.id === r.id)?.name } }
    }
    case "set_group": {
      const i = input as In<"set_group">
      const ids = new Set(i.parts.map((ref) => findPart(comp, ref).id))
      const g = i.group === null ? undefined : i.group.trim()
      const doc = { ...comp, parts: parts(comp).map((p) => (ids.has(p.id) ? (g ? { ...p, group: g } : withoutGroup(p)) : p)) }
      return { doc, result: { group: g ?? null, parts: [...ids] } }
    }
    case "move_group": {
      const i = input as In<"move_group">
      if (!parts(comp).some((p) => p.group === i.group)) fail(`No hi ha cap grup «${i.group}». Grups: ${partGroups(parts(comp)).join(", ") || "cap"}.`)
      return { doc: moveGroupBy(comp, i.group, i.dx, i.dy, i.dz), result: { group: i.group } }
    }
    case "duplicate_group": {
      const i = input as In<"duplicate_group">
      if (!parts(comp).some((p) => p.group === i.group)) fail(`No hi ha cap grup «${i.group}». Grups: ${partGroups(parts(comp)).join(", ") || "cap"}.`)
      const r = duplicateGroup(comp, i.group)
      return { doc: r.comp, result: { group: r.group } }
    }
  }
}

function withoutGroup(p: FreePart): FreePart {
  const { group: _g, ...rest } = p
  void _g
  return rest
}

// --- Resum -------------------------------------------------------------------------------------

export interface ObjectPartSummary {
  id: string
  name: string
  orient: PartOrient
  w: number
  h: number
  thickness: number
  /** Cantonada mínima (x, y, z). */
  x: number
  y: number
  z: number
  /** Caixa a l'escena: [x0, y0, z0, x1, y1, z1]. */
  box: number[]
  material: string
  shape: string
  group?: string
  cut?: true
}

export interface ObjectSummary {
  /** Mida de tot l'objecte (caixa de les peces i els models): amplada X × alçada Y × fondària Z. */
  size: { w: number; h: number; d: number } | null
  parts: ObjectPartSummary[]
  groups: string[]
  models?: { id: string; name: string; x: number; y: number; z: number; w: number; h: number; d: number }[]
}

export function summarizeObject(comp: Composition): ObjectSummary {
  const ps = parts(comp)
  const boxes = [...ps.map(partBox), ...(comp.models ?? []).map((m) => ({ min: [m.x, m.y, m.z], max: [m.x + m.w, m.y + m.h, m.z + m.d] }))]
  const all = boxes.length ? { min: [0, 1, 2].map((a) => Math.min(...boxes.map((b) => b.min[a]!))), max: [0, 1, 2].map((a) => Math.max(...boxes.map((b) => b.max[a]!))) } : null
  return {
    size: all ? { w: r1(all.max[0]! - all.min[0]!), h: r1(all.max[1]! - all.min[1]!), d: r1(all.max[2]! - all.min[2]!) } : null,
    parts: ps.map((p) => {
      const b = partBox(p)
      const s = partShapeKind(p)
      return {
        id: p.id,
        name: p.name,
        orient: p.orient,
        w: r1(p.w),
        h: r1(p.h),
        thickness: r1(p.thickness),
        x: r1(p.x),
        y: r1(p.y),
        z: r1(p.z),
        box: [...b.min, ...b.max].map(r1),
        material: p.material,
        shape: s.kind === "rounded" ? `rounded r=${s.radius}` : s.kind,
        ...(p.group ? { group: p.group } : {}),
        ...(p.effect === "cut" ? { cut: true as const } : {}),
      }
    }),
    groups: partGroups(ps),
    ...(comp.models?.length ? { models: comp.models.map((m) => ({ id: m.id, name: m.name, x: r1(m.x), y: r1(m.y), z: r1(m.z), w: r1(m.w), h: r1(m.h), d: r1(m.d) })) } : {}),
  }
}

/** Materials que es poden triar per a les peces d'un objecte (noms, per categoria). */
export function objectMaterials(settings: Pick<Settings, "materials">): { simulation: string[]; boards: string[] } {
  const list = partChoices(settings.materials)
  return { simulation: list.filter((m) => materialCategory(m) === "sim").map((m) => m.name), boards: list.filter((m) => materialCategory(m) === "board").map((m) => m.name) }
}

export interface ObjectPayload {
  done?: Record<string, unknown>
  object: ObjectSummary
  materials?: ReturnType<typeof objectMaterials>
}

export function objectPayload(name: string, outcome: { doc: Composition; result: Record<string, unknown> }, ctx: ObjectToolContext): ObjectPayload {
  const object = summarizeObject(outcome.doc)
  return name === "get_object" ? { object, materials: objectMaterials(ctx.settings) } : { done: outcome.result, object }
}

export function describeObjectTool(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case "get_object":
      return "Ha mirat l'objecte"
    case "add_part":
      return `Peça afegida: ${String(result.name ?? "")}`
    case "update_part":
      return `Peça: ${String(result.name ?? "")}`
    case "remove_part":
      return `Peça eliminada: ${String(result.removed ?? "")}`
    case "duplicate_part":
      return `Còpia: ${String(result.name ?? "")}`
    case "set_group":
      return result.group ? `Grup: ${String(result.group)}` : "Fora del grup"
    case "move_group":
      return `Grup mogut: ${String(result.group ?? "")}`
    case "duplicate_group":
      return `Grup duplicat: ${String(result.group ?? "")}`
    default:
      return name
  }
}

/** El joc d'eines dels objectes per al xat. */
export function objectToolSet(ctx: ObjectToolContext): AssistantToolSet<Composition> {
  return {
    system: OBJECT_SYSTEM_PROMPT,
    tools: toolDefs(OBJECT_TOOL_INPUTS),
    run: (doc, name, input) => runObjectTool(doc, name, input, ctx),
    payload: (name, _before, outcome) => objectPayload(name, outcome, ctx),
    describe: (name, result) => describeObjectTool(name, result),
  }
}
