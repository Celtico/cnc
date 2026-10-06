/** El mínim del DOM que fa servir `undoKeyAction` (així es prova sense navegador). */
export interface KeyTarget {
  tagName?: string
  inputMode?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}
export interface KeyEventLike {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  target: unknown
}

/** Diàlegs modals oberts (l'editor de perfils, el de textures, el Render…): el que hi ha a sota no ha de rebre tecles. */
const OPEN_MODAL = '[role="dialog"][aria-modal="true"]:not([hidden]):not([data-state="closed"]), [role="alertdialog"][aria-modal="true"]:not([hidden]):not([data-state="closed"])'

/**
 * Què fa una tecla amb el desfer/refer d'un document: ⌘Z / Ctrl+Z desfer; ⇧⌘Z / Ctrl+Shift+Z / Ctrl+Y refer. Res als
 * camps de text lliure (nom del moble: el desfer propi del navegador; als numèrics sí que es desfà el document), dins d'un
 * diàleg o amb un diàleg modal obert: amb l'editor de perfils obert, ⌘Z desfeia el moble del darrere.
 *
 * `scope` (un diàleg amb desfer propi, com l'editor de perfils): només les tecles de dins del diàleg (o amb el focus al
 * `body`), sense mirar els diàlegs oberts (és el seu).
 */
export function undoKeyAction(e: KeyEventLike, doc?: { querySelector: (selector: string) => unknown }, scope?: { contains: (node: never) => boolean }): "undo" | "redo" | null {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return null
  const k = e.key.toLowerCase()
  if (k !== "z" && k !== "y") return null
  const t = e.target as KeyTarget | null
  if (t && typeof t === "object") {
    const tag = t.tagName
    const numeric = tag === "INPUT" && /decimal|numeric/.test(t.inputMode ?? "")
    if (tag === "TEXTAREA" || t.isContentEditable || (tag === "INPUT" && !numeric)) return null
    if (scope) {
      if (tag !== "BODY" && !scope.contains(t as never)) return null
    } else if (t.closest?.('[role="dialog"], [role="alertdialog"]')) return null
  } else if (scope) return null
  if (!scope && doc?.querySelector(OPEN_MODAL)) return null
  return k === "y" || e.shiftKey ? "redo" : "undo"
}
