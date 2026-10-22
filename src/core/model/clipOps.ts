import { z } from "zod"
import { anchorRef, freeX, ModelObjectSchema, ModuleSchema, newId, RefObjectSchema, rowOf, ZoneSchema, type Composition, type ModelObject, type Module, type RefObject, type Zone } from "./composition"
import { FreePartSchema, type FreePart } from "./freePart"
import { groupItems, groupNames, multiBox, type MultiItem } from "./editOps"
import { wallSides } from "./wallBacks"

/**
 * Uns quants elements copiats junts: un **grup sencer** (`group`, el seu nom: s'enganxa com un grup nou) o una selecció
 * múltiple (sense `group`). `dx`: quant es desplacen les còpies de les peces, els models, els objectes i les illes (l'ample
 * de la caixa de tots + 50 mm); els mòduls de fila van a continuació a la seva fila.
 */
export interface ItemsClip {
  group?: string
  dx: number
  modules: Module[]
  parts: FreePart[]
  models: ModelObject[]
  refs: RefObject[]
}

/** Porta-retalls de l'editor (mòdul, objecte, compartiment, peça lliure, model 3D, o un grup o una selecció múltiple). */
export type EditClip =
  | { kind: "module"; data: Module; label: string }
  | { kind: "ref"; data: RefObject; label: string }
  | { kind: "zone"; data: Zone; label: string }
  | { kind: "part"; data: FreePart; label: string }
  | { kind: "model"; data: ModelObject; label: string }
  | { kind: "items"; data: ItemsClip; label: string }

const ItemsClipSchema = z.object({
  group: z.string().optional(),
  dx: z.number(),
  modules: z.array(ModuleSchema),
  parts: z.array(FreePartSchema),
  models: z.array(ModelObjectSchema),
  refs: z.array(RefObjectSchema),
})

const ClipSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("module"), data: ModuleSchema, label: z.string() }),
  z.object({ kind: z.literal("ref"), data: RefObjectSchema, label: z.string() }),
  z.object({ kind: z.literal("zone"), data: ZoneSchema, label: z.string() }),
  z.object({ kind: z.literal("part"), data: FreePartSchema, label: z.string() }),
  z.object({ kind: z.literal("model"), data: ModelObjectSchema, label: z.string() }),
  z.object({ kind: z.literal("items"), data: ItemsClipSchema, label: z.string() }),
])

/**
 * Porta-retalls llegit de localStorage (pot ser d'una altra versió de l'app o estar malmès): validat amb els esquemes
 * del model. `null` si no ho és (no s'enganxa res que després no es podria desar).
 */
export function parseClip(raw: unknown): EditClip | null {
  const r = ClipSchema.safeParse(raw)
  return r.success ? (r.data as EditClip) : null
}

const has = (items: readonly MultiItem[], kind: MultiItem["kind"], id: string) => items.some((x) => x.kind === kind && x.id === id)

/** Copia els elements triats (en l'ordre del document). `group`: és un grup sencer (es tornarà a enganxar com a grup). */
export function copyItems(comp: Composition, items: readonly MultiItem[], group?: string): ItemsClip {
  const b = multiBox(comp, items)
  return structuredClone({
    ...(group ? { group } : {}),
    dx: b ? b.max[0] - b.min[0] + 50 : 50,
    modules: comp.modules.filter((m) => has(items, "module", m.id)),
    parts: (comp.parts ?? []).filter((p) => has(items, "part", p.id)),
    models: (comp.models ?? []).filter((m) => has(items, "model", m.id)),
    refs: comp.references.filter((r) => has(items, "ref", r.id)),
  })
}

/** Copia un grup sencer (mòduls, peces i models amb aquell nom de grup). */
export function copyGroup(comp: Composition, group: string): ItemsClip {
  return copyItems(comp, groupItems(comp, group), group)
}

/** Nom lliure per a la còpia d'un grup: «G (còpia)», «G (còpia 2)»… */
function copyGroupName(comp: Composition, group: string): string {
  const taken = new Set(groupNames(comp))
  let name = `${group} (còpia)`
  for (let n = 2; taken.has(name); n++) name = `${group} (còpia ${n})`
  return name
}

