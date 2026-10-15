import { z } from "zod"
import { newId, type Composition, type Module, type Zone } from "./composition"
import { AmbientItemSchema, type Ambient, type AmbientItem, type PlanPt } from "./ambientSchema"
import { floorArea, rad, wallLength, wallPoints } from "./ambientGeometry"

/**
 * Ambients (vegeu `ambientSchema.ts`): els esquemes i la lectura a `ambientSchema.ts`, els blocs i les plantilles
 * d'objectes a `ambientObjects.ts` i la geometria del plànol (parets, obertures, imant) a `ambientGeometry.ts`. Aquí,
 * les operacions sobre l'ambient: mides d'un moble, grups, selecció múltiple, porta-retalls, resum i teulada.
 */
export * from "./ambientSchema"
export * from "./ambientObjects"
export * from "./ambientGeometry"

// --- Mides generals d'un moble ------------------------------------------------------------

/**
 * Canvia les mides generals d'un moble (ample, alt, fons) escalant-ne la distribució: amplades
 * i separacions dels mòduls, alçades (també potes, sòcol i alçada dels penjats), fondàries, les
 * mides fixes dels compartiments i calaixos, les peces lliures, els objectes i els models 3D. Els gruixos dels
 * taulers no canvien. `cur` és la mida actual (la caixa de les peces).
 */
export function resizeComposition(comp: Composition, cur: { w: number; h: number; d: number }, next: { w: number; h: number; d: number }): Composition {
  const sx = next.w / cur.w, sy = next.h / cur.h, sz = next.d / cur.d
  const r = (v: number) => Math.round(v)
  // Mides fixes escalades. Si totes ho són, ja no sumarien la llum nova (els gruixos dels divisors no s'escalen):
  // l'última passa a «auto» i agafa el que sobra.
  const scaled = (list: readonly (number | "auto")[], k: number, n: number): (number | "auto")[] => {
    const out = list.map((v) => (v === "auto" ? v : r(v * k)))
    while (out.length < n) out.push("auto")
    if (out.length && !out.includes("auto")) out[out.length - 1] = "auto"
    return out
  }
  const zone = (z: Zone): Zone => {
    const out: Zone = { ...z }
    if (z.split) out.split = { ...z.split, sizes: scaled(z.split.sizes, z.split.dir === "v" ? sx : sy, z.split.children.length), children: z.split.children.map(zone) }
    if (z.front?.kind === "drawers") out.front = { ...z.front, heights: scaled(z.front.heights, sy, z.front.heights.length) }
    return out
  }
  const base = (b: Module["carcass"]["base"]): Module["carcass"]["base"] =>
    b.kind === "legs" ? { ...b, height: r(b.height * sy) } : b.kind === "plinth" ? { ...b, height: r(b.height * sy) } : b.kind === "wall" ? { ...b, height: r(b.height * sy) } : b
  const modules = comp.modules.map((m) => ({
    ...m,
    carcass: { ...m.carcass, width: r(m.carcass.width * sx), height: r(m.carcass.height * sy), depth: r(m.carcass.depth * sz), base: base(m.carcass.base) },
    root: zone(m.root),
    ...(m.gapBefore ? { gapBefore: r(m.gapBefore * sx) } : {}),
    ...(m.x !== undefined ? { x: r(m.x * sx) } : {}),
    ...(m.wallGap !== undefined ? { wallGap: r(m.wallGap * sz) } : {}),
  }))
  const parts = comp.parts?.map((p) => {
    // Mides al seu pla: front x·y, side z·y, flat x·z; el gruix només si és una mida (potes).
    const [su, sv, st] = p.orient === "front" ? [sx, sy, sz] : p.orient === "side" ? [sz, sy, sx] : [sx, sz, sy]
    return { ...p, x: r(p.x * sx), y: r(p.y * sy), z: r(p.z * sz), w: r(p.w * su), h: r(p.h * sv), ...(p.thickness > 60 ? { thickness: r(p.thickness * st) } : {}) }
  })
  const references = comp.references.map((o) => ({ ...o, x: r(o.x * sx), y: r(o.y * sy), z: r(o.z * sz), w: r(o.w * sx), h: r(o.h * sy), d: r(o.d * sz) }))
  // Models 3D (plantes…): com els objectes.
  // Un model girat (gir de prop de 90° o 270°) té l'ample i la fondària creuats respecte del moble: l'Ample del moble li
  // canvia la fondària (si no, en un objecte de models girats l'Ample no canviava i semblava que no s'aplicava).
  const models = comp.models?.map((o) => {
    const th = ((o.rot ?? 0) * Math.PI) / 180
    const turned = Math.abs(Math.sin(th)) > Math.abs(Math.cos(th))
    const [kw, kd] = turned ? [sz, sx] : [sx, sz]
    return { ...o, x: r(o.x * sx), y: r(o.y * sy), z: r(o.z * sz), w: r(o.w * kw), h: r(o.h * sy), d: r(o.d * kd) }
  })
  const runs = comp.runs?.map((run) => (run.kind === "worktop" ? { ...run, cutouts: run.cutouts.map((c) => ({ ...c, dx: r(c.dx * sx) })) } : run))
  return { ...comp, modules, references, ...(parts ? { parts } : {}), ...(models ? { models } : {}), ...(runs ? { runs } : {}) }
}

