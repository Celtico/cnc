import { z } from "zod"
import {
  AmbientSchema,
  BUILTIN_TEMPLATES,
  COLLECTION_PIECES,
  OBJECT_TEMPLATES,
  OPENING_DEFAULTS,
  STORE_CATALOG,
  clampOpening,
  floorArea,
  footprintBox,
  newId,
  removeItems,
  rotateItems,
  roomWalls,
  setItemGroup,
  setWallEnds,
  snapToWalls,
  wallLength,
  wallLoops,
  moveItems,
  type Ambient,
  type AmbientItem,
  type Opening,
  type PlanPt,
  type Settings,
  type Wall,
} from "../model"
import { MAG_FURNITURE } from "../model/magFurniture"
import { AMBIENT_SYSTEM_PROMPT } from "./prompt"
import { fail, parseToolInput, toolDefs, toolFailure, type AssistantToolSet, type ToolRun } from "./toolset"
import { roundTo } from "../../lib/format"

/**
 * Eines de l'assistent IA per als **ambients** (docs/xat-ia.md): parets, obertures, elements (mobles i objectes enllaçats),
 * grups i materials, amb les operacions del model (`core/model/ambient.ts`: `roomWalls`, `setWallEnds`, `clampOpening`,
 * `snapToWalls`, `moveItems`, `rotateItems`, `removeItems`, `setItemGroup`). El que no és de l'ambient (la llista de mobles
 * de l'usuari amb les seves mides i crear un moble d'una plantilla del catàleg) arriba pel context (`AmbientToolContext`):
 * així les eines són pures i es proven sense base de dades. Asíncrones (crear un moble ho és).
 */

const mm = z.number().finite()
const coord = mm.min(-100000).max(100000)
const pt = z.tuple([coord, coord]).describe("Punt del plànol [x, y] en mm (x a la dreta, y avall).")
const wallRef = z.string().min(1).describe("Id de la paret (de get_ambient) o «Paret N».")
const itemRef = z.string().min(1).describe("Id de l'element (de get_ambient) o el seu nom, si és únic.")
const material = z.string().min(1)
const openingKind = z.enum(["window", "door", "glazing"]).describe("window: finestra amb ampit; door: porta (de terra); glazing: vidriera de terra a sostre.")
const deg = mm.min(-3600).max(3600)
const against = {
  against_wall: wallRef.optional().describe("Arrambat a aquesta paret: el darrere contra la cara de la paret del costat de l'habitació (es gira sol)."),
  along: mm.min(0).max(100000).optional().describe("Amb against_wall: centre de l'element al llarg de la paret des de l'extrem a (per defecte, el mig o la projecció de x, y)."),
  gap: mm.min(0).max(2000).optional().describe("Amb against_wall: separació de la paret (mm)."),
}

