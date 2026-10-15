import { useCallback } from "react"
import type { CameraPose, Composition } from "../../core/model"
import { useHistory, useUndoKeys } from "../history/useHistory"
import { useLatest } from "../../lib/useLatest"

export type SetComp = (next: Composition | ((cur: Composition) => Composition), opts?: { commit?: boolean; group?: string }) => void

/** El document de l'editor: la composició (i la càmera) amb desfer/refer i les dreceres de teclat. */
export function useEditorDoc(initial: Composition) {
  // Composició amb desfer/refer (`useHistory`, fins a 50 passos). Canvis seguits (menys de 500 ms entre ells, p. ex.
  // escriure "1180" o arrossegar) compten com un sol pas. La càmera del 3D també és un pas (per decisió de l'usuari,
  // 2026-10-14: ⌘Z la torna on era), però es desa a part (sense «Modificat»); la miniatura, fora del desfer.
  const history = useHistory<{ comp: Composition; cam?: CameraPose }>({ comp: initial, ...(initial.camera ? { cam: initial.camera } : {}) }, { limit: 50, coalesceMs: 500 })
  const { set: setDoc, undo, redo, commit: commitHistory } = history
  const comp = history.value.comp
  const setComp: SetComp = useCallback(
    (next: Composition | ((cur: Composition) => Composition), opts?: { commit?: boolean; group?: string }) =>
      setDoc((h) => ({ ...h, comp: typeof next === "function" ? next(h.comp) : next }), opts),
    [setDoc],
  )
  // L'assistent IA llegeix la composició d'ara i hi aplica els canvis en viu; en acabar el torn, un sol pas de desfer.
  const compRef = useLatest(comp)
  const getComp = useCallback(() => compRef.current, [compRef])
  const applyLive = useCallback((next: Composition) => setComp(next, { commit: false }), [setComp])
  // Dreceres de desfer/refer (`undoKeyAction`): no als camps de text lliure ni amb un diàleg modal obert (l'editor de
  // perfils té el seu desfer: ⌘Z hi desfeia el moble del darrere).
  useUndoKeys(undo, redo)
  return { history, setDoc, commitHistory, comp, setComp, getComp, applyLive }
}
