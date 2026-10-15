import { z } from "zod"
import { anchorRef, freeX, ModelObjectSchema, ModuleSchema, newId, RefObjectSchema, rowOf, ZoneSchema, type Composition, type ModelObject, type Module, type RefObject, type Zone } from "./composition"
import { FreePartSchema, type FreePart } from "./freePart"
import { groupItems, groupNames, multiBox, type MultiItem } from "./editOps"

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
 * Els objectes de referència no fan grups.
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
  for (const src of clip.modules) {
    const copy: Module = { ...groupOf(structuredClone(src)), id: newId("m"), ...(freeX(src) ? { x: Math.round(src.x! + dx) } : {}) }
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
    const r: RefObject = anchorRef({ ...structuredClone(src), id: newId("r"), x: src.x + dx })
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