export const AMBIENT_TOOL_INPUTS = {
  get_ambient: z.object({}).describe("Resum de l'ambient obert: parets (id, extrems, llargada, gruix, alçada, obertures), elements (id, tipus, nom, mides, centre, gir, alçada, grup), materials, superfície de terra i els materials que es poden triar."),
  add_room: z
    .object({
      x: coord.describe("Cantonada de dalt a l'esquerra (x)."),
      y: coord.describe("Cantonada de dalt a l'esquerra (y)."),
      width: mm.min(300).max(100000).describe("Amplada (en x)."),
      depth: mm.min(300).max(100000).describe("Fondària (en y)."),
      inner: z.boolean().default(false).describe("true: x, y, width i depth són de l'interior (de cara a cara de les parets); false: als eixos de les parets."),
      thickness: mm.min(20).max(1000).default(100),
      height: mm.min(500).max(10000).default(2600),
    })
    .describe("Habitació rectangular: quatre parets tancades (dalt, dreta, baix, esquerra)."),
  add_wall: z
    .object({ a: pt, b: pt, thickness: mm.min(20).max(1000).default(100), height: mm.min(500).max(10000).default(2600), material: material.optional().describe("Material propi (sense: el de les parets de l'ambient).") })
    .describe("Una paret de l'eix a a l'eix b."),
  update_wall: z
    .object({
      wall: wallRef,
      a: pt.optional(),
      b: pt.optional(),
      thickness: mm.min(20).max(1000).optional(),
      height: mm.min(500).max(10000).optional(),
      material: z.union([material, z.null()]).optional().describe("Material propi, o null per tornar al de les parets de l'ambient."),
    })
    .describe("Canvia els extrems, el gruix, l'alçada o el material d'una paret. Les obertures es queden al mateix lloc del plànol i s'ajusten si no hi caben."),
  remove_wall: z.object({ wall: wallRef }).describe("Elimina una paret (amb les seves obertures)."),
  add_opening: z
    .object({
      wall: wallRef,
      kind: openingKind,
      at: mm.min(0).max(100000).optional().describe("Centre des de l'extrem a de la paret (per defecte, el mig)."),
      width: mm.min(100).max(20000).optional(),
      height: mm.min(100).max(10000).optional(),
      sill: mm.min(0).max(5000).optional().describe("Alçada de l'ampit (finestra); porta i vidriera, 0."),
      panes: z.number().int().min(1).max(12).optional().describe("Fulles (travessers verticals del vidre)."),
    })
    .describe("Afegeix una finestra, porta o vidriera a una paret (mides per defecte: finestra 1200 × 1200 amb ampit 900; porta 900 × 2100; vidriera 2400 × 2400). Si no hi cap, s'ajusta; no pot trepitjar les que hi ha."),
  update_opening: z
    .object({
      wall: wallRef,
      index: z.number().int().min(0).describe("Índex de l'obertura a la paret (de get_ambient)."),
      kind: openingKind.optional(),
      at: mm.min(0).max(100000).optional(),
      width: mm.min(100).max(20000).optional(),
      height: mm.min(100).max(10000).optional(),
      sill: mm.min(0).max(5000).optional(),
      panes: z.number().int().min(1).max(12).optional(),
    })
    .describe("Canvia una obertura d'una paret."),
  remove_opening: z.object({ wall: wallRef, index: z.number().int().min(0) }).describe("Treu una obertura d'una paret."),
  list_library: z
    .object({
      query: z.string().max(100).optional().describe("Paraules a buscar al nom i a la descripció (sense accents)."),
      source: z.enum(["mine", "catalogue", "all"]).default("all").describe("mine: els mobles i objectes de l'usuari; catalogue: plantilles del catàleg; all: tots dos."),
      kind: z.enum(["moble", "objecte", "all"]).default("all"),
      limit: z.number().int().min(1).max(60).default(25),
    })
    .describe("Busca mobles i objectes per col·locar: els de l'usuari (project_id, mides w × h × d) i les plantilles del catàleg (template)."),
  place_item: z
    .object({
      project_id: z.number().int().optional().describe("Un moble o objecte de l'usuari (list_library › mine)."),
      template: z.string().min(1).optional().describe("Una plantilla del catàleg (list_library › catalogue): es crea a la llista de l'usuari i es col·loca."),
      x: coord.optional().describe("Centre de la petjada (x). Sense x, y ni against_wall: al mig de l'ambient."),
      y: coord.optional(),
      rot: deg.default(0).describe("Gir en graus, horari vist des de dalt (0 = el darrere mira amunt al plànol)."),
      elevation: mm.min(0).max(10000).optional().describe("Alçada des del terra (penjat)."),
      ...against,
      snap: z.boolean().default(false).describe("Arrambar-lo a les cares de les parets properes (a menys de 120 mm)."),
      group: z.string().min(1).max(80).optional(),
    })
    .describe("Col·loca un moble o objecte a l'ambient (enllaçat: és el mateix moble de la llista)."),
  move_item: z
    .object({
      item: itemRef.optional(),
      group: z.string().min(1).optional().describe("Un grup sencer (en lloc d'item; només dx, dy)."),
      x: coord.optional(),
      y: coord.optional(),
      dx: coord.optional(),
      dy: coord.optional(),
      elevation: mm.min(0).max(10000).optional(),
      ...against,
    })
    .describe("Mou un element (a x, y, o dx, dy, o arrambat a una paret) o un grup (dx, dy)."),
  rotate_item: z
    .object({ item: itemRef.optional(), group: z.string().min(1).optional(), rot: deg.optional().describe("Gir final (graus, horari)."), by: deg.optional().describe("Gir relatiu (graus, horari); un grup gira sencer al voltant del seu centre.") })
    .describe("Gira un element o un grup."),
  remove_item: z.object({ item: itemRef.optional(), group: z.string().min(1).optional() }).describe("Treu un element (o tot un grup) de l'ambient (el moble es queda a la llista)."),
  set_item_group: z
    .object({ items: z.array(itemRef).min(1).max(200), group: z.union([z.string().min(1).max(80), z.null()]) })
    .describe("Posa uns elements en un grup (es mouen, giren i s'esborren junts) o els en treu (null)."),
  set_materials: z
    .object({
      floor: material.optional(),
      walls: material.optional(),
      ceiling: z.union([material, z.null()]).optional().describe("null: el de sempre (pintura blanca)."),
      outside_floor: z.union([material, z.null()]).optional().describe("Terra de fora; null: el de sempre (gespa)."),
    })
    .describe("Materials del terra, les parets, el sostre i el terra de fora (noms de get_ambient › materials)."),
} as const

type AmbientToolName = keyof typeof AMBIENT_TOOL_INPUTS
type In<N extends AmbientToolName> = z.output<(typeof AMBIENT_TOOL_INPUTS)[N]>

/** Un moble o objecte de la llista de l'usuari, amb la caixa (mm): amplada × alçada × fondària. */
export interface LibraryEntry {
  id: number
  name: string
  kind: "moble" | "objecte"
  w: number
  h: number
  d: number
  folder?: string
}

/** Plantilla del catàleg (`ref` = la referència de `resolveTemplateRef`). */
export interface CatalogueEntry {
  ref: string
  name: string
  kind: "moble" | "objecte"
  description: string
}

