import { z } from "zod"
import {
  freeX,
  ModelObjectSchema,
  ModuleSchema,
  newId,
  partOffset,
  RefObjectSchema,
  resolveParts,
  rowOf,
  ZoneSchema,
  type Composition,
  type ModelObject,
  type Module,
  type RefObject,
  type Run,
  type Zone,
} from "./composition"
import { cloneZone, removeZone, updateZone } from "./zoneOps"
import { FreePartSchema, partSize, partsBox, type FreePart } from "./freePart"

/** Porta-retalls de l'editor (mòdul, objecte, compartiment, peça lliure o model 3D). */
export type EditClip =
  | { kind: "module"; data: Module; label: string }
  | { kind: "ref"; data: RefObject; label: string }
  | { kind: "zone"; data: Zone; label: string }
  | { kind: "part"; data: FreePart; label: string }
  | { kind: "model"; data: ModelObject; label: string }

const ClipSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("module"), data: ModuleSchema, label: z.string() }),
  z.object({ kind: z.literal("ref"), data: RefObjectSchema, label: z.string() }),
  z.object({ kind: z.literal("zone"), data: ZoneSchema, label: z.string() }),
  z.object({ kind: z.literal("part"), data: FreePartSchema, label: z.string() }),
  z.object({ kind: z.literal("model"), data: ModelObjectSchema, label: z.string() }),
])

/**
 * Porta-retalls llegit de localStorage (pot ser d'una altra versió de l'app o estar malmès): validat amb els esquemes
 * del model. `null` si no ho és (no s'enganxa res que després no es podria desar).
 */
export function parseClip(raw: unknown): EditClip | null {
  const r = ClipSchema.safeParse(raw)
  return r.success ? (r.data as EditClip) : null
}

/**
 * Còpia d'un mòdul just després de `afterId` (o al final). Una illa («Al terra» amb X pròpia) es posa al costat de
 * l'original (amplada + 20 mm), no a sobre.
 */
export function insertModuleCopy(comp: Composition, src: Module, afterId?: string): { comp: Composition; id: string } {
  const copy: Module = {
    ...structuredClone(src),
    id: newId("m"),
    name: src.name.endsWith("(còpia)") ? src.name : `${src.name} (còpia)`,
    ...(freeX(src) ? { x: Math.round(src.x! + src.carcass.width + 20) } : {}),
  }
  const modules = [...comp.modules]
  const i = afterId ? modules.findIndex((m) => m.id === afterId) : -1
  modules.splice(i >= 0 ? i + 1 : modules.length, 0, copy)
  return { comp: { ...comp, modules }, id: copy.id }
}

/** Còpia d'un objecte de referència, posada just a la dreta de l'original. */
export function insertRefCopy(comp: Composition, src: RefObject): { comp: Composition; id: string } {
  const copy: RefObject = { ...structuredClone(src), id: newId("r"), name: src.name.endsWith("(còpia)") ? src.name : `${src.name} (còpia)`, x: src.x + src.w }
  return { comp: { ...comp, references: [...comp.references, copy] }, id: copy.id }
}

/** Enganxa el contingut d'una zona copiada a la zona `targetId` (conserva la seva mida). */
export function pasteZone(root: Zone, targetId: string, src: Zone): Zone {
  return updateZone(root, targetId, () => ({ ...cloneZone(src), id: targetId }))
}

/** Treu una zona: si és dins d'una divisió, la divisió es refà; si és l'arrel, es buida. */
export function deleteZone(root: Zone, id: string): Zone {
  if (id === root.id) return { id: root.id }
  return removeZone(root, id)
}

/**
 * Mou un mòdul `dx` mm a la seva fila (i `dy` mm si és penjat: alçada del terra). Els
 * mòduls de la dreta es queden on eren (el següent perd la separació que aquest guanya).
 */
