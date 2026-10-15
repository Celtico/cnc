import { useEffect, useRef, useState } from "react"
import { compositionKind, findZone, isApplianceModule, partsOnlyKind, rowOf, toggleMulti, type Composition, type Module, type MultiItem } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import { useKeyed } from "../../lib/useKeyed"
import { useLatest } from "../../lib/useLatest"
import { keyInDialog } from "../../lib/keyTarget"

/**
 * La selecció de l'editor (arbre, 3D i alçat van sincronitzats): què hi ha triat, el mòdul de treball i com es tria
 * (clic, Maj + clic, tram de l'arbre i Esc).
 */
export function useEditorSelection({ comp, initial, kind, setMobilePane }: { comp: Composition; initial: Composition; kind: ReturnType<typeof compositionKind>; setMobilePane: (pane: "props") => void }) {
  // Selecció única (arbre, 3D i alçat van sincronitzats): moble, mòdul, compartiment o objecte.
  const [selectedModule, setSelectedModule] = useState<string>(initial.modules[0]?.id ?? "")
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [selKind, setSelKind] = useState<"moble" | "module" | "zone" | "ref" | "part" | "group" | "model" | "hardware" | "multi">(partsOnlyKind(compositionKind(initial)) || !initial.modules.length ? "moble" : "module")
  const [selectedRef, setSelectedRef] = useState<string | null>(null)
  const [selectedPart, setSelectedPart] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedHardware, setSelectedHardware] = useState<string | null>(null)
  // Selecció múltiple (Maj + clic a l'arbre o al 3D; per decisió de l'usuari, 2026-10-14).
  const [selectedMulti, setSelectedMulti] = useState<MultiItem[]>([])

  // El mòdul de treball (alçat, inspector, veïns): el seleccionat o el primer. Un moble nou no en té cap (0 mòduls).
  const module: Module | undefined = comp.modules.find((m) => m.id === selectedModule) ?? comp.modules[0]
  const moduleIndex = module ? comp.modules.indexOf(module) : -1
  // L'«Interior» d'un mòdul que és un electrodomèstic (`isApplianceModule`) no surt a l'arbre: triar-lo (al 3D, a l'alçat,
  // des d'un avís, pujant al pare) tria el mòdul, on és l'aparell.
  const zoneFound = selectedZone && module ? findZone(module.root, selectedZone) : undefined
  const zone = zoneFound && !(zoneFound.id === module!.root.id && isApplianceModule(module!)) ? zoneFound : undefined

  // Els triats que encara hi són (desfer o eliminar en pot treure).
  const multiNow = selKind === "multi" ? selectedMulti.filter((x) => (x.kind === "part" ? comp.parts?.some((p) => p.id === x.id) : x.kind === "model" ? comp.models?.some((m) => m.id === x.id) : x.kind === "module" ? comp.modules.some((m) => m.id === x.id) : comp.references.some((r) => r.id === x.id))) : []
  const selectionNow: Selection =
    selKind === "moble"
      ? { kind: "moble" }
      : selKind === "multi" && multiNow.length > 1
        ? { kind: "multi", items: multiNow }
      : selKind === "multi" && multiNow.length === 1
        ? { kind: multiNow[0]!.kind, id: multiNow[0]!.id }
      : selKind === "ref" && selectedRef && comp.references.some((r) => r.id === selectedRef)
        ? { kind: "ref", id: selectedRef }
        : selKind === "part" && selectedPart && comp.parts?.some((r) => r.id === selectedPart)
          ? { kind: "part", id: selectedPart }
          : selKind === "group" && selectedGroup && [...comp.modules, ...(comp.parts ?? []), ...(comp.models ?? [])].some((r) => r.group === selectedGroup)
            ? { kind: "group", id: selectedGroup }
          : selKind === "model" && selectedModel && comp.models?.some((g) => g.id === selectedModel)
            ? { kind: "model", id: selectedModel }
          : selKind === "hardware" && selectedHardware && comp.hardwarePlacements?.some((h) => h.id === selectedHardware)
            ? { kind: "hardware", id: selectedHardware }
          : partsOnlyKind(kind) || !module || selKind === "ref" || selKind === "part" || selKind === "group" || selKind === "model" || selKind === "multi"
            ? { kind: "moble" }
            : selectedZone && zone
          ? { kind: "zone", moduleId: module.id, zoneId: selectedZone }
          : { kind: "module", id: module.id }
  // La mateixa selecció ha de ser el mateix objecte d'un render a l'altre: si no, tots els càlculs
  // que en depenen (useMemo) es refarien a cada render.
  const selection = useKeyed(selectionNow, JSON.stringify(selectionNow))

  const select = (s: Selection, fromPanel = false) => {
    // Un element triat sol és l'inici d'un tram (Maj + clic a l'arbre).
    if (s.kind === "part" || s.kind === "model" || s.kind === "ref" || s.kind === "module") rangeAnchor.current = { kind: s.kind, id: s.id }
    if (s.kind === "moble") setSelKind("moble")
    else if (s.kind === "ref") {
      setSelectedRef(s.id)
      setSelKind("ref")
    } else if (s.kind === "part") {
      setSelectedPart(s.id)
      setSelKind("part")
    } else if (s.kind === "group") {
      setSelectedGroup(s.id)
      setSelKind("group")
    } else if (s.kind === "model") {
      setSelectedModel(s.id)
      setSelKind("model")
    } else if (s.kind === "hardware") {
      // El mòdul del ferratge passa a ser el de treball (alçat, veïns); si el ferratge desapareix (desfer), s'hi torna.
      const main = comp.hardwarePlacements?.find((h) => h.id === s.id)?.targets[0]
      if (main?.module) {
        setSelectedModule(main.module)
        setSelectedZone(null)
      }
      setSelectedHardware(s.id)
      setSelKind("hardware")
    } else if (s.kind === "module") {
      setSelectedModule(s.id)
      setSelectedZone(null)
      setSelKind("module")
    } else if (s.kind === "multi") {
      setSelectedMulti(s.items)
      setSelKind("multi")
    } else {
      setSelectedModule(s.moduleId)
      setSelectedZone(s.zoneId)
      setSelKind("zone")
    }
    // Al mòbil, triar a l'arbre porta a les propietats.
    if (fromPanel) setMobilePane("props")
  }
  const selectModule = (id: string) => select({ kind: "module", id })
  // Maj + clic (a l'arbre o al 3D): afegeix o treu la peça, el model o l'objecte de la selecció, com Figma. Es llegeix la
  // tecla del clic (`pointerdown`), no de cap estat desat.
  // Maj (o ⌘/Ctrl) + clic: la tecla del clic (`pointerdown`), no cap estat desat. `shiftRef` = afegir o treure (al 3D,
  // Maj o ⌘/Ctrl); `rangeRef` = Maj, que a l'arbre tria el tram del primer al darrer (com el Finder).
  const shiftRef = useRef(false)
  const rangeRef = useRef(false)
  useEffect(() => {
    const down = (e: PointerEvent) => {
      shiftRef.current = e.shiftKey || e.metaKey || e.ctrlKey
      rangeRef.current = e.shiftKey && !e.metaKey && !e.ctrlKey
    }
    window.addEventListener("pointerdown", down, true)
    return () => window.removeEventListener("pointerdown", down, true)
  }, [])
  // L'últim triat sol o afegit: l'inici del tram.
  const rangeAnchor = useRef<MultiItem | null>(null)
  // L'ordre de l'arbre de cada tipus (els grups, on surt el primer dels seus).
  const treeOrder = (kind: MultiItem["kind"]): string[] => {
    const grouped = <T extends { id: string; group?: string }>(list: T[]) => {
      const out: string[] = []
      const seen = new Set<string>()
      for (const x of list) {
        if (!x.group) out.push(x.id)
        else if (!seen.has(x.group)) {
          seen.add(x.group)
          out.push(...list.filter((y) => y.group === x.group).map((y) => y.id))
        }
      }
      return out
    }
    if (kind === "module") return [...comp.modules.filter((m) => rowOf(m) === "floor"), ...comp.modules.filter((m) => rowOf(m) === "wall")].map((m) => m.id)
    if (kind === "part") return grouped(comp.parts ?? [])
    if (kind === "model") return grouped(comp.models ?? [])
    return comp.references.map((r) => r.id)
  }
  const pick = (s: Selection, fromPanel = false) => {
    const kind = s.kind === "part" || s.kind === "model" || s.kind === "ref" || s.kind === "module" ? s.kind : null
    if (!kind || !("id" in s)) return select(s, fromPanel)
    const item: MultiItem = { kind, id: s.id }
    const set = (next: MultiItem[]) => select(next.length > 1 ? { kind: "multi", items: next } : next.length === 1 ? { kind: next[0]!.kind, id: next[0]!.id } : { kind: "moble" }, fromPanel)
    // Maj + clic a l'arbre: del primer (l'últim triat) a aquest, si són del mateix tipus.
    const anchor = rangeAnchor.current
    // Un que ja és a la selecció múltiple: Maj + clic el treu (només aquest), també a l'arbre.
    const inSel = selection.kind === "multi" && selection.items.some((x) => x.kind === kind && x.id === s.id)
    if (fromPanel && rangeRef.current && anchor && anchor.kind === kind && !inSel) {
      const order = treeOrder(kind)
      const i = order.indexOf(anchor.id), j = order.indexOf(s.id)
      if (i >= 0 && j >= 0) return set(order.slice(Math.min(i, j), Math.max(i, j) + 1).map((id) => ({ kind, id })))
    }
    rangeAnchor.current = item
    if (!shiftRef.current) return select(s, fromPanel)
    const cur: MultiItem[] = selection.kind === "multi" ? selection.items : selection.kind === "part" || selection.kind === "model" || selection.kind === "ref" || selection.kind === "module" ? [{ kind: selection.kind, id: selection.id }] : []
    set(toggleMulti(cur, item))
  }
  // Esc: treure la selecció (queda el moble sencer), si no s'està escrivint en un camp.
  const deselectRef = useLatest(() => select({ kind: "moble" }))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      // Si hi ha un menú o un diàleg obert, Esc el tanca a ell; dins d'una finestra, la tanca (les finestres flotants no
      // compten com a obertes: amb el focus a l'editor, Esc treu la selecció).
      if (keyInDialog(t) || document.querySelector('[data-part="content"][data-state="open"]:not([data-scope="floating-panel"]), [role="dialog"][data-state="open"]:not([data-scope="floating-panel"]), [role="alertdialog"][data-state="open"]')) return
      deselectRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [deselectRef])
  const selectZone = (id: string) => module && select({ kind: "zone", moduleId: module.id, zoneId: id })

  // El compartiment triat que es fa servir (alçat, obertura al 3D): cap si s'ha passat al mòdul (l'electrodomèstic).
  return { selectedZone: zone ? selectedZone : null, module, moduleIndex, zone, selection, select, selectModule, selectZone, pick, shiftRef }
}

/** El cadenat de l'arbre: el triat no es mou (ni el gizmo, ni la nansa, ni les fletxes). */
export function isSelectionLocked(comp: Composition, selection: Selection): boolean {
  return selection.kind === "module" ? !!comp.modules.find((m) => m.id === selection.id)?.locked
    : selection.kind === "ref" ? !!comp.references.find((r) => r.id === selection.id)?.locked
    : selection.kind === "part" ? !!comp.parts?.find((q) => q.id === selection.id)?.locked
    : selection.kind === "model" ? !!comp.models?.find((g) => g.id === selection.id)?.locked
    : selection.kind === "group" ? [...comp.modules, ...(comp.parts ?? []), ...(comp.models ?? [])].filter((q) => q.group === selection.id).every((q) => q.locked)
    : selection.kind === "multi" ? selection.items.some((x) => (x.kind === "part" ? comp.parts?.find((q) => q.id === x.id) : x.kind === "model" ? comp.models?.find((q) => q.id === x.id) : x.kind === "module" ? comp.modules.find((q) => q.id === x.id) : comp.references.find((q) => q.id === x.id))?.locked)
    : false
}
