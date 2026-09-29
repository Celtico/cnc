import { newId, rowOf, type Composition, type Module, type RefObject, type Zone } from "./composition"
import { cloneZone, removeZone, updateZone } from "./zoneOps"

/** Còpia d'un mòdul just després de `afterId` (o al final). */
export function insertModuleCopy(comp: Composition, src: Module, afterId?: string): { comp: Composition; id: string } {
  const copy: Module = { ...structuredClone(src), id: newId("m"), name: src.name.endsWith("(còpia)") ? src.name : `${src.name} (còpia)` }
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
  const row = rowOf(m)
  const gap = Math.max(0, Math.round(m.gapBefore + dx))
  const actual = gap - m.gapBefore
  const j = comp.modules.findIndex((x, k) => k > i && rowOf(x) === row)
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
    if (!firsts.has(row)) firsts.set(row, k)
  })
  const minGap = Math.min(...[...firsts.values()].map((k) => comp.modules[k]!.gapBefore))
  const applied = Math.max(dx, -minGap)
  const rest = Math.round(applied - dx)
  const firstIdx = new Set(firsts.values())
  return {
    ...comp,
    modules: comp.modules.map((m, k) => (firstIdx.has(k) ? { ...m, gapBefore: Math.max(0, Math.round(m.gapBefore + applied)) } : m)),
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