export function moveModuleBy(comp: Composition, id: string, dx: number, dy = 0, dz = 0): Composition {
  const i = comp.modules.findIndex((m) => m.id === id)
  if (i < 0) return comp
  const m = comp.modules[i]!
  // Al terra amb X pròpia: només ell es mou (de costat i endavant/enrere).
  if (freeX(m)) {
    const modules = comp.modules.map((x, k) => (k === i ? { ...x, x: Math.round(x.x! + dx), wallGap: Math.max(0, Math.round((x.wallGap ?? 0) + dz)) } : x))
    return { ...comp, modules }
  }
  const row = rowOf(m)
  const gap = Math.max(0, Math.round(m.gapBefore + dx))
  const actual = gap - m.gapBefore
  // El veí de la dreta és el següent de la fila: les illes (X pròpia) no en formen part.
  const j = comp.modules.findIndex((x, k) => k > i && rowOf(x) === row && !freeX(x))
  const modules = comp.modules.map((x, k) => {
    if (k === i) {
      const base = x.carcass.base.kind === "wall" && dy ? { ...x.carcass.base, height: Math.max(0, Math.round(x.carcass.base.height + dy)) } : x.carcass.base
      const wallGap = x.wallGap !== undefined && x.carcass.base.kind !== "wall" ? Math.max(0, Math.round(x.wallGap + dz)) : x.wallGap
      return { ...x, gapBefore: gap, ...(wallGap !== undefined ? { wallGap } : {}), carcass: { ...x.carcass, base } }
    }
    if (k === j) return { ...x, gapBefore: Math.max(0, x.gapBefore - actual) }
    return x
  })
  return { ...comp, modules }
}

/**
 * Mou tot el moble `dx` mm respecte a l'habitació. Com que el moble comença a x = 0, si va
 * més a l'esquerra del que permeten les separacions inicials, són els objectes els que es
 * mouen a la dreta (el resultat és el mateix).
 */
export function moveAllBy(comp: Composition, dx: number): Composition {
  const firsts = new Map<string, number>()
  comp.modules.forEach((m, k) => {
    const row = rowOf(m)
    if (!freeX(m) && !firsts.has(row)) firsts.set(row, k)
  })
  const minGap = Math.min(...[...firsts.values()].map((k) => comp.modules[k]!.gapBefore))
  const applied = Math.max(dx, -minGap)
  const rest = Math.round(applied - dx)
  const firstIdx = new Set(firsts.values())
  return {
    ...comp,
    modules: comp.modules.map((m, k) => (firstIdx.has(k) ? { ...m, gapBefore: Math.max(0, Math.round(m.gapBefore + applied)) } : freeX(m) ? { ...m, x: Math.round(m.x! + applied) } : m)),
    // Les peces lliures són del moble: es mouen amb ell. Les enganxades a un mòdul ja el segueixen (x relativa).
    ...(comp.parts ? { parts: comp.parts.map((p) => (p.module && comp.modules.some((m) => m.id === p.module) ? p : { ...p, x: p.x + applied })) } : {}),
    references: rest ? comp.references.map((r) => ({ ...r, x: r.x + rest })) : comp.references,
  }
}

/**
 * Arrossegar per ordenar: posa el mòdul `id` just abans (o després) de `targetId`. Només
 * dins de la mateixa fila (a terra / penjats); si són de files diferents no fa res.
 */
export function reorderModule(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  if (id === targetId) return comp
  const m = comp.modules.find((x) => x.id === id)
  const t = comp.modules.find((x) => x.id === targetId)
  if (!m || !t || rowOf(m) !== rowOf(t)) return comp
  const rest = comp.modules.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  return { ...comp, modules: [...rest.slice(0, at), m, ...rest.slice(at)] }
}

/** Arrossegar per ordenar els objectes de referència. */
export function reorderRef(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  if (id === targetId) return comp
  const r = comp.references.find((x) => x.id === id)
  const t = comp.references.find((x) => x.id === targetId)
  if (!r || !t) return comp
  const rest = comp.references.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  return { ...comp, references: [...rest.slice(0, at), r, ...rest.slice(at)] }
}