/**
 * Enganxa (o duplica) uns quants elements copiats junts. Les còpies tenen ids nous; les peces enganxades a un mòdul
 * copiat s'enganxen a la seva còpia (i no es desplacen: la segueixen); les enganxades a un mòdul que no hi és, soltes.
 * Els mòduls de fila van **a continuació a la seva fila**: després de `afterModule` si és de la fila, si no després de
 * l'últim original (duplicar) o al final de la fila; les illes, al costat (`dx`).
 *
 * Grup de les còpies: un grup copiat sencer (`clip.group`) fa **un grup nou** («G (còpia)»); si no, `group` diu on van:
 * `undefined` = cadascú al seu grup (duplicar), un nom = en aquell grup (enganxar dins d'un grup), `null` = sense grup.
 */
export function insertItemsCopy(
  comp: Composition,
  clip: ItemsClip,
  opts: { group?: string | null; afterModule?: string } = {},
): { comp: Composition; items: MultiItem[]; group?: string } {
  const newGroup = clip.group ? copyGroupName(comp, clip.group) : undefined
  const groupOf = <T extends { group?: string }>(x: T): T => {
    const { group: own, ...rest } = x
    const g = newGroup ?? (opts.group === undefined ? own : opts.group ?? undefined)
    return (g ? { ...rest, group: g } : rest) as T
  }
  const { dx } = clip
  const items: MultiItem[] = []
  const ids = new Map<string, string>()
  const modules = [...comp.modules]
  const srcIds = new Set(clip.modules.map((m) => m.id))
  const last: Partial<Record<"floor" | "wall", string>> = {}
  // La paret de cada original (`wallSides`): la còpia hi va al costat, a la mateixa paret (2026-10-22: «si fas un copiar i
  // enganxar pensa que està ben col·locat i el col·loca malament»).
  const sides = wallSides(comp)
  const sideOf = (id: string) => sides[comp.modules.findIndex((m) => m.id === id)] ?? null
  for (const src of clip.modules) {
    const side = freeX(src) ? null : sideOf(src.id)
    // A la paret d'un costat: la còpia, girada igual, a continuació al llarg d'aquella paret. A la del fons: tocant
    // l'original, i el següent de la fila no es mou (si hi cap).
    const place: Partial<Module> = side === "left" || side === "right" ? { rot: side === "left" ? 90 : 270, gapBefore: 0, sideAlong: (src.sideAlong ?? 0) + src.carcass.width } : side === "back" ? { gapBefore: 0 } : {}
    const copy: Module = { ...groupOf(structuredClone(src)), id: newId("m"), ...place, ...(freeX(src) ? { x: Math.round(src.x! + dx) } : {}) }
    ids.set(src.id, copy.id)
    items.push({ kind: "module", id: copy.id })
    if (freeX(src)) {
      const i = modules.findIndex((m) => m.id === src.id)
      modules.splice(i >= 0 ? i + 1 : modules.length, 0, copy)
      continue
    }
    const row = rowOf(src)
    const inRow = (m: Module) => rowOf(m) === row && !freeX(m)
    let at = last[row] ? modules.findIndex((m) => m.id === last[row]) : -1
    if (at < 0) at = modules.findIndex((m) => m.id === opts.afterModule && inRow(m))
    if (at < 0) at = modules.findLastIndex((m) => srcIds.has(m.id) && inRow(m))
    if (at < 0) at = modules.findLastIndex(inRow)
    modules.splice(at >= 0 ? at + 1 : modules.length, 0, copy)
    last[row] = copy.id
    if (side === "back") {
      const next = modules.findIndex((m, k) => k > at + 1 && inRow(m))
      if (next >= 0) modules[next] = { ...modules[next]!, gapBefore: Math.max(0, modules[next]!.gapBefore - copy.carcass.width) }
    }
  }
  const parts = clip.parts.map((src) => {
    const { module: mod, ...rest } = groupOf(structuredClone(src))
    const copied = mod ? ids.get(mod) : undefined
    const keep = !!mod && comp.modules.some((m) => m.id === mod)
    const p: FreePart = { ...rest, id: newId("p"), ...(copied ? { module: copied } : keep ? { module: mod, x: src.x + dx } : { x: src.x + dx }) }
    items.push({ kind: "part", id: p.id })
    return p
  })
  const models = clip.models.map((src) => {
    const m: ModelObject = { ...groupOf(structuredClone(src)), id: newId("g"), x: src.x + dx }
    items.push({ kind: "model", id: m.id })
    return m
  })
  const refs = clip.refs.map((src) => {
    const r: RefObject = anchorRef({ ...groupOf(structuredClone(src)), id: newId("r"), x: src.x + dx })
    items.push({ kind: "ref", id: r.id })
    return r
  })
  return {
    comp: {
      ...comp,
      modules,
      ...(parts.length ? { parts: [...(comp.parts ?? []), ...parts] } : {}),
      ...(models.length ? { models: [...(comp.models ?? []), ...models] } : {}),
      ...(refs.length ? { references: [...comp.references, ...refs] } : {}),
    },
    items,
    ...(newGroup ? { group: newGroup } : {}),
  }
}

