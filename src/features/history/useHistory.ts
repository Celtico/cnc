import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { commitHistory, initHistory, pushHistory, redoHistory, undoHistory, type History, type HistoryOptions, type SetOptions } from "./history"
import { undoKeyAction } from "./undoKeys"

export interface UseHistory<T> {
  /** El valor actual (amb els canvis en viu). */
  value: T
  /** Canvi nou (valor o funció de l'actual); `{ commit: false }` en viu, `{ group }` per ajuntar-ne de seguits. */
  set: (next: T | ((cur: T) => T), opts?: SetOptions) => void
  /** Fa un pas amb els canvis en viu (en deixar anar). */
  commit: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Document nou: valor i historial de zero. */
  reset: (value: T) => void
  /** L'historial sencer, per tornar-hi amb `restore` (p. ex. cancel·lar la ploma). */
  state: History<T>
  restore: (state: History<T>) => void
}

/**
 * Desfer/refer d'un document (editor de mobles, d'ambients i de perfils): `history.ts` amb l'estat de React. Les funcions
 * són estables (es poden fer servir als efectes i als callbacks del 3D).
 */
export function useHistory<T>(initial: T, opts: HistoryOptions = {}): UseHistory<T> {
  const [state, setState] = useState<History<T>>(() => initHistory(initial))
  const optsRef = useRef(opts)
  useEffect(() => {
    optsRef.current = opts
  })
  const set = useCallback((next: T | ((cur: T) => T), s?: SetOptions) => {
    setState((h) => pushHistory(h, typeof next === "function" ? (next as (cur: T) => T)(h.present) : next, Date.now(), optsRef.current, s))
  }, [])
  const commit = useCallback(() => setState((h) => commitHistory(h, Date.now(), optsRef.current)), [])
  const undo = useCallback(() => setState(undoHistory), [])
  const redo = useCallback(() => setState(redoHistory), [])
  const reset = useCallback((value: T) => setState(initHistory(value)), [])
  const restore = useCallback((s: History<T>) => setState(s), [])
  return useMemo(
    () => ({ value: state.present, set, commit, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0, reset, state, restore }),
    [state, set, commit, undo, redo, reset, restore],
  )
}

/**
 * Dreceres de desfer/refer (⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z, Ctrl+Y; `undoKeyAction`). Sense `scope`, les del document de
 * la pàgina (no amb un diàleg modal obert); amb `scope`, només les de dins d'aquell diàleg.
 */
export function useUndoKeys(undo: () => void, redo: () => void, { enabled = true, scope }: { enabled?: boolean; scope?: RefObject<Element | null> } = {}) {
  const fns = useRef({ undo, redo })
  useEffect(() => {
    fns.current = { undo, redo }
  })
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      const el = scope?.current
      if (scope && !el) return
      const action = undoKeyAction(e, document, el ? { contains: (n: never) => el.contains(n as Node) } : undefined)
      if (!action) return
      e.preventDefault()
      if (action === "redo") fns.current.redo()
      else fns.current.undo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled, scope])
}