// --- Grups d'elements (com les peces lliures de l'editor) -----------------------------------

/** Ids dels elements d'un grup. */
export const groupIds = (a: Ambient, group: string) => a.items.filter((i) => i.group === group).map((i) => i.id)

/** Nom de grup nou que no existeixi («Grup 1», «Grup 2»…). */
export function newItemGroupName(a: Ambient): string {
  const used = new Set([...a.items.map((i) => i.group), ...a.walls.map((w) => w.group)].filter(Boolean))
  let n = 1
  while (used.has(`Grup ${n}`)) n++
  return `Grup ${n}`
}

export function setItemGroup(a: Ambient, ids: string[], group: string | undefined): Ambient {
  return { ...a, items: a.items.map((i) => (ids.includes(i.id) ? { ...i, group } : i)) }
}

/**
 * Arrossegar a l'arbre (com les peces lliures de l'editor): l'element `id` va abans o després de `targetId` i n'agafa el
 * grup (entra al grup, en surt o canvia de grup). Un grup sencer (`ids` de més d'un) es mou junt i es queda el seu grup.
 */
export function reorderItems(a: Ambient, ids: string[], targetId: string, after: boolean): Ambient {
  const moving = a.items.filter((i) => ids.includes(i.id))
  const t = a.items.find((i) => i.id === targetId)
  if (!moving.length || !t || ids.includes(targetId)) return a
  const rest = a.items.filter((i) => !ids.includes(i.id))
  const at = rest.indexOf(t) + (after ? 1 : 0)
  const whole = moving.length > 1
  const moved = moving.map((i) => {
    if (whole) return i
    const { group: _g, ...plain } = i
    void _g
    return (t.group ? { ...plain, group: t.group } : plain) as AmbientItem
  })
  return { ...a, items: [...rest.slice(0, at), ...moved, ...rest.slice(at)] }
}

/** Posa un element dins d'un grup (arrossegat sobre la fila del grup): darrere de l'últim del grup. */
export function moveItemToGroup(a: Ambient, id: string, group: string): Ambient {
  const it = a.items.find((i) => i.id === id)
  if (!it) return a
  const rest = a.items.filter((i) => i.id !== id)
  let at = rest.length
  for (let i = rest.length - 1; i >= 0; i--) if (rest[i]!.group === group) { at = i + 1; break }
  return { ...a, items: [...rest.slice(0, at), { ...it, group }, ...rest.slice(at)] }
}

export function moveItems(a: Ambient, ids: string[], dx: number, dy: number): Ambient {
  return { ...a, items: a.items.map((i) => (ids.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)) }
}

