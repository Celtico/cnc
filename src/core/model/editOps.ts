import {
  anchorRef,
  freeX,
  modulePlacements,
  newId,
  partOffset,
  resolveParts,
  rowOf,
  type Composition,
  type ModelObject,
  type Module,
  type ModuleMount,
  type RefObject,
  type Run,
  type Zone,
} from "./composition"
import { cloneZone, removeZone, updateZone } from "./zoneOps"
import { hungBack } from "./hungBack"
import { partSize, partsBox, type FreePart } from "./freePart"
import { modelFootprint } from "./models"
import { isCncBoard, materialCategory, type MaterialPref } from "./settings"

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

/**
 * **Enganxar propietats** d'un mòdul (per decisió de l'usuari, 2026-10-20: «creava algo i aplico propietat, i al pegar en
 * una altra objecte, es manté, i copia les propietats», com copiar l'estil a un programa de disseny): el mòdul triat es
 * queda on és i amb les seves mides, i agafa de l'altre la caixa (base, fons, tapa, laterals, materials…), els fronts,
 * els ferratges i tot l'interior (amb ids nous). Penjat o a terra no es copia (és la Posició): si un dels dos és penjat, es
 * queda la base del triat. Els passacables (van a una posició del mòdul) i la cantonada en L, tampoc.
 */
export function pasteModuleProps(target: Module, src: Module): Module {
  const t = target.carcass
  const { corner: _c, ...from } = structuredClone(src.carcass)
  const keepBase = t.base.kind === "wall" || from.base.kind === "wall"
  const carcass = { ...from, width: t.width, height: t.height, depth: t.depth, ...(keepBase ? { base: t.base } : {}), ...(t.corner ? { corner: t.corner } : {}) }
  const { type: _t, ...rest } = target
  return { ...rest, ...(src.type ? { type: src.type } : {}), carcass, fronts: structuredClone(src.fronts), hardware: structuredClone(src.hardware), root: { ...cloneZone(src.root), id: target.root.id } }
}

/**
 * Canvia on va un mòdul (Mòdul › Posició › «Fila», i l'assistent IA): **arrambat** a la paret (a terra, a la fila),
 * **penjat** (base `wall` a `floorHeight`, a la fila dels penjats) o **lliure al terra** (surt de la fila i es queda on
 * és: X pròpia `here`, a 0 de la paret). D'un penjat a terra, la base passa a «directe a terra».
 */
