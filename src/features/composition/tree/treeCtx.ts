import { withFlag, type Composition, type MultiItem, type ViewFlags } from "../../../core/model"
import type { TreeRowFlags } from "../../../components/TreeRow"
import type { Selection } from "../StructureTree"
import type { TreeDnd } from "./useTreeDnd"

/** El que comparteixen les files de l'arbre (mòduls, peces lliures, objectes, models i grups). */
export type TreeCtx = {
  comp: Composition
  selection: Selection
  onSelect: (s: Selection) => void
  onChange: (c: Composition) => void
  dnd: TreeDnd
  flagsOf: TreeFlags["flagsOf"]
  groupFlags: TreeFlags["groupFlags"]
  inMultiSel: (kind: MultiItem["kind"], id: string) => boolean
  openGroups: Set<string>
  toggleGroup: (g: string) => void
  openGroup: (g: string) => void
}

type Listed = "modules" | "parts" | "references" | "models"
type TreeFlags = ReturnType<typeof treeFlags>

/** L'ull i el cadenat (com Figma): de cada element i, als grups de peces, de tots els seus. */
export function treeFlags(comp: Composition, onChange: (c: Composition) => void) {
  const parts = comp.parts ?? []
  const models = comp.models ?? []
  const flip = (list: Listed, match: (x: { id: string; group?: string }) => boolean, flag: keyof ViewFlags, on: boolean) =>
    onChange({ ...comp, [list]: ((comp[list] ?? []) as ({ id: string; group?: string } & ViewFlags)[]).map((x) => (match(x) ? withFlag(x, flag, on) : x)) })
  const flagsOf = (list: Listed, x: { id: string } & ViewFlags): TreeRowFlags => ({
    hidden: x.hidden,
    locked: x.locked,
    onHide: () => flip(list, (y) => y.id === x.id, "hidden", !x.hidden),
    onLock: () => flip(list, (y) => y.id === x.id, "locked", !x.locked),
  })
  const groupFlags = (g: string): TreeRowFlags => {
    const members = [...comp.modules, ...parts, ...models].filter((q) => q.group === g)
    const hidden = members.every((q) => q.hidden)
    const locked = members.every((q) => q.locked)
    // Peces i models del grup alhora.
    const both = (flag: keyof ViewFlags, on: boolean) => {
      const set = <T extends { group?: string } & ViewFlags>(x: T): T => (x.group === g ? withFlag(x, flag, on) : x)
      onChange({ ...comp, modules: comp.modules.map(set), parts: parts.map(set), ...(comp.models ? { models: comp.models.map(set) } : {}) })
    }
    return { hidden, locked, onHide: () => both("hidden", !hidden), onLock: () => both("locked", !locked) }
  }
  return { flagsOf, groupFlags }
}
