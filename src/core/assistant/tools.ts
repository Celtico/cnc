import { z } from "zod"
import { buildComposition } from "../build/buildComposition"
import { splitChildSizes } from "../build/layout"
import {
  applySettingsToModule,
  backChoices,
  boardChoices,
  canHoldFront,
  canHoldShelves,
  compositionKind,
  CompositionSchema,
  coveringZone,
  defaultModule,
  emptyModule,
  findZone,
  materialByName,
  newId,
  parentOf,
  partsOnlyKind,
  removeModule,
  setFront,
  setModuleMount,
  setShelves,
  setSplitSize,
  splitDirsFor,
  splitZone,
  switchFront,
  tableModule,
  unsplitZone,
  visibleModule,
  zoneBounds,
  type Composition,
  type Front,
  type Module,
  type Settings,
  type Zone,
} from "../model"
import { ASSISTANT_SYSTEM_PROMPT } from "./prompt"
import { allWarnings, summarizeCatalog, summarizeMoble, warningKey, type CatalogSummary, type MobleSummary, type WarningSummary } from "./summary"
import { fail, parseToolInput, toolDefs, toolFailure, type AssistantToolSet, type ToolDef } from "./toolset"

/**
 * Eines de l'assistent IA (docs/xat-ia.md): les operacions de l'editor sobre la composició oberta, **pures** (composició
 * → composició nova) i amb les mateixes regles que la UI (què aguanta cada compartiment, `zoneSupport.ts`; portes de tot
 * el mòdul només a l'Interior dividit; l'última zona d'una divisió és el que sobra; res amagat compta). Cada entrada es
 * valida amb zod (el mateix esquema fa el JSON Schema de l'eina, `assistantTools`); un error torna el motiu en català
 * perquè el model es corregeixi. El resultat de cada canvi porta el resum del moble i els avisos nous.
 */

const mm = z.number().finite()
const moduleRef = z.string().min(1).describe("Id del mòdul (de get_moble) o el seu nom exacte.")
const zoneRef = z.string().min(1).describe("Id del compartiment (de get_moble). Sense: l'Interior (l'arrel) del mòdul.")
const sizeOrAuto = z.union([mm.positive(), z.literal("auto")])