export interface AmbientToolContext {
  settings: Pick<Settings, "materials">
  /** Els mobles i objectes de l'usuari (sense esborranys), amb les mides. */
  library: () => LibraryEntry[] | Promise<LibraryEntry[]>
  /** Les plantilles del catàleg (per defecte, `catalogueEntries()`). */
  catalogue?: () => CatalogueEntry[]
  /** Crea un moble o objecte d'una plantilla (com la galeria) i el torna. */
  createFromTemplate: (ref: string) => Promise<LibraryEntry>
}

/** Totes les plantilles que es poden col·locar (les de les galeries de Mobles i Objectes i les de les escenes). */
export function catalogueEntries(): CatalogueEntry[] {
  const k = (kind: string): "moble" | "objecte" => (kind === "objecte" ? "objecte" : "moble")
  return [
    ...STORE_CATALOG.flatMap((c) => c.types.flatMap((t) => t.items.map((i) => ({ ref: `store:${c.id}:${i.name}`, name: i.name, kind: k(i.kind), description: `${c.name} · ${i.description}` })))),
    ...COLLECTION_PIECES.map((t) => ({ ref: `col:${t.id}`, name: t.name, kind: k(t.kind), description: t.description })),
    ...OBJECT_TEMPLATES.map((t) => ({ ref: `object:${t.id}`, name: t.name, kind: "objecte" as const, description: t.description })),
    ...MAG_FURNITURE.map((t) => ({ ref: `mag:${t.id}`, name: t.name, kind: k(t.kind), description: t.description })),
    ...BUILTIN_TEMPLATES.map((t) => ({ ref: `app:${t.id}`, name: t.name, kind: k(t.kind), description: t.description })),
  ]
}