/**
 * Còpia d'una peça lliure al costat (desplaçada el seu ample en X). Si estava enganxada a un mòdul que no és d'aquest
 * moble (enganxada en un altre), queda solta.
 */
export function insertPartCopy(comp: Composition, src: FreePart): { comp: Composition; id: string } {
  const { module: mod, ...rest } = structuredClone(src)
  const keep = !!mod && comp.modules.some((m) => m.id === mod)
  const copy: FreePart = { ...rest, ...(keep ? { module: mod } : {}), id: newId("p"), name: src.name.endsWith("(còpia)") ? src.name : `${src.name} (còpia)`, x: src.x + partSize(src)[0] + 20 }
  return { comp: { ...comp, parts: [...(comp.parts ?? []), copy] }, id: copy.id }
}

/** Còpia d'un model 3D, posada just a la dreta de l'original. */
export function insertModelCopy(comp: Composition, src: ModelObject): { comp: Composition; id: string } {
  const copy: ModelObject = { ...structuredClone(src), id: newId("g"), name: src.name.endsWith("(còpia)") ? src.name : `${src.name} (còpia)`, x: src.x + src.w + 20 }
  return { comp: { ...comp, models: [...(comp.models ?? []), copy] }, id: copy.id }
}

/** Mou la peça lliure `id` just abans (o després) de `targetId`. */
export function reorderPart(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  const list = comp.parts ?? []
  const r = list.find((x) => x.id === id)
  const t = list.find((x) => x.id === targetId)
  if (!r || !t || id === targetId) return comp
  const rest = list.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  // Deixada al costat d'una peça, n'agafa el grup (entra al grup, en surt o canvia de grup).
  const { group: _g, ...plain } = r
  void _g
  const moved = t.group ? { ...plain, group: t.group } : plain
  return { ...comp, parts: [...rest.slice(0, at), moved, ...rest.slice(at)] }
}

/** Treu una peça del seu grup (arrossegada a «Treure del grup»): queda solta, al final. */
export function removePartFromGroup(comp: Composition, id: string): Composition {
  const list = comp.parts ?? []
  const r = list.find((x) => x.id === id)
  if (!r || !r.group) return comp
  const { group: _g, ...plain } = r
  void _g
  return { ...comp, parts: [...list.filter((x) => x.id !== id), plain] }
}

/** Posa una peça dins d'un grup (arrossegada sobre la fila del grup): va darrere de l'última. */
export function movePartToGroup(comp: Composition, id: string, group: string): Composition {
  const list = comp.parts ?? []
  const r = list.find((x) => x.id === id)
  if (!r) return comp
  const rest = list.filter((x) => x.id !== id)
  let at = rest.length
  for (let i = rest.length - 1; i >= 0; i--) if (rest[i]!.group === group) { at = i + 1; break }
  return { ...comp, parts: [...rest.slice(0, at), { ...r, group }, ...rest.slice(at)] }
}

/** Mou totes les peces d'un grup (mm). No deixa que cap quedi sota terra. */
export function moveGroupBy(comp: Composition, group: string, dx: number, dy: number, dz: number): Composition {
  const members = (comp.parts ?? []).filter((p) => p.group === group)
  if (!members.length) return comp
  const minY = partsBox(resolveParts(comp).filter((p) => p.group === group)).min[1]
  const ddy = Math.max(dy, -minY)
  return { ...comp, parts: (comp.parts ?? []).map((p) => (p.group === group ? { ...p, x: p.x + dx, y: p.y + ddy, z: p.z + dz } : p)) }
}