/** Entrades de cada eina. Els límits de mida són els de l'esquema del model (`CarcassSchema`). */
const TOOL_INPUTS = {
  get_moble: z.object({}).describe("Resum del moble obert: mòduls, mides, caixa, compartiments amb ids i llums, fronts, avisos de fusteria i els materials i jocs de calaix que es poden triar."),
  add_module: z
    .object({
      name: z.string().min(1).max(80).optional().describe("Nom del mòdul (per defecte «Mòdul N»)."),
      width: mm.min(100).max(3000),
      height: mm.min(100).max(2800),
      depth: mm.min(100).max(1200),
      preset: z.enum(["box", "empty"]).default("box").describe("box: caixa sencera (laterals, tapa, base a terra, fons en ranura, un prestatge regulable). empty: només la base, sense laterals, tapa ni fons (es completa amb set_carcass)."),
      after: z.string().optional().describe("Id o nom del mòdul darrere del qual va (a la seva fila). Sense: al final."),
      mount: z.enum(["wall", "hung", "floor"]).default("wall").describe("wall: a terra arrambat a la paret; hung: penjat a la paret; floor: lliure al terra (illa)."),
      floor_height: mm.min(0).max(2800).optional().describe("Només hung: alçada de la part de baix del mòdul des del terra (per defecte 1450)."),
    })
    .describe("Afegeix un mòdul nou amb els materials, gruixos i folgances de Preferències."),
  remove_module: z.object({ module: moduleRef }).describe("Elimina un mòdul (les peces enganxades queden soltes, el taulell i el sòcol passen al mòdul més proper)."),
  rename_module: z.object({ module: moduleRef, name: z.string().min(1).max(80) }).describe("Canvia el nom d'un mòdul."),
  set_module_size: z
    .object({ module: moduleRef, width: mm.min(100).max(3000).optional(), height: mm.min(100).max(2800).optional(), depth: mm.min(100).max(1200).optional() })
    .describe("Mides exteriors de la caixa del mòdul (mm). Les divisions s'hi adapten (les zones «auto» agafen el que sobra)."),
  set_module_position: z
    .object({
      module: moduleRef,
      mount: z.enum(["wall", "hung", "floor"]).optional().describe("wall: a terra arrambat; hung: penjat; floor: lliure al terra."),
      floor_height: mm.min(0).max(2800).optional().describe("Penjat: alçada de la part de baix des del terra."),
      gap_before: mm.min(0).max(5000).optional().describe("Separació amb el mòdul anterior de la fila (o des de l'inici si és el primer)."),
      wall_gap: mm.min(0).max(10000).optional().describe("Lliure al terra: separació de la paret."),
      x: mm.min(-20000).max(20000).optional().describe("Lliure al terra: posició de costat des de l'inici del moble."),
    })
    .describe("On va el mòdul: fila (a terra o penjat), separacions i, si és lliure al terra, la posició."),
  set_carcass: z
    .object({
      module: moduleRef,
      base: z
        .discriminatedUnion("kind", [
          z.object({ kind: z.literal("none") }).describe("Base directa a terra."),
          z.object({ kind: z.literal("plinth"), height: mm.min(20).max(300).default(100), setback: mm.min(0).max(200).default(50) }).describe("Sòcol retranquejat."),
          z.object({ kind: z.literal("legs"), height: mm.min(20).max(500).default(120) }).describe("Potes."),
          z.object({ kind: z.literal("open") }).describe("Sense base: laterals fins a terra (cobreradiador)."),
        ])
        .optional()
        .describe("Base (per penjar-lo, set_module_position mount=hung)."),
      back: z.enum(["groove", "screwed", "inset", "none"]).optional().describe("Fons: en ranura, cargolat darrere, encastat o sense."),
      top: z
        .union([z.enum(["full", "none"]), z.object({ kind: z.literal("ventSlot"), gap: mm.min(5).max(200) })])
        .optional()
        .describe("Tapa: sencera, sense, o amb ranura d'aire al darrere ({kind:'ventSlot', gap})."),
      sides: z.object({ left: z.boolean(), right: z.boolean() }).optional().describe("Laterals."),
      joint: z.enum(["butt", "mitre"]).optional().describe("Cantonades: normals o a inglet (45°)."),
      front_style: z.enum(["overlay", "inset"]).optional().describe("Fronts recobrents (per davant) o encastats (dins de la llum)."),
    })
    .describe("Caixa del mòdul: base, fons, tapa, laterals, cantonades i estil dels fronts."),
  split_zone: z
    .object({
      module: moduleRef,
      zone: zoneRef.optional(),
      dir: z.enum(["v", "h"]).describe("v: divisors verticals (zones d'esquerra a dreta); h: travessers (zones de baix a dalt)."),
      n: z.number().int().min(2).max(12).describe("Nombre de zones."),
      sizes: z.array(sizeOrAuto).max(11).optional().describe("Mides (mm de llum) de les n−1 primeres zones, d'esquerra a dreta o de baix a dalt, o 'auto'. L'última és sempre el que sobra."),
    })
    .describe("Divideix un compartiment sense dividir en n zones. El contingut que tenia passa a la primera."),
  unsplit_zone: z.object({ module: moduleRef, zone: zoneRef.optional() }).describe("Treu la divisió d'un compartiment (torna a ser un de sol amb el contingut de la primera zona)."),
  set_zone_size: z
    .object({ module: moduleRef, zone: z.string().min(1).describe("Id del compartiment fill d'una divisió (no l'últim)."), size: sizeOrAuto.describe("Mida en mm de llum o 'auto'.") })
    .describe("Mida d'una zona dins de la seva divisió (amplada en una divisió vertical, alçada en una d'horitzontal). L'última zona no es fixa: és el que sobra."),
  set_front: z
    .object({
      module: moduleRef,
      zone: zoneRef.optional(),
      kind: z.enum(["none", "door", "drawers", "flap", "grille", "panel"]).describe("none: obert; door: porta(es); drawers: calaixos; flap: abatible; grille: reixeta; panel: front fix."),
      door: z.object({ mode: z.enum(["single", "double"]).optional(), hinge: z.enum(["left", "right"]).optional().describe("Costat de les frontisses (una porta)."), glass: z.boolean().optional().describe("Porta de vidre amb marc d'alumini.") }).optional(),
      drawers: z
        .object({
          n: z.number().int().min(1).max(10).optional(),
          heights: z.array(sizeOrAuto).max(10).optional().describe("Alçades dels fronts de baix a dalt (mm o 'auto')."),
          kit: z.string().optional().describe("Id o nom d'un joc de calaix de doble paret (drawer_kits de get_moble); 'none' per tornar a la guia del mòdul."),
        })
        .optional(),
      flap: z.object({ dir: z.enum(["down", "up"]) }).optional(),
      handle: z.enum(["module", "none"]).optional().describe("module: el tirador del mòdul; none: sense tirador (obertura per pressió, push)."),
    })
    .describe("Contingut (front) d'un compartiment sense dividir. A l'Interior dividit d'un mòdul només hi van portes de dalt a baix (kind door o none). El que tenia es recorda (tornar al mateix tipus el recupera)."),
  set_shelves: z
    .object({ module: moduleRef, zone: zoneRef.optional(), n: z.number().int().min(0).max(20), adjustable: z.boolean().optional().describe("Regulables (fileres System 32) o fixos (amb espigues).") })
    .describe("Prestatges d'un compartiment sense dividir (no amb calaixos ni front fix; cal una peça a cada costat)."),
  set_material: z
    .object({
      module: z.string().optional().describe("Id o nom del mòdul. Sense: tots els mòduls."),
      body: z.string().optional().describe("Material del cos (board_materials)."),
      thickness: mm.min(8).max(40).optional().describe("Gruix del cos (un dels del material)."),
      fronts: z.string().optional().describe("Material dels fronts (board_materials) o 'same' = com el cos."),
      back: z.string().optional().describe("Material del fons (back_materials) o 'same' = com el cos."),
      back_thickness: mm.min(3).max(40).optional(),
    })
    .describe("Materials i gruixos (noms exactes de Preferències: board_materials i back_materials de get_moble)."),
} as const