/** Text sense accents ni majúscules (cerca). */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
const matches = (q: string | undefined, ...texts: string[]) => {
  if (!q?.trim()) return true
  const hay = fold(texts.join(" "))
  return fold(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

const mod360 = (v: number) => Math.round(((v % 360) + 360) % 360)

// --- Referències --------------------------------------------------------------------------------

function findWall(a: Ambient, ref: string): { wall: Wall; index: number } {
  const byId = a.walls.findIndex((w) => w.id === ref)
  if (byId >= 0) return { wall: a.walls[byId]!, index: byId }
  const m = /^(?:paret\s*)?(\d+)$/i.exec(ref.trim())
  const n = m ? Number(m[1]) - 1 : -1
  if (n >= 0 && n < a.walls.length) return { wall: a.walls[n]!, index: n }
  fail(`No hi ha cap paret «${ref}». ${a.walls.length ? `Parets: ${a.walls.map((w, i) => `Paret ${i + 1} (${w.id})`).join(", ")}.` : "L'ambient no té parets."}`)
}

function findItem(a: Ambient, ref: string, names: Map<number, LibraryEntry>): AmbientItem {
  const byId = a.items.find((i) => i.id === ref)
  if (byId) return byId
  const hits = a.items.filter((i) => fold(itemName(i, names)) === fold(ref))
  if (hits.length === 1) return hits[0]!
  if (hits.length > 1) fail(`Hi ha ${hits.length} elements que es diuen «${ref}»: fes servir l'id (${hits.map((i) => i.id).join(", ")}).`)
  fail(`No hi ha cap element «${ref}». Crida get_ambient per veure els ids.`)
}

function groupIdsOf(a: Ambient, group: string): string[] {
  const ids = a.items.filter((i) => i.group === group).map((i) => i.id)
  if (!ids.length) fail(`No hi ha cap grup «${group}». Grups: ${[...new Set(a.items.map((i) => i.group).filter(Boolean))].join(", ") || "cap"}.`)
  return ids
}

function itemName(it: AmbientItem, names: Map<number, LibraryEntry>): string {
  return it.kind === "block" ? it.name : (names.get(it.projectId)?.name ?? "Element esborrat")
}

/** Petjada (w × d) i alçada d'un element. Un moble buit o que no hi és: 600 × 600 (com el requadre del plànol). */
function itemSize(it: AmbientItem, names: Map<number, LibraryEntry>): { w: number; h: number; d: number } {
  if (it.kind === "block") return { w: it.w, h: it.h, d: it.d }
  const e = names.get(it.projectId)
  return e && (e.w >= 1 || e.d >= 1) ? { w: e.w, h: e.h, d: e.d } : { w: 600, h: 0, d: 600 }
}

function pickMaterial(ctx: AmbientToolContext, name: string): string {
  const hit = ctx.settings.materials.find((m) => m.name === name) ?? ctx.settings.materials.find((m) => fold(m.name) === fold(name))
  if (!hit) fail(`El material «${name}» no és a Preferències. Tria'n un de get_ambient › materials.`)
  return hit.name
}

// --- Geometria ----------------------------------------------------------------------------------

/** Centre de l'ambient (de les parets; sense parets, el dels elements; si no, 2000, 1500), com «Afegir» a l'editor. */
function ambientCenter(a: Ambient): PlanPt {
  const pts = a.walls.flatMap((w) => [w.a, w.b])
  if (!pts.length) return [2000, 1500]
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  return [Math.round((Math.min(...xs) + Math.max(...xs)) / 2), Math.round((Math.min(...ys) + Math.max(...ys)) / 2)]
}

/** Costat de l'habitació d'una paret (normal unitària cap a dins): el de `toward` o, si no, el de l'habitació tancada que la conté. */
function insideNormal(a: Ambient, w: Wall, toward?: PlanPt): [number, number] {
  const L = wallLength(w) || 1
  const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L
  const n: [number, number] = [-uy, ux]
  let ref = toward
  if (!ref) {
    const key = (p: PlanPt) => `${Math.round(p[0])},${Math.round(p[1])}`
    const loop = wallLoops(a.walls).find((pts) => pts.some((p) => key(p) === key(w.a)) && pts.some((p) => key(p) === key(w.b)))
    const pts = loop ?? a.walls.flatMap((x) => [x.a, x.b])
    ref = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
  }
  const side = (ref[0] - w.a[0]) * n[0] + (ref[1] - w.a[1]) * n[1]
  return side < 0 ? [-n[0], -n[1]] : n
}

/**
 * Centre i gir d'un element de w × d arrambat a la paret: el darrere contra la cara de dins (més `gap`), centrat a `along`
 * (des de l'extrem a; sense, la projecció de `near` o el mig) i girat perquè el darrere miri la paret.
 */
export function againstWall(a: Ambient, w: Wall, size: { w: number; d: number }, opts: { along?: number; gap?: number; near?: PlanPt }): { x: number; y: number; rot: number } {
  const L = wallLength(w)
  if (L < 1) fail("La paret no té llargada.")
  const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L
  const n = insideNormal(a, w, opts.near)
  let along = opts.along ?? (opts.near ? (opts.near[0] - w.a[0]) * ux + (opts.near[1] - w.a[1]) * uy : L / 2)
  // Dins de la paret si hi cap.
  along = size.w <= L ? Math.max(size.w / 2, Math.min(L - size.w / 2, along)) : L / 2
  const off = w.thickness / 2 + (opts.gap ?? 0) + size.d / 2
  // Sense girar, el darrere mira (0, −1); girat `rot` (horari, y avall), mira (sin, −cos): ha de ser −n.
  const rot = mod360((Math.atan2(-n[0], n[1]) * 180) / Math.PI)
  return { x: Math.round(w.a[0] + ux * along + n[0] * off), y: Math.round(w.a[1] + uy * along + n[1] * off), rot }
}

/** Obertura ajustada a la paret (`clampOpening`) que no trepitja les altres (`skip`: la que es canvia). */
function fitOpening(w: Wall, o: Opening, skip?: number): Opening {
  const c = clampOpening(w, o)
  const others = (w.openings ?? []).map((q, i) => ({ q, i })).filter(({ i }) => i !== skip)
  const hit = others.find(({ q }) => Math.min(c.at + c.w / 2, q.at + q.w / 2) - Math.max(c.at - c.w / 2, q.at - q.w / 2) > 1)
  if (hit) {
    const L = wallLength(w)
    const taken = others.map(({ q }) => [q.at - q.w / 2, q.at + q.w / 2] as const).sort((p, q) => p[0] - q[0])
    const gaps: string[] = []
    let u = 0
    for (const [p, q] of taken) {
      if (p - u >= 100) gaps.push(`${Math.round(u)}–${Math.round(p)}`)
      u = Math.max(u, q)
    }
    if (L - u >= 100) gaps.push(`${Math.round(u)}–${Math.round(L)}`)
    fail(`L'obertura (${Math.round(c.at - c.w / 2)}–${Math.round(c.at + c.w / 2)} mm des de l'extrem a) trepitja la ${hit.i} (${KIND_NAMES[hit.q.kind]}, ${Math.round(hit.q.at - hit.q.w / 2)}–${Math.round(hit.q.at + hit.q.w / 2)}). Trams lliures de la paret (${Math.round(L)} mm): ${gaps.join(", ") || "cap"}.`)
  }
  return c
}

const KIND_NAMES: Record<Opening["kind"], string> = { window: "finestra", door: "porta", glazing: "vidriera" }

// --- Eines --------------------------------------------------------------------------------------

type Done = { doc: Ambient; result: Record<string, unknown> }

/** Aplica una eina a l'ambient. Mai llança. */
export async function runAmbientTool(a: Ambient, name: string, raw: unknown, ctx: AmbientToolContext): Promise<ToolRun<Ambient>> {
  const parsed = parseToolInput(AMBIENT_TOOL_INPUTS, name, raw)
  if (!parsed.ok) return parsed
  try {
    const out = await apply(a, name as AmbientToolName, parsed.data as never, ctx)
    if (out.doc !== a) {
      const check = AmbientSchema.safeParse(out.doc)
      if (!check.success) return { ok: false, error: `El canvi faria un ambient no vàlid (${check.error.issues[0]?.path.join(".")}: ${check.error.issues[0]?.message}); no s'ha aplicat.` }
    }
    return { ok: true, doc: out.doc, result: out.result }
  } catch (e) {
    return toolFailure(name, e)
  }
}

const libraryMap = async (ctx: AmbientToolContext) => new Map((await ctx.library()).map((e) => [e.id, e]))

async function apply(a: Ambient, name: AmbientToolName, input: never, ctx: AmbientToolContext): Promise<Done> {
  switch (name) {
    case "get_ambient":
    case "list_library":
      return { doc: a, result: name === "list_library" ? await listLibrary(input as In<"list_library">, ctx) : {} }
    case "add_room": {
      const i = input as In<"add_room">
      const h = i.inner ? i.thickness / 2 : 0
      const walls = roomWalls(i.x - h, i.y - h, i.x + i.width + h, i.y + i.depth + h, i.thickness, i.height)
      return { doc: { ...a, walls: [...a.walls, ...walls] }, result: { walls: walls.map((w) => w.id), axes: { x0: i.x - h, y0: i.y - h, x1: i.x + i.width + h, y1: i.y + i.depth + h } } }
    }
    case "add_wall": {
      const i = input as In<"add_wall">
      const w: Wall = { id: newId("w"), a: i.a, b: i.b, thickness: i.thickness, height: i.height, ...(i.material ? { material: pickMaterial(ctx, i.material) } : {}) }
      if (wallLength(w) < 50) fail("La paret ha de fer almenys 50 mm de llargada.")
      return { doc: { ...a, walls: [...a.walls, w] }, result: { wall: w.id, length: Math.round(wallLength(w)) } }
    }
    case "update_wall": {
      const i = input as In<"update_wall">
      const { wall } = findWall(a, i.wall)
      let w: Wall = i.a || i.b ? setWallEnds(wall, i.a ?? wall.a, i.b ?? wall.b) : { ...wall }
      if (wallLength(w) < 50) fail("La paret ha de fer almenys 50 mm de llargada.")
      if (i.thickness !== undefined) w.thickness = i.thickness
      if (i.height !== undefined) {
        w.height = i.height
        if (w.openings) w = { ...w, openings: w.openings.map((o) => clampOpening(w, o)) }
      }
      if (i.material !== undefined) {
        if (i.material === null) delete w.material
        else w.material = pickMaterial(ctx, i.material)
      }
      return { doc: { ...a, walls: a.walls.map((x) => (x.id === w.id ? w : x)) }, result: { wall: w.id, length: Math.round(wallLength(w)) } }
    }
    case "remove_wall": {
      const { wall, index } = findWall(a, (input as In<"remove_wall">).wall)
      return { doc: { ...a, walls: a.walls.filter((w) => w.id !== wall.id) }, result: { removed: `Paret ${index + 1}`, wall: wall.id } }
    }
    case "add_opening": {
      const i = input as In<"add_opening">
      const { wall } = findWall(a, i.wall)
      const d = OPENING_DEFAULTS[i.kind]
      const asked: Opening = { kind: i.kind, at: i.at ?? wallLength(wall) / 2, w: i.width ?? d.w, h: i.height ?? d.h, sill: i.kind === "window" ? (i.sill ?? d.sill) : (i.sill ?? 0), ...(i.panes ? { panes: i.panes } : {}) }
      const o = fitOpening(wall, asked)
      const w: Wall = { ...wall, openings: [...(wall.openings ?? []), o] }
      return { doc: { ...a, walls: a.walls.map((x) => (x.id === w.id ? w : x)) }, result: { wall: w.id, index: w.openings!.length - 1, ...openingOut(o), ...(adjusted(asked, o) ? { adjusted: true } : {}) } }
    }
    case "update_opening": {
      const i = input as In<"update_opening">
      const { wall } = findWall(a, i.wall)
      const old = wall.openings?.[i.index]
      if (!old) fail(`La paret no té cap obertura ${i.index} (en té ${wall.openings?.length ?? 0}, de 0 a ${(wall.openings?.length ?? 1) - 1}).`)
      const kind = i.kind ?? old.kind
      const asked: Opening = { ...old, kind, ...(i.at !== undefined ? { at: i.at } : {}), ...(i.width !== undefined ? { w: i.width } : {}), ...(i.height !== undefined ? { h: i.height } : {}), ...(i.sill !== undefined ? { sill: i.sill } : kind !== "window" && i.kind ? { sill: 0 } : {}), ...(i.panes !== undefined ? { panes: i.panes } : {}) }
      const o = fitOpening(wall, asked, i.index)
      const w: Wall = { ...wall, openings: wall.openings!.map((q, k) => (k === i.index ? o : q)) }
      return { doc: { ...a, walls: a.walls.map((x) => (x.id === w.id ? w : x)) }, result: { wall: w.id, index: i.index, ...openingOut(o), ...(adjusted(asked, o) ? { adjusted: true } : {}) } }
    }
    case "remove_opening": {
      const i = input as In<"remove_opening">
      const { wall } = findWall(a, i.wall)
      const old = wall.openings?.[i.index]
      if (!old) fail(`La paret no té cap obertura ${i.index}.`)
      const rest = wall.openings!.filter((_, k) => k !== i.index)
      const w: Wall = rest.length ? { ...wall, openings: rest } : withoutOpenings(wall)
      return { doc: { ...a, walls: a.walls.map((x) => (x.id === w.id ? w : x)) }, result: { wall: w.id, removed: KIND_NAMES[old.kind] } }
    }
    case "place_item": {
      const i = input as In<"place_item">
      if ((i.project_id === undefined) === (i.template === undefined)) fail("Cal project_id (un moble o objecte de l'usuari) o template (una plantilla del catàleg), un dels dos.")
      let entry: LibraryEntry | undefined
      if (i.project_id !== undefined) {
        entry = (await ctx.library()).find((e) => e.id === i.project_id)
        if (!entry) fail(`No hi ha cap moble ni objecte amb project_id ${i.project_id}. Busca'l amb list_library.`)
      } else {
        const ref = i.template!
        if (!(ctx.catalogue ?? catalogueEntries)().some((t) => t.ref === ref)) fail(`No hi ha cap plantilla «${ref}». Busca-la amb list_library (source catalogue).`)
        entry = await ctx.createFromTemplate(ref)
      }
      const e = entry!
      const size = e.w >= 1 || e.d >= 1 ? { w: e.w, d: e.d } : { w: 600, d: 600 }
      const [cx, cy] = ambientCenter(a)
      let pos = { x: i.x ?? cx, y: i.y ?? cy, rot: mod360(i.rot) }
      if (i.against_wall) {
        const { wall } = findWall(a, i.against_wall)
        pos = againstWall(a, wall, size, { along: i.along, gap: i.gap, ...(i.x !== undefined && i.y !== undefined ? { near: [i.x, i.y] as PlanPt } : {}) })
      }
      if (i.snap || i.against_wall) {
        const s = snapToWalls(pos.x, pos.y, size.w, size.d, pos.rot, a.walls)
        pos = { ...pos, x: Math.round(s.x), y: Math.round(s.y) }
      }
      const it: AmbientItem = { id: newId("i"), kind: "moble", projectId: e.id, x: pos.x, y: pos.y, rot: pos.rot, ...(i.elevation ? { elevation: i.elevation } : {}), ...(i.group ? { group: i.group.trim() } : {}) }
      return { doc: { ...a, items: [...a.items, it] }, result: { item: it.id, name: e.name, project_id: e.id, x: it.x, y: it.y, rot: it.rot, ...(i.template ? { created: true } : {}) } }
    }
    case "move_item": {
      const i = input as In<"move_item">
      const names = await libraryMap(ctx)
      if (i.group !== undefined) {
        if (i.item !== undefined) fail("Dona item o group, no tots dos.")
        if (i.x !== undefined || i.y !== undefined || i.against_wall || i.elevation !== undefined) fail("Un grup només es mou amb dx, dy.")
        const ids = groupIdsOf(a, i.group)
        return { doc: moveItems(a, ids, i.dx ?? 0, i.dy ?? 0), result: { group: i.group } }
      }
      if (!i.item) fail("Cal item (o group).")
      const it = findItem(a, i.item!, names)
      let next: AmbientItem = { ...it }
      if (i.against_wall) {
        const { wall } = findWall(a, i.against_wall)
        const size = itemSize(it, names)
        const near: PlanPt = [i.x ?? it.x, i.y ?? it.y]
        const p = againstWall(a, wall, size, { along: i.along, gap: i.gap, near })
        const s = snapToWalls(p.x, p.y, size.w, size.d, p.rot, a.walls)
        next = { ...next, x: Math.round(s.x), y: Math.round(s.y), rot: p.rot }
      } else {
        if (i.x !== undefined) next.x = i.x
        if (i.y !== undefined) next.y = i.y
        if (i.dx !== undefined) next.x += i.dx
        if (i.dy !== undefined) next.y += i.dy
      }
      if (i.elevation !== undefined) {
        if (i.elevation > 0) next.elevation = i.elevation
        else delete next.elevation
      }
      return { doc: { ...a, items: a.items.map((x) => (x.id === it.id ? next : x)) }, result: { item: it.id, name: itemName(it, names), x: next.x, y: next.y, rot: next.rot } }
    }
    case "rotate_item": {
      const i = input as In<"rotate_item">
      const names = await libraryMap(ctx)
      if ((i.rot === undefined) === (i.by === undefined)) fail("Cal rot (gir final) o by (gir relatiu), un dels dos.")
      if (i.group !== undefined) {
        if (i.by === undefined) fail("Un grup gira amb by (relatiu).")
        return { doc: rotateItems(a, groupIdsOf(a, i.group), i.by!), result: { group: i.group } }
      }
      if (!i.item) fail("Cal item (o group).")
      const it = findItem(a, i.item!, names)
      const rot = mod360(i.rot ?? it.rot + i.by!)
      return { doc: { ...a, items: a.items.map((x) => (x.id === it.id ? { ...x, rot } : x)) }, result: { item: it.id, name: itemName(it, names), rot } }
    }
    case "remove_item": {
      const i = input as In<"remove_item">
      const names = await libraryMap(ctx)
      if ((i.item === undefined) === (i.group === undefined)) fail("Cal item o group, un dels dos.")
      const ids = i.group !== undefined ? groupIdsOf(a, i.group) : [findItem(a, i.item!, names).id]
      return { doc: removeItems(a, ids), result: { removed: i.group ?? itemName(a.items.find((x) => x.id === ids[0])!, names), items: ids } }
    }
    case "set_item_group": {
      const i = input as In<"set_item_group">
      const names = await libraryMap(ctx)
      const ids = [...new Set(i.items.map((ref) => findItem(a, ref, names).id))]
      return { doc: setItemGroup(a, ids, i.group === null ? undefined : i.group.trim()), result: { group: i.group, items: ids } }
    }
    case "set_materials": {
      const i = input as In<"set_materials">
      if (i.floor === undefined && i.walls === undefined && i.ceiling === undefined && i.outside_floor === undefined) fail("Cal algun material (floor, walls, ceiling o outside_floor).")
      const next: Ambient = { ...a }
      if (i.floor !== undefined) next.floorMaterial = pickMaterial(ctx, i.floor)
      if (i.walls !== undefined) next.wallMaterial = pickMaterial(ctx, i.walls)
      if (i.ceiling !== undefined) {
        if (i.ceiling === null) delete next.ceilingMaterial
        else next.ceilingMaterial = pickMaterial(ctx, i.ceiling)
      }
      if (i.outside_floor !== undefined) {
        if (i.outside_floor === null) delete next.outsideFloorMaterial
        else next.outsideFloorMaterial = pickMaterial(ctx, i.outside_floor)
      }
      return { doc: next, result: { floor: next.floorMaterial, walls: next.wallMaterial, ceiling: next.ceilingMaterial ?? null, outside_floor: next.outsideFloorMaterial ?? null } }
    }
  }
}

function withoutOpenings(w: Wall): Wall {
  const { openings: _o, ...rest } = w
  void _o
  return rest
}

const openingOut = (o: Opening) => ({ kind: o.kind, at: Math.round(o.at), width: roundTo(o.w, 1), height: roundTo(o.h, 1), sill: roundTo(o.sill, 1), ...(o.panes ? { panes: o.panes } : {}) })
const adjusted = (p: Opening, q: Opening) => Math.abs(p.at - q.at) > 0.5 || Math.abs(p.w - q.w) > 0.5 || Math.abs(p.h - q.h) > 0.5 || Math.abs(p.sill - q.sill) > 0.5

async function listLibrary(i: In<"list_library">, ctx: AmbientToolContext): Promise<Record<string, unknown>> {
  const okKind = (k: string) => i.kind === "all" || i.kind === k
  const out: Record<string, unknown> = {}
  let left = i.limit
  if (i.source !== "catalogue") {
    const mine = (await ctx.library()).filter((e) => okKind(e.kind) && matches(i.query, e.name, e.kind, e.folder ?? ""))
    out.mine = mine.slice(0, left).map((e) => ({ project_id: e.id, name: e.name, kind: e.kind, w: roundTo(e.w, 1), h: roundTo(e.h, 1), d: roundTo(e.d, 1), ...(e.folder ? { folder: e.folder } : {}) }))
    if (mine.length > left) out.mine_more = mine.length - left
    left = Math.max(0, left - (out.mine as unknown[]).length)
  }
  if (i.source !== "mine") {
    const cat = (ctx.catalogue ?? catalogueEntries)().filter((t) => okKind(t.kind) && matches(i.query, t.name, t.description, t.kind))
    const n = i.source === "catalogue" ? i.limit : Math.max(left, Math.min(10, i.limit))
    out.catalogue = cat.slice(0, n).map((t) => ({ template: t.ref, name: t.name, kind: t.kind, description: t.description.length > 140 ? `${t.description.slice(0, 137)}…` : t.description }))
    if (cat.length > n) out.catalogue_more = cat.length - n
  }
  return out
}

// --- Resum --------------------------------------------------------------------------------------

interface AmbientSummaryForAssistant {
  walls: { id: string; label: string; a: number[]; b: number[]; length: number; thickness: number; height: number; material?: string; openings?: { index: number; kind: string; at: number; width: number; height: number; sill: number; panes?: number }[] }[]
  items: { id: string; kind: "moble" | "objecte" | "bloc" | "absent"; name: string; project_id?: number; w: number; h: number; d: number; x: number; y: number; rot: number; elevation?: number; group?: string; box: number[] }[]
  materials: { floor?: string; walls?: string; ceiling?: string; outside_floor?: string }
  /** Superfície de terra de les habitacions tancades (m², als eixos). */
  floor_area_m2: number
  closed_rooms: number
  /** Caixa de les parets [x0, y0, x1, y1]. */
  bounds?: number[]
}

function summarizeAmbient(a: Ambient, names: Map<number, LibraryEntry>): AmbientSummaryForAssistant {
  const pts = a.walls.flatMap((w) => [w.a, w.b])
  return {
    walls: a.walls.map((w, k) => ({
      id: w.id,
      label: `Paret ${k + 1}`,
      a: w.a.map((v) => roundTo(v, 1)),
      b: w.b.map((v) => roundTo(v, 1)),
      length: Math.round(wallLength(w)),
      thickness: roundTo(w.thickness, 1),
      height: roundTo(w.height, 1),
      ...(w.material ? { material: w.material } : {}),
      ...(w.openings?.length ? { openings: w.openings.map((o, index) => ({ index, ...openingOut(o) })) } : {}),
    })),
    items: a.items.map((it) => {
      const s = itemSize(it, names)
      const b = footprintBox(it.x, it.y, s.w, s.d, it.rot)
      const kind = it.kind === "block" ? "bloc" : (names.get(it.projectId)?.kind ?? "absent")
      return {
        id: it.id,
        kind,
        name: itemName(it, names),
        ...(it.kind === "moble" ? { project_id: it.projectId } : {}),
        w: roundTo(s.w, 1),
        h: roundTo(s.h, 1),
        d: roundTo(s.d, 1),
        x: roundTo(it.x, 1),
        y: roundTo(it.y, 1),
        rot: roundTo(it.rot, 1),
        ...(it.elevation ? { elevation: roundTo(it.elevation, 1) } : {}),
        ...(it.group ? { group: it.group } : {}),
        box: [b.x0, b.y0, b.x1, b.y1].map(Math.round),
      }
    }),
    materials: { floor: a.floorMaterial, walls: a.wallMaterial, ceiling: a.ceilingMaterial, outside_floor: a.outsideFloorMaterial },
    floor_area_m2: Math.round(floorArea(a.walls) / 10000) / 100,
    closed_rooms: wallLoops(a.walls).length,
    ...(pts.length ? { bounds: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))].map(Math.round) } : {}),
  }
}