/** Duplica un grup sencer al costat (nom nou). */
export function duplicateGroup(comp: Composition, group: string): { comp: Composition; group: string } {
  const members = (comp.parts ?? []).filter((p) => p.group === group)
  // La caixa en coordenades de la composició (les enganxades a un mòdul són relatives a ell).
  const b = partsBox(resolveParts(comp).filter((p) => p.group === group))
  const taken = new Set((comp.parts ?? []).map((p) => p.group))
  let name = `${group} (còpia)`
  for (let n = 2; taken.has(name); n++) name = `${group} (còpia ${n})`
  const dx = b.max[0] - b.min[0] + 50
  const copies = members.map((p) => ({ ...structuredClone(p), id: newId("p"), group: name, x: p.x + dx }))
  return { comp: { ...comp, parts: [...(comp.parts ?? []), ...copies] }, group: name }
}

/** Nom lliure per a un grup nou («Grup 1», «Grup 2»…). */
export function newGroupName(comp: Composition): string {
  const taken = new Set((comp.parts ?? []).map((p) => p.group))
  let n = 1
  while (taken.has(`Grup ${n}`)) n++
  return `Grup ${n}`
}

/**
 * Treu un mòdul i el que en depèn: les peces lliures enganxades (`module`) passen a coordenades de la composició i
 * queden soltes (no es mouen); el taulell i el sòcol que hi començaven o hi acabaven passen al mòdul de la fila més
 * proper dins del seu tram (si no en queda cap, es treuen); els forats del taulell centrats en aquest mòdul es treuen.
 * `notes`: el que s'ha tret (per avisar).
 */
export function removeModule(comp: Composition, id: string): { comp: Composition; notes: string[] } {
  const idx = comp.modules.findIndex((m) => m.id === id)
  if (idx < 0) return { comp, notes: [] }
  const notes: string[] = []
  const modules = comp.modules.filter((m) => m.id !== id)
  const parts = comp.parts?.map((p) => {
    if (p.module !== id) return p
    const o = partOffset(comp, p)
    const { module: _m, ...rest } = p
    void _m
    return { ...rest, x: p.x + o[0], y: p.y + o[1], z: p.z + o[2] }
  })
  const runName = (r: Run) => (r.kind === "worktop" ? "taulell" : "sòcol")
  const runs: Run[] = []
  for (const r of comp.runs ?? []) {
    let run = r
    if (r.from === id || r.to === id) {
      const a0 = comp.modules.findIndex((m) => m.id === r.from)
      const b0 = comp.modules.findIndex((m) => m.id === r.to)
      const [a, b] = a0 <= b0 ? [a0, b0] : [b0, a0]
      // Mòduls de la fila (a terra, sense X pròpia) que queden dins del tram, ordenats pel més proper al que es treu.
      const near = comp.modules
        .map((m, k) => ({ m, k }))
        .filter(({ m, k }) => k >= a && k <= b && m.id !== id && m.carcass.base.kind !== "wall" && !freeX(m))
        .sort((p, q) => Math.abs(p.k - idx) - Math.abs(q.k - idx))
      if (a0 < 0 || b0 < 0 || !near.length) {
        notes.push(`S'ha tret el ${runName(r)} corregut (no li queda cap mòdul).`)
        continue
      }
      const to = near[0]!.m.id
      run = { ...r, ...(r.from === id ? { from: to } : {}), ...(r.to === id ? { to } : {}) }
    }
    if (run.kind === "worktop" && run.cutouts.some((c) => c.module === id)) {
      const n = run.cutouts.filter((c) => c.module === id).length
      notes.push(n === 1 ? "S'ha tret un forat del taulell (era sobre aquest mòdul)." : `S'han tret ${n} forats del taulell (eren sobre aquest mòdul).`)
      run = { ...run, cutouts: run.cutouts.filter((c) => c.module !== id) }
    }
    runs.push(run)
  }
  return {
    comp: { ...comp, modules, ...(parts ? { parts } : {}), ...(comp.runs ? { runs } : {}) },
    notes,
  }
}