type ToolName = keyof typeof TOOL_INPUTS
export const TOOL_NAMES = Object.keys(TOOL_INPUTS) as ToolName[]

/** Definicions per a l'API (`tools`): nom, descripció i `input_schema` (JSON Schema de l'esquema zod). */
export function assistantTools(): (ToolDef & { name: ToolName })[] {
  return toolDefs(TOOL_INPUTS) as (ToolDef & { name: ToolName })[]
}

interface ToolContext {
  settings: Pick<Settings, "materials" | "hardwareLibrary" | "hardwareDefaults" | "defaults" | "gaps">
}

export type ToolOutcome =
  | { ok: true; comp: Composition; result: Record<string, unknown> }
  | { ok: false; error: string }

function findModule(comp: Composition, ref: string): Module {
  const m = comp.modules.find((x) => x.id === ref) ?? comp.modules.find((x) => x.name === ref) ?? comp.modules.find((x) => x.name.toLowerCase() === ref.toLowerCase())
  if (!m) fail(`No hi ha cap mòdul «${ref}». Mòduls: ${comp.modules.map((x) => `${x.name} (${x.id})`).join(", ") || "cap"}.`)
  return m!
}

function findZoneIn(m: Module, ref: string | undefined): Zone {
  if (!ref) return m.root
  const z = findZone(m.root, ref)
  if (!z) fail(`El mòdul «${m.name}» no té cap compartiment «${ref}». Crida get_moble per veure els ids.`)
  return z!
}

const replaceModule = (comp: Composition, m: Module): Composition => ({ ...comp, modules: comp.modules.map((x) => (x.id === m.id ? m : x)) })

function zoneName(m: Module, z: Zone): string {
  return z.id === m.root.id ? `l'Interior de «${m.name}»` : `el compartiment ${z.id} de «${m.name}»`
}

/** Nom per defecte del mòdul nou («Mòdul N», sense repetir). */
function nextModuleName(comp: Composition): string {
  const used = new Set(comp.modules.map((m) => m.name))
  let n = comp.modules.length + 1
  while (used.has(`Mòdul ${n}`)) n++
  return `Mòdul ${n}`
}

function pickMaterial(settings: ToolContext["settings"], name: string, list: "board" | "back"): { name: string; thicknesses: number[] } {
  const choices = list === "board" ? boardChoices(settings.materials) : backChoices(settings.materials)
  const hit = choices.find((m) => m.name === name) ?? choices.find((m) => m.name.toLowerCase() === name.toLowerCase())
  if (!hit) {
    const known = materialByName(settings as Settings, name)
    fail(known ? `«${known.name}» no es pot fer servir aquí (no és un ${list === "board" ? "tauler" : "tauler ni un fons"} de CNC).` : `El material «${name}» no és a Preferències. Tria'n un de ${list === "board" ? "board_materials" : "back_materials"} (get_moble).`)
  }
  return hit!
}