interface AmbientPayload {
  done?: Record<string, unknown>
  ambient?: AmbientSummaryForAssistant
  materials?: string[]
}

export async function ambientPayload(name: string, outcome: { doc: Ambient; result: Record<string, unknown> }, ctx: AmbientToolContext): Promise<AmbientPayload> {
  // La cerca no canvia res: només el que ha trobat (sense el resum sencer).
  if (name === "list_library") return { done: outcome.result }
  const ambient = summarizeAmbient(outcome.doc, await libraryMap(ctx))
  return name === "get_ambient" ? { ambient, materials: ctx.settings.materials.map((m) => m.name) } : { done: outcome.result, ambient }
}

function describeAmbientTool(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case "get_ambient":
      return "Ha mirat l'ambient"
    case "list_library": {
      const n = (Array.isArray(result.mine) ? result.mine.length : 0) + (Array.isArray(result.catalogue) ? result.catalogue.length : 0)
      return `Ha buscat mobles i objectes (${n})`
    }
    case "add_room":
      return "Habitació: 4 parets"
    case "add_wall":
      return `Paret afegida (${String(result.length)} mm)`
    case "update_wall":
      return `Paret (${String(result.length)} mm)`
    case "remove_wall":
      return `Paret eliminada: ${String(result.removed ?? "")}`
    case "add_opening":
      return `${cap(KIND_NAMES[result.kind as Opening["kind"]] ?? "obertura")} de ${String(result.width)} × ${String(result.height)}${result.adjusted ? " (ajustada)" : ""}`
    case "update_opening":
      return `${cap(KIND_NAMES[result.kind as Opening["kind"]] ?? "obertura")}: ${String(result.width)} × ${String(result.height)}${result.adjusted ? " (ajustada)" : ""}`
    case "remove_opening":
      return `Treta: ${String(result.removed ?? "")}`
    case "place_item":
      return `Col·locat: ${String(result.name ?? "")}${result.created ? " (creat del catàleg)" : ""}`
    case "move_item":
      return result.group ? `Grup mogut: ${String(result.group)}` : `Mogut: ${String(result.name ?? "")}`
    case "rotate_item":
      return result.group ? `Grup girat: ${String(result.group)}` : `Girat: ${String(result.name ?? "")} (${String(result.rot)}°)`
    case "remove_item":
      return `Tret de l'ambient: ${String(result.removed ?? "")}`
    case "set_item_group":
      return result.group ? `Grup: ${String(result.group)}` : "Fora del grup"
    case "set_materials":
      return "Materials de l'ambient"
    default:
      return name
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** El joc d'eines dels ambients per al xat. */
export function ambientToolSet(ctx: AmbientToolContext): AssistantToolSet<Ambient> {
  return {
    system: AMBIENT_SYSTEM_PROMPT,
    tools: toolDefs(AMBIENT_TOOL_INPUTS),
    run: (doc, name, input) => runAmbientTool(doc, name, input, ctx),
    payload: (name, _before, outcome) => ambientPayload(name, outcome, ctx),
    describe: (name, result) => describeAmbientTool(name, result),
  }
}
