import { useEffect } from "react"
import { r1 } from "./profileGeometry"
import type { ProfileShape } from "./useProfileShape"

/** Teclat de l'editor de perfil (obert): Esc i Retorn a la ploma; Supr i fletxes al node seleccionat. */
export function useProfileKeys(open: boolean, { drawing, sel, nodes, set, remove, cancelPen, finishPen }: ProfileShape) {
  // Teclat.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return
      if (drawing) {
        if (e.key === "Escape") {
          e.preventDefault()
          e.stopPropagation()
          cancelPen()
        } else if (e.key === "Enter") finishPen()
        return
      }
      if (sel === null) return
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        remove(sel)
        return
      }
      const k = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, k], ArrowDown: [0, -k] }[e.key]
      if (!d) return
      e.preventDefault()
      const p = nodes[sel]!
      set(sel, { ...p, x: r1(p.x + d[0]!), y: r1(p.y + d[1]!) }, { group: `nudge:${sel}` })
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  })
}