const nearest = (list: number[], v: number) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a))

/** Aplica una eina. Mai llança: un error de validació o de regla torna `{ ok: false, error }`. */
export function runAssistantTool(comp: Composition, name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  const parsed = parseToolInput(TOOL_INPUTS, name, rawInput)
  if (!parsed.ok) return parsed
  try {
    const out = apply(comp, name as ToolName, parsed.data as never, ctx)
    if (out.comp !== comp) {
      const check = CompositionSchema.safeParse(out.comp)
      if (!check.success) return { ok: false, error: `El canvi faria un moble no vàlid (${check.error.issues[0]?.path.join(".")}: ${check.error.issues[0]?.message}); no s'ha aplicat.` }
    }
    return { ok: true, comp: out.comp, result: out.result }
  } catch (e) {
    return toolFailure(name, e)
  }
}

type In<N extends ToolName> = z.output<(typeof TOOL_INPUTS)[N]>

function apply(comp: Composition, name: ToolName, input: never, ctx: ToolContext): { comp: Composition; result: Record<string, unknown> } {
  const modulesOnly = () => {
    if (partsOnlyKind(compositionKind(comp))) fail("Aquest document només té peces lliures (objecte o flat-pack d'abans): no hi van mòduls.")
  }
  switch (name) {
    case "get_moble":
      return { comp, result: {} }
    case "add_module": {
      modulesOnly()
      const i = input as In<"add_module">
      const id = newId("m")
      const label = i.name?.trim() || nextModuleName(comp)
      const base = compositionKind(comp) === "taula" ? tableModule(id, label) : i.preset === "empty" ? emptyModule(id, label) : defaultModule(id, label)
      const sized = applySettingsToModule(ctx.settings as Settings, base)
      let m: Module = { ...sized, carcass: { ...sized.carcass, width: i.width, height: i.height, depth: i.depth } }
      m = setModuleMount(m, i.mount, 0, i.floor_height)
      const modules = [...comp.modules]
      const after = i.after ? findModule(comp, i.after) : undefined
      const at = after ? modules.indexOf(after) + 1 : modules.length
      modules.splice(at, 0, m)
      let next: Composition = { ...comp, modules }
      // Lliure al terra: al costat del que hi ha (no a sobre).
      if (i.mount === "floor") {
        const b = buildComposition(next)
        const right = b.modules.filter((x) => x.id !== m.id).reduce((acc, x) => Math.max(acc, x.x + (next.modules.find((y) => y.id === x.id)?.carcass.width ?? 0)), 0)
        next = replaceModule(next, { ...m, x: right ? Math.round(right + 100) : 0 })
      }
      return { comp: next, result: { module_id: m.id, name: m.name, interior_zone: m.root.id } }
    }
    case "remove_module": {
      const i = input as In<"remove_module">
      const m = findModule(comp, i.module)
      const res = removeModule(comp, m.id)
      return { comp: res.comp, result: { removed: m.name, ...(res.notes.length ? { notes: res.notes } : {}) } }
    }
    case "rename_module": {
      const i = input as In<"rename_module">
      const m = findModule(comp, i.module)
      return { comp: replaceModule(comp, { ...m, name: i.name.trim() }), result: { module_id: m.id, name: i.name.trim() } }
    }
    case "set_module_size": {
      const i = input as In<"set_module_size">
      const m = findModule(comp, i.module)
      if (i.width === undefined && i.height === undefined && i.depth === undefined) fail("Cal almenys una mida (width, height o depth).")
      const c = { ...m.carcass, ...(i.width !== undefined ? { width: i.width } : {}), ...(i.height !== undefined ? { height: i.height } : {}), ...(i.depth !== undefined ? { depth: i.depth } : {}) }
      return { comp: replaceModule(comp, { ...m, carcass: c }), result: { module_id: m.id, width: c.width, height: c.height, depth: c.depth } }
    }
    case "set_module_position": {
      const i = input as In<"set_module_position">
      let m = findModule(comp, i.module)
      const idx = comp.modules.indexOf(m)
      if (i.mount && i.mount !== (m.carcass.base.kind === "wall" ? "hung" : m.wallGap !== undefined ? "floor" : "wall")) {
        const here = Math.round(buildComposition(comp).modules[idx]?.x ?? 0)
        m = setModuleMount(m, i.mount, here, i.floor_height)
      }
      if (i.floor_height !== undefined) {
        if (m.carcass.base.kind !== "wall") fail("floor_height només és per als mòduls penjats (mount=hung).")
        m = { ...m, carcass: { ...m.carcass, base: { kind: "wall", height: i.floor_height } } }
      }
      if (i.wall_gap !== undefined || i.x !== undefined) {
        if (m.wallGap === undefined || m.carcass.base.kind === "wall") fail("wall_gap i x només són per als mòduls lliures al terra (mount=floor).")
        m = { ...m, ...(i.wall_gap !== undefined ? { wallGap: i.wall_gap } : {}), ...(i.x !== undefined ? { x: i.x } : {}) }
      }
      if (i.gap_before !== undefined) {
        if (m.x !== undefined && m.wallGap !== undefined && m.carcass.base.kind !== "wall") fail("Un mòdul lliure al terra no és a la fila: fes servir x.")
        m = { ...m, gapBefore: i.gap_before }
      }
      return { comp: replaceModule(comp, m), result: { module_id: m.id } }
    }
    case "set_carcass": {
      const i = input as In<"set_carcass">
      const m = findModule(comp, i.module)
      const c = { ...m.carcass }
      if (i.base) {
        if (c.base.kind === "wall") fail("El mòdul és penjat: no té base de terra. Primer set_module_position mount=wall o floor.")
        c.base = i.base.kind === "legs" ? { kind: "legs", height: i.base.height } : i.base.kind === "plinth" ? { kind: "plinth", height: i.base.height, setback: i.base.setback } : { kind: i.base.kind }
      }
      if (i.back) {
        c.back = i.back
        // Encastat amb un fons prim: com la UI, el del cos (calen ≥ 15 mm per a les espigues).
        if (i.back === "inset" && c.backThickness < 15) {
          c.backMaterial = c.material
          c.backThickness = c.thickness
        }
      }
      if (i.top) c.top = typeof i.top === "string" ? { kind: i.top } : { kind: "ventSlot", gap: i.top.gap }
      if (i.sides) c.sides = i.sides
      if (i.joint) {
        if (i.joint === "mitre") c.joint = "mitre"
        else delete c.joint
      }
      const fronts = i.front_style ? { ...m.fronts, style: i.front_style } : m.fronts
      return { comp: replaceModule(comp, { ...m, carcass: c, fronts }), result: { module_id: m.id } }
    }
    case "split_zone": {
      const i = input as In<"split_zone">
      const m = findModule(comp, i.module)
      const z = findZoneIn(m, i.zone)
      if (z.split) fail(`${zoneName(m, z)} ja és dividit (${z.split.children.length} zones). Canvia'n les mides amb set_zone_size, divideix una de les zones o treu la divisió amb unsplit_zone.`)
      const b = zoneBounds(m, z.id)
      const dirs = b ? splitDirsFor(b) : []
      if (!dirs.includes(i.dir))
        fail(`${zoneName(m, z)} no es pot dividir en ${i.dir === "v" ? "vertical (el divisor s'uneix a sota i a sobre)" : "horitzontal (el travesser s'uneix a esquerra i dreta)"}: hi falta ${i.dir === "v" ? "una peça a sota o a sobre" : "un lateral o un divisor a un costat"}. ${dirs.length ? `Es pot en: ${dirs.join(", ")}.` : "Afegeix laterals, base o tapa amb set_carcass."}`)
      if (i.sizes && i.sizes.length > i.n - 1) fail(`Amb ${i.n} zones es posen com a molt ${i.n - 1} mides: l'última és el que sobra.`)
      let root = splitZone(m.root, z.id, i.dir, i.n)
      const split = findZone(root, z.id)!.split!
      const sizes = [...split.children.map((_, k) => (k < i.n - 1 ? (i.sizes?.[k] ?? "auto") : "auto"))]
      root = updateSizes(root, z.id, sizes)
      const children = findZone(root, z.id)!.split!.children.map((c) => c.id)
      return { comp: replaceModule(comp, { ...m, root }), result: { module_id: m.id, zone: z.id, children } }
    }
    case "unsplit_zone": {
      const i = input as In<"unsplit_zone">
      const m = findModule(comp, i.module)
      const z = findZoneIn(m, i.zone)
      if (!z.split) fail(`${zoneName(m, z)} no és dividit.`)
      return { comp: replaceModule(comp, { ...m, root: unsplitZone(m.root, z.id) }), result: { module_id: m.id, zone: z.id } }
    }
    case "set_zone_size": {
      const i = input as In<"set_zone_size">
      const m = findModule(comp, i.module)
      const z = findZoneIn(m, i.zone)
      const parent = parentOf(m.root, z.id)
      if (!parent?.split) fail(`${zoneName(m, z)} no és dins de cap divisió: la seva mida és la del mòdul (set_module_size).`)
      const index = parent!.split!.children.findIndex((c) => c.id === z.id)
      if (index === parent!.split!.children.length - 1) fail(`És l'última zona de la divisió: la seva mida és el que sobra. Canvia la de les altres zones.`)
      const mb = buildComposition(comp).modules[comp.modules.indexOf(m)]?.build
      const current = mb ? splitChildSizes(mb.layout, parent!) : undefined
      const root = setSplitSize(m.root, parent!.id, index, i.size, current)
      return { comp: replaceModule(comp, { ...m, root }), result: { module_id: m.id, zone: z.id, size: i.size } }
    }
    case "set_front":
      return setFrontTool(comp, input as In<"set_front">, ctx)
    case "set_shelves": {
      const i = input as In<"set_shelves">
      const m = findModule(comp, i.module)
      const z = findZoneIn(m, i.zone)
      if (z.split) fail(`${zoneName(m, z)} és dividit: posa els prestatges a una de les seves zones.`)
      const b = zoneBounds(m, z.id)
      if (i.n > 0 && b && !canHoldShelves(b)) fail(`${zoneName(m, z)} no pot portar prestatges: cal un lateral o un divisor a cada costat (set_carcass sides).`)
      if (i.n > 0 && (z.front?.kind === "drawers" || z.front?.kind === "panel")) fail(`${zoneName(m, z)} té ${z.front.kind === "drawers" ? "calaixos" : "un front fix"}: no hi van prestatges. Canvia el contingut (set_front) o divideix-lo.`)
      const shelves = { ...(z.shelves ?? { adjustable: true }), n: i.n, ...(i.adjustable !== undefined ? { adjustable: i.adjustable } : {}) }
      return { comp: replaceModule(comp, { ...m, root: setShelves(m.root, z.id, shelves) }), result: { module_id: m.id, zone: z.id, shelves: { n: shelves.n, adjustable: shelves.adjustable } } }
    }
    case "set_material": {
      const i = input as In<"set_material">
      const targets = i.module ? [findModule(comp, i.module)] : comp.modules
      if (!targets.length) fail("No hi ha cap mòdul.")
      if (!i.body && i.thickness === undefined && !i.fronts && !i.back && i.back_thickness === undefined) fail("Cal algun material o gruix.")
      const body = i.body ? pickMaterial(ctx.settings, i.body, "board") : undefined
      const fronts = i.fronts && i.fronts !== "same" ? pickMaterial(ctx.settings, i.fronts, "board") : undefined
      const back = i.back && i.back !== "same" ? pickMaterial(ctx.settings, i.back, "back") : undefined
      let next = comp
      for (const m of targets) {
        const c = { ...m.carcass }
        const sameBack = c.backMaterial === c.material && c.backThickness === c.thickness
        if (body) {
          c.material = body.name
          c.thickness = body.thicknesses.includes(c.thickness) ? c.thickness : nearest(body.thicknesses, c.thickness)
        }
        if (i.thickness !== undefined) {
          const list = materialByName(ctx.settings as Settings, c.material)?.thicknesses
          if (list && !list.includes(i.thickness)) fail(`«${c.material}» no té gruix de ${i.thickness} mm (en té ${list.join(", ")}).`)
          c.thickness = i.thickness
        }
        if (i.fronts === "same") delete c.frontMaterial
        else if (fronts) c.frontMaterial = fronts.name
        if (i.back === "same" || (sameBack && !back && (body || i.thickness !== undefined))) {
          c.backMaterial = c.material
          c.backThickness = c.thickness
        } else if (back) {
          c.backMaterial = back.name
          c.backThickness = back.thicknesses.includes(c.backThickness) ? c.backThickness : nearest(back.thicknesses, c.backThickness)
        }
        if (i.back_thickness !== undefined) {
          const list = materialByName(ctx.settings as Settings, c.backMaterial)?.thicknesses
          if (list && !list.includes(i.back_thickness)) fail(`«${c.backMaterial}» no té gruix de ${i.back_thickness} mm (en té ${list.join(", ")}).`)
          c.backThickness = i.back_thickness
        }
        next = replaceModule(next, { ...m, carcass: c })
      }
      return { comp: next, result: { modules: targets.map((m) => m.id) } }
    }
  }
}