/** Gira els elements `deg` graus al voltant del centre dels seus centres (el grup gira sencer). */
export function rotateItems(a: Ambient, ids: string[], deg: number): Ambient {
  const sel = a.items.filter((i) => ids.includes(i.id))
  if (!sel.length) return a
  const cx = (Math.min(...sel.map((i) => i.x)) + Math.max(...sel.map((i) => i.x))) / 2
  const cy = (Math.min(...sel.map((i) => i.y)) + Math.max(...sel.map((i) => i.y))) / 2
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg))
  return {
    ...a,
    items: a.items.map((i) => {
      if (!ids.includes(i.id)) return i
      const u = i.x - cx, v = i.y - cy
      return { ...i, x: Math.round(cx + u * c - v * s), y: Math.round(cy + u * s + v * c), rot: (((i.rot + deg) % 360) + 360) % 360 }
    }),
  }
}

/**
 * Duplica els elements (desplaçats). Un grup duplicat sencer fa un grup nou; si només se'n duplica una part (un element
 * d'un grup), la còpia es queda al mateix grup. `group`: el grup nou, si la còpia és un sol grup sencer.
 */
export function duplicateItems(a: Ambient, ids: string[], offset = 300): { ambient: Ambient; ids: string[]; group?: string } {
  const src = a.items.filter((i) => ids.includes(i.id))
  const renamed = new Map<string, string>()
  const used = new Set(a.items.map((i) => i.group).filter(Boolean))
  let n = 1
  for (const g of new Set(src.map((i) => i.group))) {
    if (!g || !a.items.every((i) => i.group !== g || ids.includes(i.id))) continue
    while (used.has(`Grup ${n}`)) n++
    renamed.set(g, `Grup ${n}`)
    used.add(`Grup ${n}`)
  }
  const copies = src.map((i) => ({ ...i, id: newId("i"), x: i.x + offset, y: i.y + offset, ...(i.group && renamed.has(i.group) ? { group: renamed.get(i.group) } : {}) }))
  const groups = new Set(copies.map((c) => c.group))
  const only = groups.size === 1 ? [...groups][0] : undefined
  const group = only && [...renamed.values()].includes(only) ? only : undefined
  return { ambient: { ...a, items: [...a.items, ...copies] }, ids: copies.map((c) => c.id), group }
}

/**
 * Torna a enllaçar els mobles i objectes de l'ambient (`projectId` → `map`): els que no hi són es treuen (no es deixa un
 * enllaç a un moble que no és el seu). Els blocs es queden. «Duplicar (per a un client)» (`duplicateAmbient`) i obrir un
 * `.ambient` (les còpies noves dels mobles del fitxer).
 */
export function remapMobleItems(a: Ambient, map: ReadonlyMap<number, number>): Ambient {
  return {
    ...a,
    items: a.items.flatMap((i): AmbientItem[] => {
      if (i.kind !== "moble") return [i]
      const to = map.get(i.projectId)
      return to === undefined ? [] : [{ ...i, projectId: to }]
    }),
  }
}

/** Mobles i objectes enllaçats (`projectId`), sense repetir, en l'ordre en què surten. */
export function linkedProjectIds(a: Ambient): number[] {
  return [...new Set(a.items.flatMap((i) => (i.kind === "moble" ? [i.projectId] : [])))]
}

export function removeItems(a: Ambient, ids: string[]): Ambient {
  return { ...a, items: a.items.filter((i) => !ids.includes(i.id)) }
}

/** Porta-retalls dels ambients (Ctrl/⌘ C · X · V): els elements copiats, validats en llegir-los (`parseAmbientClip`). */
export const AmbientClipSchema = z.object({ kind: z.literal("ambient-items"), items: z.array(AmbientItemSchema).min(1) })
export type AmbientClip = z.infer<typeof AmbientClipSchema>

export function parseAmbientClip(raw: unknown): AmbientClip | null {
  const r = AmbientClipSchema.safeParse(raw)
  return r.success ? r.data : null
}

/**
 * Enganxa elements copiats (d'aquest ambient o d'un altre): ids nous, desplaçats `offset` (0 = al mateix lloc). Els grups
 * fan com «Duplicar» (vegeu a sota); `group`: el grup, si tot el que s'enganxa és un sol grup.
 */
