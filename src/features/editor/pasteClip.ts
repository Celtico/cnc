import { toaster } from "../../components/ui/toaster"
import { compositionKind, copyGroup, copyItems, insertItemsCopy, insertModelCopy, insertModuleCopy, insertPartCopy, insertRefCopy, partsOnlyKind, pasteZone, type Composition, type ItemsClip, type Module, type Zone } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { zoneLabel } from "../composition/zoneLabel"
import type { Clip } from "./clipboard"
import type { SetComp } from "./useEditorDoc"

/** El que hi ha triat, com a porta-retalls (⌘C, ⌘X, ⌘D i «Duplicar» del grup i de la selecció múltiple). */
export function clipOf(comp: Composition, selection: Selection, zone: Zone | undefined): Clip | null {
  if (selection.kind === "module") {
    const m = comp.modules.find((x) => x.id === selection.id)
    return m ? { kind: "module", data: m, label: m.name } : null
  }
  if (selection.kind === "ref") {
    const r = comp.references.find((x) => x.id === selection.id)
    return r ? { kind: "ref", data: r, label: r.name } : null
  }
  if (selection.kind === "part") {
    const r = comp.parts?.find((x) => x.id === selection.id)
    return r ? { kind: "part", data: r, label: r.name } : null
  }
  if (selection.kind === "model") {
    const g = comp.models?.find((x) => x.id === selection.id)
    return g ? { kind: "model", data: g, label: g.name } : null
  }
  // Un grup sencer (amb els seus mòduls, peces i models) o la selecció múltiple.
  if (selection.kind === "group") return { kind: "items", data: copyGroup(comp, selection.id), label: selection.id }
  if (selection.kind === "multi") return selection.items.length ? { kind: "items", data: copyItems(comp, selection.items), label: `${selection.items.length} elements` } : null
  if (selection.kind === "zone" && zone) return { kind: "zone", data: zone, label: zoneLabel(zone) }
  return null
}

/**
 * Grup on va el que s'enganxa: el grup triat o el de l'element triat (mòdul, peça o model); si no, cap (`null`). Així
 * enganxar amb un grup (o un element d'un grup) triat ho posa dins del grup, i duplicar un element d'un grup en fa la
 * còpia al mateix grup.
 */
function targetGroup(comp: Composition, selection: Selection): string | null {
  if (selection.kind === "group") return selection.id
  const of = selection.kind === "module" ? comp.modules.find((x) => x.id === selection.id) : selection.kind === "part" ? comp.parts?.find((x) => x.id === selection.id) : selection.kind === "model" ? comp.models?.find((x) => x.id === selection.id) : undefined
  return of?.group ?? null
}

/** Posa (o treu) el grup d'una còpia. */
function inGroup<T extends { group?: string }>(x: T, group: string | null): T {
  const { group: _g, ...rest } = x
  void _g
  return (group ? { ...rest, group } : rest) as T
}

/**
 * Enganxa el porta-retalls (⌘V) o duplica el triat (⌘D, `duplicate`). Els mòduls, després del mòdul triat; el que va en
 * grups, al grup triat (vegeu `targetGroup`); un grup copiat sencer, com un grup nou. El que aquest moble no admet
 * (mòduls a un moble només de peces, models 3D fora dels objectes, objectes de referència als objectes) no s'enganxa i
 * s'avisa.
 */
export function pasteClip({
  comp,
  setComp,
  select,
  selection,
  module,
  updateModule,
}: {
  comp: Composition
  setComp: SetComp
  select: (s: Selection) => void
  selection: Selection
  module: Module | undefined
  updateModule: (m: Module) => void
}, clip: Clip, duplicate = false) {
  const kind = compositionKind(comp)
  const group = targetGroup(comp, selection)
  const afterModule = selection.kind === "module" ? selection.id : selection.kind === "zone" ? selection.moduleId : undefined
  if (clip.kind === "module") {
    if (partsOnlyKind(kind)) {
      toaster.create({ title: "Aquí no es poden enganxar mòduls", description: "Un flat-pack o un objecte només té peces lliures.", type: "info" })
      return
    }
    const res = insertModuleCopy(comp, inGroup(clip.data, group), afterModule)
    setComp(res.comp)
    select({ kind: "module", id: res.id })
  } else if (clip.kind === "ref") {
    if (kind === "objecte") {
      toaster.create({ title: "Aquí no es poden enganxar objectes de referència", description: "Un objecte es fa amb peces lliures (per tallar, una peça amb l'efecte «Talla»).", type: "info" })
      return
    }
    const res = insertRefCopy(comp, clip.data)
    setComp(res.comp)
    select({ kind: "ref", id: res.id })
  } else if (clip.kind === "part") {
    const res = insertPartCopy(comp, inGroup(clip.data, group))
    setComp(res.comp)
    select({ kind: "part", id: res.id })
  } else if (clip.kind === "model") {
    if (kind !== "objecte") {
      toaster.create({ title: "Aquí no es poden enganxar models 3D", description: "Els models 3D van als objectes (sofàs, plantes…), no als mobles.", type: "info" })
      return
    }
    const res = insertModelCopy(comp, inGroup(clip.data, group))
    setComp(res.comp)
    select({ kind: "model", id: res.id })
  } else if (clip.kind === "items") {
    // El que aquest moble no admet es queda fora (i s'avisa).
    const data: ItemsClip = {
      ...clip.data,
      modules: partsOnlyKind(kind) ? [] : clip.data.modules,
      models: kind === "objecte" ? clip.data.models : [],
      refs: kind === "objecte" ? [] : clip.data.refs,
    }
    const left = clip.data.modules.length + clip.data.models.length + clip.data.refs.length - (data.modules.length + data.models.length + data.refs.length)
    if (left) toaster.create({ title: `${left === 1 ? "Un element no s'ha enganxat" : `${left} elements no s'han enganxat`}`, description: "Aquest moble no admet mòduls, models 3D o objectes de referència (segons el tipus).", type: "info" })
    if (!data.modules.length && !data.parts.length && !data.models.length && !data.refs.length) return
    // Duplicar deixa cada element al seu grup; enganxar els posa al grup triat (o solts).
    const res = insertItemsCopy(comp, data, { group: duplicate ? undefined : group, afterModule })
    setComp(res.comp)
    if (res.group) select({ kind: "group", id: res.group })
    else select(res.items.length === 1 ? (res.items[0]! as Selection) : { kind: "multi", items: res.items })
  } else {
    // Un compartiment s'enganxa dins del compartiment (o del mòdul) seleccionat.
    const target = selection.kind === "zone" ? { m: module, zoneId: selection.zoneId } : selection.kind === "module" ? { m: comp.modules.find((x) => x.id === selection.id), zoneId: undefined } : null
    if (!target?.m) {
      toaster.create({ title: "Tria on enganxar el compartiment", description: "Selecciona un compartiment o un mòdul.", type: "info" })
      return
    }
    const zid = target.zoneId ?? target.m.root.id
    updateModule({ ...target.m, root: pasteZone(target.m.root, zid, clip.data) })
    select({ kind: "zone", moduleId: target.m.id, zoneId: zid })
  }
}