function updateSizes(root: Zone, id: string, sizes: (number | "auto")[]): Zone {
  const walk = (z: Zone): Zone => (z.id === id && z.split ? { ...z, split: { ...z.split, sizes } } : z.split ? { ...z, split: { ...z.split, children: z.split.children.map(walk) } } : z)
  return walk(root)
}

function setFrontTool(comp: Composition, i: In<"set_front">, ctx: ToolContext): { comp: Composition; result: Record<string, unknown> } {
  const m = findModule(comp, i.module)
  const z = findZoneIn(m, i.zone)
  const isRoot = z.id === m.root.id
  if (z.split && !(isRoot && (i.kind === "door" || i.kind === "none")))
    fail(isRoot ? `L'Interior de «${m.name}» és dividit: només hi van portes de dalt a baix (kind door) o cap. Els altres fronts van a les seves zones.` : `${zoneName(m, z)} és dividit: el front va a cadascuna de les seves zones.`)
  const b = zoneBounds(m, z.id)
  if (b && !canHoldFront(b, i.kind)) fail(`${zoneName(m, z)} no aguanta aquest front: els fronts només es fan amb el compartiment aguantat pels quatre costats (lateral o divisor a esquerra i dreta, peça a sota i a sobre)${i.kind === "drawers" ? " i els calaixos necessiten un lateral o divisor a cada costat" : ""}. Afegeix laterals, base o tapa (set_carcass) o divideix el de més amunt.`)
  if (!isRoot && i.kind !== "none" && coveringZone(visibleModule(m).root, z.id)) fail(`${zoneName(m, z)} queda tapat per les portes de tot el mòdul: el seu front no es faria. Treu-les (set_front a l'Interior amb kind none) o deixa'l obert.`)
  let root = switchFront(m.root, z.id, i.kind)
  let f = findZone(root, z.id)?.front
  if (f) {
    let next: Front = { ...f }
    if (next.kind === "door") {
      if (i.door?.mode) next.mode = i.door.mode
      if (next.mode === "double" && b && !(b.left && b.right)) fail("Dues portes necessiten un lateral o divisor a cada costat (frontisses als dos costats).")
      if (i.door?.hinge) next.hinge = i.door.hinge
      else if (next.mode === "single" && b && !b[next.hinge]) next.hinge = next.hinge === "left" ? "right" : "left"
      if (next.mode === "single" && b && !b[next.hinge]) fail(`No hi ha cap lateral ni divisor a la ${next.hinge === "left" ? "esquerra" : "dreta"} per a les frontisses.`)
      if (i.door?.glass !== undefined) {
        if (i.door.glass) next.glass = true
        else delete next.glass
      }
    } else if (next.kind === "drawers") {
      const n = i.drawers?.n ?? next.n
      const given = i.drawers?.heights
      if (given && given.length > n) fail(`Hi ha ${given.length} alçades per a ${n} calaixos.`)
      next = { ...next, n, heights: Array.from({ length: n }, (_, k) => given?.[k] ?? (given ? "auto" : (next as Extract<Front, { kind: "drawers" }>).heights[k] ?? "auto")) }
      const kit = i.drawers?.kit
      if (kit === "none") delete next.hardware
      else if (kit) {
        const item = ctx.settings.hardwareLibrary.find((x) => x.engine === "drawerKit" && (x.id === kit || x.name === kit || x.name.toLowerCase() === kit.toLowerCase()))
        if (!item) fail(`No hi ha cap joc de calaix «${kit}». Jocs: ${ctx.settings.hardwareLibrary.filter((x) => x.engine === "drawerKit").map((x) => x.name).join(", ") || "cap"}.`)
        next.hardware = structuredClone(item!)
      }
    } else if (next.kind === "flap") {
      if (i.flap?.dir) next.dir = i.flap.dir
    }
    if (i.handle) {
      if (next.kind !== "door" && next.kind !== "drawers" && next.kind !== "flap") fail("Aquest front no porta tirador.")
      if (next.kind === "drawers" && next.hardware?.engine === "drawerKit") fail("Amb un joc de calaix, el tancament (push o suau) del joc mana: es tria a l'inspector del compartiment (Front › Joc).")
      if (i.handle === "none") next.handle = "none"
      else delete next.handle
    }
    root = setFront(root, z.id, next)
    f = next
  }
  return { comp: replaceModule(comp, { ...m, root }), result: { module_id: m.id, zone: z.id, front: f ? f.kind : "none" } }
}