export function pasteItems(a: Ambient, items: AmbientItem[], offset: number): { ambient: Ambient; ids: string[]; group?: string } {
  const used = new Set(a.items.map((i) => i.group).filter(Boolean))
  const renamed = new Map<string, string>()
  let n = 1
  const pastedIds = new Set(items.map((i) => i.id))
  for (const g of new Set(items.map((i) => i.group))) {
    if (!g) continue
    // Grup que no hi és: es queda; una part d'un grup d'aquí: la còpia hi va (com «Duplicar»); el grup sencer o un grup
    // d'un altre ambient amb el mateix nom: grup nou.
    const here = a.items.filter((i) => i.group === g)
    const part = here.some((i) => pastedIds.has(i.id)) && !here.every((i) => pastedIds.has(i.id))
    if (!used.has(g) || part) {
      renamed.set(g, g)
      continue
    }
    while (used.has(`Grup ${n}`)) n++
    renamed.set(g, `Grup ${n}`)
    used.add(`Grup ${n}`)
  }
  const copies = items.map((i) => ({ ...i, id: newId("i"), x: i.x + offset, y: i.y + offset, ...(i.group ? { group: renamed.get(i.group)! } : {}) }))
  const groups = new Set(copies.map((c) => c.group))
  const only = groups.size === 1 ? [...groups][0] : undefined
  return { ambient: { ...a, items: [...a.items, ...copies] }, ids: copies.map((c) => c.id), ...(only ? { group: only } : {}) }
}

/** Què és un element de l'ambient per al resum: un moble, un objecte (o bloc) o un moble que ja no hi és. */
export type AmbientItemKind = "moble" | "object" | "missing"

/** Resum d'un ambient (el «Resum» de l'inspector de l'ambient; el mateix recompte per a qualsevol altre lloc que el digui). */
export interface AmbientSummary {
  mobles: number
  objects: number
  /** Ids dels mobles enllaçats que ja no hi són (esborrats de la llista). */
  missing: string[]
  groups: number
  walls: number
  /** Llargada total de les parets (mm, als eixos). */
  wallLength: number
  windows: number
  doors: number
  glazing: number
  /** Superfície de terra de les habitacions tancades (mm², als eixos); 0 si no n'hi ha cap. */
  area: number
}

export function ambientSummary(a: Ambient, kindOf: (it: AmbientItem) => AmbientItemKind): AmbientSummary {
  const kinds = a.items.map((it) => [it, kindOf(it)] as const)
  const openings = a.walls.flatMap((w) => w.openings ?? [])
  return {
    mobles: kinds.filter(([, k]) => k === "moble").length,
    objects: kinds.filter(([, k]) => k === "object").length,
    missing: kinds.filter(([, k]) => k === "missing").map(([it]) => it.id),
    groups: new Set(a.items.map((i) => i.group).filter(Boolean)).size,
    walls: a.walls.length,
    wallLength: a.walls.reduce((n, w) => n + wallLength(w), 0),
    windows: openings.filter((o) => o.kind === "window").length,
    doors: openings.filter((o) => o.kind === "door").length,
    glazing: openings.filter((o) => o.kind === "glazing").length,
    area: floorArea(a.walls),
  }
}

/** Caixa d'un element al plànol (x0, y0, x1, y1), la de la seva petjada girada. */
type ItemBoxOf = (it: AmbientItem) => { x0: number; y0: number; x1: number; y1: number } | null

/**
 * Alinear els elements triats (selecció múltiple dels Ambients, com a l'editor; per decisió de l'usuari, 2026-10-14) al
 * plànol, en X (`x`) o en Y (`y`, cap avall al plànol), a l'inici, al mig o al final de la caixa de tots.
 */
