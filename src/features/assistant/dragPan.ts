import { useEffect, type RefObject } from "react"

/** Píxels que s'ha de moure el ratolí de costat abans que sigui lliscar (i no seleccionar text o clicar). */
const SLOP = 6

/**
 * **Lliscar de costat arrossegant amb el ratolí** (per decisió de l'usuari, 2026-10-14: al panell de l'assistent, «poder
 * lliscar/moure en horitzontal sense cap barra»). El tàctil i el trackpad ja ho fan sols (`overflow-x`); això afegeix el
 * ratolí: si el contingut és més ample que la caixa i l'arrossegament és sobretot de costat, la mou i no selecciona
 * text. Els botons, camps i enllaços no comencen mai a lliscar.
 */
export function useDragPan(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start: { x: number; y: number; left: number; id: number } | null = null
    let panning = false
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return
      if (el.scrollWidth <= el.clientWidth) return
      if ((e.target as Element).closest("button, a, input, textarea, select, [role=button]")) return
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, id: e.pointerId }
      panning = false
    }
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const dx = e.clientX - start.x
      if (!panning) {
        if (Math.abs(dx) < SLOP || Math.abs(dx) < Math.abs(e.clientY - start.y)) return
        panning = true
        el.setPointerCapture(e.pointerId)
        window.getSelection()?.removeAllRanges()
        el.style.cursor = "grabbing"
        el.style.userSelect = "none"
      }
      el.scrollLeft = start.left - dx
      e.preventDefault()
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      if (panning) {
        // El clic que acaba un arrossegament no ha de fer res a sota.
        const swallow = (c: MouseEvent) => (c.stopPropagation(), c.preventDefault())
        el.addEventListener("click", swallow, { capture: true, once: true })
        setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0)
        el.style.cursor = ""
        el.style.userSelect = ""
      }
      start = null
      panning = false
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
  }, [ref])
}

/** Barres de desplaçament amagades; només surten (primes) amb el ratolí a sobre. */
export const HOVER_SCROLLBARS = {
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
  "@media (hover: hover)": {
    "&:hover": { scrollbarWidth: "thin" },
    "&:hover::-webkit-scrollbar": { display: "initial" },
  },
} as const
