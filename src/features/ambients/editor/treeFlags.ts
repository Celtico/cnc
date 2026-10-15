import type { TreeRowFlags } from "../../../components/TreeRow"
import { groupIds, groupWallIds, withFlag, type Ambient, type AmbientItem, type ViewFlags, type Wall } from "../../../core/model"

type Change = (next: Ambient, commit: boolean) => void

// L'ull i el cadenat (com Figma): de cada element, de cada paret i, als grups, de tots els seus.
const flipItems = (amb: Ambient, change: Change, ids: string[], flag: keyof ViewFlags, on: boolean) => change({ ...amb, items: amb.items.map((it) => (ids.includes(it.id) ? withFlag(it, flag, on) : it)) }, true)
export const itemFlags = (amb: Ambient, change: Change, it: AmbientItem): TreeRowFlags => ({ hidden: it.hidden, locked: it.locked, onHide: () => flipItems(amb, change, [it.id], "hidden", !it.hidden), onLock: () => flipItems(amb, change, [it.id], "locked", !it.locked) })
// Un grup: els seus elements i les seves parets.
export const groupFlags = (amb: Ambient, change: Change, name: string): TreeRowFlags => {
  const ids = groupIds(amb, name)
  const wids = groupWallIds(amb, name)
  const all = [...amb.items.filter((it) => ids.includes(it.id)), ...amb.walls.filter((w) => wids.includes(w.id))]
  const hidden = all.every((x) => x.hidden)
  const locked = all.every((x) => x.locked)
  const flip = (flag: keyof ViewFlags, on: boolean) =>
    change({ ...amb, items: amb.items.map((it) => (ids.includes(it.id) ? withFlag(it, flag, on) : it)), walls: amb.walls.map((w) => (wids.includes(w.id) ? withFlag(w, flag, on) : w)) }, true)
  return { hidden, locked, onHide: () => flip("hidden", !hidden), onLock: () => flip("locked", !locked) }
}
const flipWall = (amb: Ambient, change: Change, id: string, flag: keyof ViewFlags, on: boolean) => change({ ...amb, walls: amb.walls.map((w) => (w.id === id ? withFlag(w, flag, on) : w)) }, true)
export const wallFlags = (amb: Ambient, change: Change, w: Wall): TreeRowFlags => ({ hidden: w.hidden, locked: w.locked, onHide: () => flipWall(amb, change, w.id, "hidden", !w.hidden), onLock: () => flipWall(amb, change, w.id, "locked", !w.locked) })