export function alignItems(a: Ambient, ids: readonly string[], boxOf: ItemBoxOf, axis: "x" | "y", mode: "min" | "mid" | "max"): Ambient {
  const bs = a.items.filter((i) => ids.includes(i.id)).flatMap((i) => {
    const b = boxOf(i)
    return b ? [{ i, lo: axis === "x" ? b.x0 : b.y0, hi: axis === "x" ? b.x1 : b.y1 }] : []
  })
  if (bs.length < 2) return a
  const lo = Math.min(...bs.map((b) => b.lo)), hi = Math.max(...bs.map((b) => b.hi))
  const d = new Map(bs.map((b) => [b.i.id, mode === "min" ? lo - b.lo : mode === "max" ? hi - b.hi : (lo + hi) / 2 - (b.lo + b.hi) / 2]))
  return { ...a, items: a.items.map((i) => (d.has(i.id) ? { ...i, [axis]: i[axis] + d.get(i.id)! } : i)) }
}

/**
 * Repartir els triats en X o en Y: sense `gap`, el primer i l'últim es queden i els del mig amb el mateix espai (calen 3);
 * amb `gap` (mm), el primer es queda i cada altre a aquest espai de l'anterior (calen 2).
 */
export function distributeItems(a: Ambient, ids: readonly string[], boxOf: ItemBoxOf, axis: "x" | "y", gap?: number): Ambient {
  const bs = a.items.filter((i) => ids.includes(i.id)).flatMap((i) => {
    const b = boxOf(i)
    return b ? [{ i, lo: axis === "x" ? b.x0 : b.y0, hi: axis === "x" ? b.x1 : b.y1 }] : []
  }).sort((p, q) => p.lo - q.lo)
  if (bs.length < (gap === undefined ? 3 : 2)) return a
  const sizes = bs.reduce((s, b) => s + (b.hi - b.lo), 0)
  const g = gap ?? (bs.at(-1)!.hi - bs[0]!.lo - sizes) / (bs.length - 1)
  const d = new Map<string, number>()
  let at = bs[0]!.lo
  for (const b of bs) {
    d.set(b.i.id, at - b.lo)
    at += b.hi - b.lo + g
  }
  return { ...a, items: a.items.map((i) => (d.has(i.id) ? { ...i, [axis]: i[axis] + d.get(i.id)! } : i)) }
}


// --- Parets a la selecció múltiple i als grups (com els elements; per decisió de l'usuari, 2026-10-14) ----------------

/** Ids de les parets d'un grup. */
export const groupWallIds = (a: Ambient, group: string) => a.walls.filter((w) => w.group === group).map((w) => w.id)

/** Mou les parets (mm): els extrems i, corbes, els punts de control. Les obertures es queden al seu lloc de la paret. */
export function moveWalls(a: Ambient, ids: readonly string[], dx: number, dy: number): Ambient {
  if (!ids.length || (!dx && !dy)) return a
  const t = (p: PlanPt): PlanPt => [p[0] + dx, p[1] + dy]
  return { ...a, walls: a.walls.map((w) => (ids.includes(w.id) ? { ...w, a: t(w.a), b: t(w.b), ...(w.curve ? { curve: { c1: t(w.curve.c1), c2: t(w.curve.c2) } } : {}) } : w)) }
}

/** Posa o treu (`group` buit) les parets en un grup. */
export function setWallGroup(a: Ambient, ids: readonly string[], group: string | undefined): Ambient {
  return {
    ...a,
    walls: a.walls.map((w) => {
      if (!ids.includes(w.id)) return w
      const { group: _g, ...rest } = w
      void _g
      return group ? { ...rest, group } : rest
    }),
  }
}


// --- Teulada ---------------------------------------------------------------------------------------------------------

/** La caixa de la teulada al plànol (la de les parets més el voladís) i l'alçada on comença (mm). Sense parets, `null`. */
export function roofBox(a: Ambient): { x0: number; y0: number; x1: number; y1: number; base: number } | null {
  if (!a.roof || !a.walls.length) return null
  const pts = a.walls.flatMap((w) => wallPoints(w, 8))
  const o = a.roof.overhang
  const base = a.roof.height ?? Math.max(...a.walls.map((w) => w.height))
  return { x0: Math.min(...pts.map((p) => p[0])) - o, y0: Math.min(...pts.map((p) => p[1])) - o, x1: Math.max(...pts.map((p) => p[0])) + o, y1: Math.max(...pts.map((p) => p[1])) + o, base }
}