/**
 * Resultat d'una eina per al model: el que ha fet, el resum del moble (amb el catàleg a `get_moble`) i els **avisos de
 * fusteria nous** (comparats amb els d'abans del canvi), perquè es corregeixi.
 */
interface ToolPayload {
  done?: Record<string, unknown>
  new_warnings?: WarningSummary[]
  moble: MobleSummary
  catalog?: CatalogSummary
}

export function toolResultPayload(name: string, before: Composition, outcome: Extract<ToolOutcome, { ok: true }>, ctx: ToolContext): ToolPayload {
  const build = buildComposition(outcome.comp)
  const moble = summarizeMoble(outcome.comp, ctx.settings, build)
  if (name === "get_moble") return { moble, catalog: summarizeCatalog(ctx.settings) }
  const old = new Set(allWarnings(before, buildComposition(before), ctx.settings).map(warningKey))
  const now = allWarnings(outcome.comp, build, ctx.settings)
  const fresh = moble.warnings.filter((_, k) => !old.has(warningKey(now[k]!)))
  return { done: outcome.result, new_warnings: fresh, moble }
}

/** Què ha fet una eina del moble, en una frase curta (UI del xat). */
function describeMobleTool(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case "get_moble":
      return "Ha mirat el moble"
    case "add_module":
      return `Mòdul afegit: ${String(result.name ?? "")}`
    case "remove_module":
      return `Mòdul eliminat: ${String(result.removed ?? "")}`
    case "rename_module":
      return `Nom: ${String(result.name ?? "")}`
    case "set_module_size":
      return `Mides: ${String(result.width)} × ${String(result.height)} × ${String(result.depth)} mm`
    case "set_module_position":
      return "Posició del mòdul"
    case "set_carcass":
      return "Caixa del mòdul"
    case "split_zone":
      return `Dividit en ${Array.isArray(result.children) ? result.children.length : "?"} zones`
    case "unsplit_zone":
      return "Divisió treta"
    case "set_zone_size":
      return `Mida de zona: ${String(result.size)}${typeof result.size === "number" ? " mm" : ""}`
    case "set_front":
      return `Front: ${FRONT_NAMES[String(result.front)] ?? String(result.front)}`
    case "set_shelves": {
      const s = result.shelves as { n?: number } | undefined
      return `Prestatges: ${s?.n ?? "?"}`
    }
    case "set_material":
      return "Materials"
    default:
      return name
  }
}

const FRONT_NAMES: Record<string, string> = { none: "obert", door: "porta", drawers: "calaixos", flap: "abatible", grille: "reixeta", panel: "front fix" }

/** El joc d'eines del moble per al xat (`chatTurn.ts`). */
export function mobleToolSet(ctx: ToolContext): AssistantToolSet<Composition> {
  return {
    system: ASSISTANT_SYSTEM_PROMPT,
    tools: assistantTools(),
    run: (doc, name, input) => {
      const r = runAssistantTool(doc, name, input, ctx)
      return r.ok ? { ok: true, doc: r.comp, result: r.result } : r
    },
    payload: (name, before, outcome) => toolResultPayload(name, before, { ok: true, comp: outcome.doc, result: outcome.result }, ctx),
    describe: (name, result, payload) => {
      const fresh = (payload as ToolPayload).new_warnings?.length ?? 0
      return `${describeMobleTool(name, result)}${fresh ? ` · ${fresh} avís${fresh === 1 ? "" : "os"} nou${fresh === 1 ? "" : "s"}` : ""}`
    },
  }
}