export function setModuleMount(m: Module, mount: ModuleMount, here: number, floorHeight = 1450): Module {
  const c = m.carcass
  const wasHung = c.base.kind === "wall"
  const { wallGap: _old, x: _x, ...rest } = m
  void _old
  void _x
  // Penjar-lo: amb el fons estàndard dels penjats (`hungBack`: retirat per al penjador i la regleta).
  if (mount === "hung") return { ...rest, gapBefore: 0, carcass: wasHung ? { ...c, base: { kind: "wall", height: floorHeight } } : hungBack({ ...c, base: { kind: "wall", height: floorHeight } }) }
  const base = wasHung ? ({ kind: "none" } as const) : c.base
  return { ...rest, ...(mount === "floor" ? { wallGap: 0, x: here } : {}), gapBefore: wasHung ? 0 : m.gapBefore, carcass: { ...c, base } }
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
 * Mou uns quants mòduls junts (un grup, la selecció múltiple). A cada fila, cada tirada de mòduls triats seguits es mou
 * sencera: el primer guanya la separació (`gapBefore`) i el següent de la fila que no és de la tirada la perd (com
 * `moveModuleBy`); els de dins no canvien, i així no se separen. Amb X pròpia (lliure al terra), cadascun la seva X.
 */
function moveModulesBy(comp: Composition, ids: ReadonlySet<string>, dx: number, dy = 0, dz = 0): Composition {
  if (!ids.size) return comp
  const modules = comp.modules.map((m) => ({ ...m }))
  for (const row of ["floor", "wall"] as const) {
    const order = modules.map((m, k) => (rowOf(m) === row && !freeX(m) ? k : -1)).filter((k) => k >= 0)
    for (let r = 0; r < order.length; r++) {
      const k = order[r]!
      if (!ids.has(modules[k]!.id) || (r > 0 && ids.has(modules[order[r - 1]!]!.id))) continue
      const gap = Math.max(0, Math.round(modules[k]!.gapBefore + dx))
      const actual = gap - modules[k]!.gapBefore
      modules[k]!.gapBefore = gap
      let e = r
      while (e + 1 < order.length && ids.has(modules[order[e + 1]!]!.id)) e++
      const next = order[e + 1]
      if (next !== undefined) modules[next]!.gapBefore = Math.max(0, modules[next]!.gapBefore - actual)
    }
  }
  return {
    ...comp,
    modules: modules.map((m) => {
      if (!ids.has(m.id)) return m
      if (freeX(m)) return { ...m, x: Math.round(m.x! + dx), wallGap: Math.max(0, Math.round((m.wallGap ?? 0) + dz)) }
      const base = m.carcass.base.kind === "wall" && dy ? { ...m.carcass.base, height: Math.max(0, Math.round(m.carcass.base.height + dy)) } : m.carcass.base
      const wallGap = m.wallGap !== undefined && m.carcass.base.kind !== "wall" ? Math.max(0, Math.round(m.wallGap + dz)) : m.wallGap
      return { ...m, ...(wallGap !== undefined ? { wallGap } : {}), carcass: { ...m.carcass, base } }
    }),
  }
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
 * Arrossegar per ordenar: posa el mòdul `id` just abans (o després) de `targetId` i n'agafa el grup. Només
 * dins de la mateixa fila (a terra / penjats); si són de files diferents no fa res.
 */
export function reorderModule(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  if (id === targetId) return comp
  const m = comp.modules.find((x) => x.id === id)
  const t = comp.modules.find((x) => x.id === targetId)
  if (!m || !t || rowOf(m) !== rowOf(t)) return comp
  const rest = comp.modules.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  // Deixat al costat d'un mòdul, n'agafa el grup (com `reorderPart`): així s'entra, se surt o es canvia de grup arrossegant.
  const { group: _g, ...plain } = m
  void _g
  const moved = t.group ? { ...plain, group: t.group } : plain
  return { ...comp, modules: [...rest.slice(0, at), moved, ...rest.slice(at)] }
}

/** Arrossegar per ordenar els objectes de referència. */
export function reorderRef(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  if (id === targetId) return comp
  const r = comp.references.find((x) => x.id === id)
  const t = comp.references.find((x) => x.id === targetId)
  if (!r || !t) return comp
  const rest = comp.references.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  // Agafa el grup de l'objecte on es deixa (com les peces i els models).
  const { group: _g, ...plain } = r
  void _g
  const moved = t.group ? { ...plain, group: t.group } : plain
  return { ...comp, references: [...rest.slice(0, at), moved, ...rest.slice(at)] }
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

/** Els elements d'un grup: peces lliures, models 3D i mòduls amb aquell nom de grup. */
export function groupItems(comp: Composition, group: string): MultiItem[] {
  return [
    ...comp.modules.filter((m) => m.group === group).map((m) => ({ kind: "module" as const, id: m.id })),
    ...(comp.parts ?? []).filter((p) => p.group === group).map((p) => ({ kind: "part" as const, id: p.id })),
    ...(comp.models ?? []).filter((m) => m.group === group).map((m) => ({ kind: "model" as const, id: m.id })),
    ...comp.references.filter((r) => r.group === group).map((r) => ({ kind: "ref" as const, id: r.id })),
  ]
}

/** Els grups del document (peces lliures i models 3D), en l'ordre en què surten. */
export function groupNames(comp: Composition): string[] {
  const out: string[] = []
  for (const x of [...comp.modules, ...(comp.parts ?? []), ...(comp.models ?? []), ...comp.references]) if (x.group && !out.includes(x.group)) out.push(x.group)
  return out
}

/** Mou tot un grup (peces i models, mm). No deixa que res quedi sota terra. */
export function moveGroupBy(comp: Composition, group: string, dx: number, dy: number, dz: number): Composition {
  return moveMultiBy(comp, groupItems(comp, group), dx, dy, dz)
}

/** Nom lliure per a un grup nou («Grup 1», «Grup 2»…). */
export function newGroupName(comp: Composition): string {
  const taken = new Set(groupNames(comp))
  let n = 1
  while (taken.has(`Grup ${n}`)) n++
  return `Grup ${n}`
}

/** Canvia el nom d'un grup (peces i models); `next` buit = desagrupar; sense res: el grup sencer fora. */
export function renameGroup(comp: Composition, group: string, next: string | undefined): Composition {
  const re = <T extends { group?: string }>(x: T): T => {
    if (x.group !== group) return x
    const { group: _g, ...rest } = x
    void _g
    return (next ? { ...rest, group: next } : rest) as T
  }
  return { ...comp, modules: comp.modules.map(re), parts: (comp.parts ?? []).map(re), references: comp.references.map(re), ...(comp.models ? { models: comp.models.map(re) } : {}) }
}

/** Treu tot un grup (peces i models). */
export function removeGroup(comp: Composition, group: string): Composition {
  return removeMulti(comp, groupItems(comp, group))
}

/** Arrossegar un model 3D a l'arbre: va abans o després d'un altre model i n'agafa el grup (com `reorderPart`). */
export function reorderModel(comp: Composition, id: string, targetId: string, after: boolean): Composition {
  const list = comp.models ?? []
  const r = list.find((x) => x.id === id)
  const t = list.find((x) => x.id === targetId)
  if (!r || !t || id === targetId) return comp
  const rest = list.filter((x) => x.id !== id)
  const at = rest.indexOf(t) + (after ? 1 : 0)
  const { group: _g, ...plain } = r
  void _g
  const moved = t.group ? { ...plain, group: t.group } : plain
  return { ...comp, models: [...rest.slice(0, at), moved, ...rest.slice(at)] }
}

/** Posa (o treu, `group` buit) un model 3D en un grup: va darrere de l'últim model del grup. */
export function setModelGroup(comp: Composition, id: string, group: string | undefined): Composition {
  const list = comp.models ?? []
  const r = list.find((x) => x.id === id)
  if (!r) return comp
  const rest = list.filter((x) => x.id !== id)
  const { group: _g, ...plain } = r
  void _g
  if (!group) return { ...comp, models: [...rest, plain] }
  let at = rest.length
  for (let i = rest.length - 1; i >= 0; i--) if (rest[i]!.group === group) { at = i + 1; break }
  return { ...comp, models: [...rest.slice(0, at), { ...plain, group }, ...rest.slice(at)] }
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

/** Un element de la selecció múltiple (Maj + clic; per decisió de l'usuari, 2026-10-14). */
export interface MultiItem {
  kind: "part" | "model" | "ref" | "module"
  id: string
}

const inMulti = (items: readonly MultiItem[], kind: MultiItem["kind"], id: string) => items.some((x) => x.kind === kind && x.id === id)

/** Caixa de la selecció múltiple (peces, models i objectes de referència), en coordenades de la composició. */
export function multiBox(comp: Composition, items: readonly MultiItem[]): { min: [number, number, number]; max: [number, number, number] } | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  const add = (lo: readonly number[], hi: readonly number[]) => {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, lo[k]!)
      max[k] = Math.max(max[k]!, hi[k]!)
    }
  }
  const ps = resolveParts(comp).filter((p) => inMulti(items, "part", p.id))
  if (ps.length) {
    const b = partsBox(ps)
    add(b.min, b.max)
  }
  for (const m of (comp.models ?? []).filter((m) => inMulti(items, "model", m.id))) {
    const f = modelFootprint(m)
    add([f.x, m.y, f.z], [f.x + f.w, m.y + m.h, f.z + f.d])
  }
  for (const r of comp.references.filter((r) => inMulti(items, "ref", r.id))) add([r.x, r.y, r.z], [r.x + r.w, r.y + r.h, r.z + r.d])
  // Els mòduls, a la seva posició (`modulePlacements`).
  if (items.some((x) => x.kind === "module")) {
    const places = modulePlacements(comp)
    comp.modules.forEach((m, i) => {
      if (!inMulti(items, "module", m.id)) return
      const p = places[i]!
      const c = m.carcass
      add([p.x, p.y, p.z ?? 0], [p.x + c.width, p.y + c.height, (p.z ?? 0) + c.depth])
    })
  }
  return Number.isFinite(min[0]) ? { min, max } : null
}

/** Mou tots els elements triats (mm). Res no baixa de terra. */
export function moveMultiBy(comp: Composition, items: readonly MultiItem[], dx: number, dy: number, dz: number): Composition {
  const b = multiBox(comp, items)
  if (!b) return comp
  const ddy = Math.max(dy, -b.min[1])
  // Els mòduls, junts: a la seva fila, com la nansa (`moveModuleBy`), però una tirada de mòduls triats seguits es mou
  // sencera i conserva les separacions de dins (per decisió de l'usuari, 2026-10-16: «en moure grups es desplacen i no
  // mantenen l'espai original»); amunt i avall, només els penjats.
  comp = moveModulesBy(comp, new Set(items.filter((x) => x.kind === "module").map((x) => x.id)), dx, ddy, dz)
  return {
    ...comp,
    // Una peça enganxada a un mòdul que també es mou ja el segueix (x relativa): no es mou dues vegades.
    parts: (comp.parts ?? []).map((p) => (inMulti(items, "part", p.id) && !(p.module && inMulti(items, "module", p.module)) ? { ...p, x: p.x + dx, y: p.y + ddy, z: p.z + dz } : p)),
    // Els objectes al terra o a la paret s'hi queden (`anchorRef`).
    references: comp.references.map((r) => (inMulti(items, "ref", r.id) ? anchorRef({ ...r, x: r.x + dx, y: r.y + ddy, z: r.z + dz }) : r)),
    ...(comp.models ? { models: comp.models.map((m) => (inMulti(items, "model", m.id) ? { ...m, x: m.x + dx, y: m.y + ddy, z: m.z + dz } : m)) } : {}),
  }
}

/** Treu tots els elements triats. */
export function removeMulti(comp: Composition, items: readonly MultiItem[]): Composition {
  for (const x of items) if (x.kind === "module") comp = removeModule(comp, x.id).comp
  return {
    ...comp,
    parts: (comp.parts ?? []).filter((p) => !inMulti(items, "part", p.id)),
    references: comp.references.filter((r) => !inMulti(items, "ref", r.id)),
    ...(comp.models ? { models: comp.models.filter((m) => !inMulti(items, "model", m.id)) } : {}),
  }
}

/** Posa els elements triats en un grup (mòduls, peces, models i objectes de referència). */
export function groupMulti(comp: Composition, items: readonly MultiItem[], group: string): Composition {
  return {
    ...comp,
    modules: comp.modules.map((m) => (inMulti(items, "module", m.id) ? { ...m, group } : m)),
    parts: (comp.parts ?? []).map((p) => (inMulti(items, "part", p.id) ? { ...p, group } : p)),
    references: comp.references.map((r) => (inMulti(items, "ref", r.id) ? { ...r, group } : r)),
    ...(comp.models ? { models: comp.models.map((m) => (inMulti(items, "model", m.id) ? { ...m, group } : m)) } : {}),
  }
}

/** Afegeix o treu un element de la selecció múltiple. */
export function toggleMulti(items: readonly MultiItem[], item: MultiItem): MultiItem[] {
  return inMulti(items, item.kind, item.id) ? items.filter((x) => !(x.kind === item.kind && x.id === item.id)) : [...items, item]
}

/**
 * El mateix material a tots els triats (propietats comunes de la selecció múltiple): a una peça lliure com fa el seu
 * inspector (gruix més proper del material si es talla a la CNC; fora del nesting si és de simulació o és un objecte),
 * a un model 3D i a un objecte de referència. `materials`: els de Preferències.
 */
export function setMultiMaterial(comp: Composition, items: readonly MultiItem[], name: string, materials: readonly MaterialPref[]): Composition {
  const m = materials.find((x) => x.name === name)
  const object = comp.kind === "objecte"
  const part = (p: FreePart): FreePart => {
    const t = m && m.cnc !== false && m.thicknesses.length && !m.thicknesses.includes(p.thickness) ? m.thicknesses.reduce((a, b) => (Math.abs(b - p.thickness) < Math.abs(a - p.thickness) ? b : a)) : p.thickness
    const { nest: _n, ...rest } = p
    void _n
    const out: FreePart = { ...rest, material: name, thickness: object ? p.thickness : t }
    return (m && materialCategory(m) === "sim") || object ? { ...out, nest: false } : out
  }
  // Als mòduls, el material del cos (només els taulers de la CNC).
  const board = !!m && isCncBoard(m)
  return {
    ...comp,
    modules: comp.modules.map((x) => (board && inMulti(items, "module", x.id) ? { ...x, carcass: { ...x.carcass, material: name } } : x)),
    parts: (comp.parts ?? []).map((p) => (inMulti(items, "part", p.id) ? part(p) : p)),
    references: comp.references.map((r) => (inMulti(items, "ref", r.id) ? { ...r, material: name } : r)),
    ...(comp.models ? { models: comp.models.map((g) => (inMulti(items, "model", g.id) ? { ...g, material: name } : g)) } : {}),
  }
}

/** Les mides comunes dels triats (`w`, `h`, `d` dels models i objectes; `w`, `h` i el gruix de les peces): a tots, el valor. */
export function setMultiSize(comp: Composition, items: readonly MultiItem[], key: "w" | "h" | "d", v: number): Composition {
  if (!(v > 0)) return comp
  const dim = key === "w" ? "width" : key === "h" ? "height" : "depth"
  return {
    ...comp,
    modules: comp.modules.map((x) => (inMulti(items, "module", x.id) ? { ...x, carcass: { ...x.carcass, [dim]: v } } : x)),
    parts: (comp.parts ?? []).map((p) => (inMulti(items, "part", p.id) ? (key === "d" ? { ...p, thickness: v } : { ...p, [key]: v }) : p)),
    references: comp.references.map((r) => (inMulti(items, "ref", r.id) ? { ...r, [key]: v } : r)),
    ...(comp.models ? { models: comp.models.map((g) => (inMulti(items, "model", g.id) ? { ...g, [key]: v } : g)) } : {}),
  }
}

/** El gir de tots els models triats (graus). */
export function setMultiRot(comp: Composition, items: readonly MultiItem[], rot: number): Composition {
  if (!comp.models) return comp
  return { ...comp, models: comp.models.map((g) => (inMulti(items, "model", g.id) ? { ...g, rot } : g)) }
}

/** Caixa de cada triat (en coordenades de la composició), en l'ordre de `items`; els que no hi són, fora. */
function itemBoxes(comp: Composition, items: readonly MultiItem[]): { item: MultiItem; min: [number, number, number]; max: [number, number, number] }[] {
  return items.flatMap((item) => {
    const b = multiBox(comp, [item])
    return b ? [{ item, ...b }] : []
  })
}

/**
 * Alinear els triats (com Figma; per decisió de l'usuari, 2026-10-14) en un eix (0 X · 1 Y · 2 Z): a l'inici (`min`:
 * esquerra, a baix, darrere), al mig o al final (`max`) de la caixa de tots. Cadascú es mou sencer (les peces d'un grup,
 * no: només el triat).
 */
export function alignMulti(comp: Composition, items: readonly MultiItem[], axis: 0 | 1 | 2, mode: "min" | "mid" | "max"): Composition {
  const all = multiBox(comp, items)
  if (!all) return comp
  let out = comp
  for (const b of itemBoxes(comp, items)) {
    const target = mode === "min" ? all.min[axis] : mode === "max" ? all.max[axis] - (b.max[axis] - b.min[axis]) : (all.min[axis] + all.max[axis]) / 2 - (b.max[axis] - b.min[axis]) / 2
    const d = target - b.min[axis]
    if (Math.abs(d) < 1e-9) continue
    out = moveMultiBy(out, [b.item], axis === 0 ? d : 0, axis === 1 ? d : 0, axis === 2 ? d : 0)
  }
  return out
}

/** Repartir els triats en un eix amb el mateix espai entre ells (el primer i l'últim no es mouen). Calen 3 o més. */
export function distributeMulti(comp: Composition, items: readonly MultiItem[], axis: 0 | 1 | 2): Composition {
  const bs = itemBoxes(comp, items).sort((a, b) => a.min[axis] - b.min[axis])
  if (bs.length < 3) return comp
  const span = bs.at(-1)!.max[axis] - bs[0]!.min[axis]
  const sizes = bs.reduce((s, b) => s + (b.max[axis] - b.min[axis]), 0)
  const gap = (span - sizes) / (bs.length - 1)
  let out = comp
  let at = bs[0]!.min[axis]
  for (const b of bs) {
    const d = at - b.min[axis]
    if (Math.abs(d) > 1e-9) out = moveMultiBy(out, [b.item], axis === 0 ? d : 0, axis === 1 ? d : 0, axis === 2 ? d : 0)
    at += b.max[axis] - b.min[axis] + gap
  }
  return out
}

/** Treu del seu grup les peces i els models triats. */
export function ungroupMulti(comp: Composition, items: readonly MultiItem[]): Composition {
  const out = <T extends { id: string; group?: string }>(kind: MultiItem["kind"]) => (x: T): T => {
    if (!inMulti(items, kind, x.id) || !x.group) return x
    const { group: _g, ...rest } = x
    void _g
    return rest as T
  }
  return { ...comp, modules: comp.modules.map(out("module")), parts: (comp.parts ?? []).map(out("part")), references: comp.references.map(out("ref")), ...(comp.models ? { models: comp.models.map(out("model")) } : {}) }
}

/**
 * Repartir amb un espai donat (mm) en un eix: el primer (el de més a l'inici) es queda i cada un dels altres es posa a
 * `gap` de l'anterior. Amb dos o més.
 */
export function spaceMulti(comp: Composition, items: readonly MultiItem[], axis: 0 | 1 | 2, gap: number): Composition {
  const bs = itemBoxes(comp, items).sort((a, b) => a.min[axis] - b.min[axis])
  if (bs.length < 2 || !Number.isFinite(gap)) return comp
  let out = comp
  let at = bs[0]!.min[axis]
  for (const b of bs) {
    const d = at - b.min[axis]
    if (Math.abs(d) > 1e-9) out = moveMultiBy(out, [b.item], axis === 0 ? d : 0, axis === 1 ? d : 0, axis === 2 ? d : 0)
    at += b.max[axis] - b.min[axis] + gap
  }
  return out
}