/** Duplica un grup sencer al costat (nom nou): els seus mòduls (a continuació a la fila), peces i models. */
export function duplicateGroup(comp: Composition, group: string): { comp: Composition; group: string } {
  const r = insertItemsCopy(comp, copyGroup(comp, group))
  return { comp: r.comp, group: r.group ?? copyGroupName(comp, group) }
}

/**
 * **Afegir un moble fet com a mòduls** (per decisió de l'usuari, 2026-10-21: «al fer mòdul nou, de zero o seleccionar de
 * mòduls ja fets com als ambients»): els mòduls, les peces lliures i els models d'un altre moble (una plantilla del
 * catàleg, un moble teu…) s'afegeixen a aquest, com en enganxar-los: els de fila a continuació a la seva fila, els lliures
 * a la dreta de tot el que ja hi ha. Si en són més d'un, en un grup amb el nom del moble (`name`). Els objectes de
 * referència, el taulell i el sòcol de la cuina del moble triat no hi entren (són del lloc on era).
 */
export function addCompositionModules(comp: Composition, src: Composition, name: string): { comp: Composition; items: MultiItem[] } {
  const all: MultiItem[] = [
    ...comp.modules.map((m) => ({ kind: "module" as const, id: m.id })),
    ...(comp.parts ?? []).map((p) => ({ kind: "part" as const, id: p.id })),
    ...(comp.models ?? []).map((m) => ({ kind: "model" as const, id: m.id })),
  ]
  const here = multiBox(comp, all)
  const there = multiBox(src, [
    ...src.modules.map((m) => ({ kind: "module" as const, id: m.id })),
    ...(src.parts ?? []).map((p) => ({ kind: "part" as const, id: p.id })),
    ...(src.models ?? []).map((m) => ({ kind: "model" as const, id: m.id })),
  ])
  const dx = here && there ? Math.round(here.max[0] + 300 - there.min[0]) : 0
  const clip: ItemsClip = structuredClone({ dx, modules: src.modules, parts: src.parts ?? [], models: src.models ?? [], refs: [] })
  const many = clip.modules.length + clip.parts.length + clip.models.length > 1
  const taken = new Set(groupNames(comp))
  let group = name.trim() || "Moble"
  for (let n = 2; many && taken.has(group); n++) group = `${name.trim() || "Moble"} (${n})`
  const r = insertItemsCopy(comp, clip, { group: many ? group : null })
  // Els mòduls enganxats a un altre (`anchor`): al de la seva còpia; si no hi és, solts.
  const ids = new Map(clip.modules.map((m, i) => [m.id, r.items.filter((x) => x.kind === "module")[i]!.id]))
  const added = new Set(ids.values())
  const modules = r.comp.modules.map((m) => {
    if (!added.has(m.id) || !m.anchor) return m
    const to = ids.get(m.anchor.module)
    if (to) return { ...m, anchor: { ...m.anchor, module: to } }
    const { anchor: _a, ...rest } = m
    return rest
  })
  return { comp: { ...r.comp, modules }, items: r.items }
}
