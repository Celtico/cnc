import { useState } from "react"
import type { TreeRowDnd } from "../../../components/TreeRow"
import { groupIds, moveItemToGroup, reorderItems, type Ambient, type AmbientItem } from "../../../core/model"

/**
 * Arrossegar per ordenar i per posar dins d'un grup (com les peces lliures de l'editor): una fila d'element o un grup
 * sencer; deixat al costat d'un element, n'agafa el grup; sobre la fila d'un grup, hi entra.
 */
export function useTreeDnd(amb: Ambient, change: (next: Ambient, commit: boolean) => void) {
  const [drag, setDrag] = useState<{ ids: string[]; key: string } | null>(null)
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null)
  const endDrag = () => (setDrag(null), setOver(null))
  const itemDnd = (it: AmbientItem): TreeRowDnd => {
    const ok = () => !!drag && !drag.ids.includes(it.id)
    return {
      dragging: !!drag?.ids.includes(it.id),
      indicator: over?.id === it.id && ok() ? (over.after ? "after" : "before") : null,
      onStart: () => setDrag({ ids: [it.id], key: it.id }),
      onOver: (after) => {
        if (!ok()) return false
        if (over?.id !== it.id || over.after !== after) setOver({ id: it.id, after })
        return true
      },
      onDrop: (after) => {
        if (drag && ok()) change(reorderItems(amb, drag.ids, it.id, after), true)
        endDrag()
      },
      onEnd: endDrag,
    }
  }
  const groupDnd = (name: string): TreeRowDnd => {
    const key = `g:${name}`
    // Un element d'un altre grup (o solt) hi entra; el grup sencer s'arrossega des de la seva fila.
    const ok = () => !!drag && drag.ids.length === 1 && amb.items.find((i) => i.id === drag.ids[0])?.group !== name
    return {
      dragging: drag?.key === key,
      indicator: over?.id === key && ok() ? "inside" : null,
      onStart: () => setDrag({ ids: groupIds(amb, name), key }),
      onOver: () => {
        if (!ok()) return false
        if (over?.id !== key) setOver({ id: key, after: false })
        return true
      },
      onDrop: () => {
        if (drag && ok()) change(moveItemToGroup(amb, drag.ids[0]!, name), true)
        endDrag()
      },
      onEnd: endDrag,
    }
  }
  const dragOutOfGroup = drag && drag.ids.length === 1 ? amb.items.find((i) => i.id === drag.ids[0])?.group : undefined
  return { drag, over, setOver, endDrag, itemDnd, groupDnd, dragOutOfGroup }
}
