import { useThree } from "@react-three/fiber"
import { useEffect, useMemo } from "react"

/**
 * Cursor dels visors 3D (una sola regla, com la del tema): fletxa sobre el buit, `pointer` sobre el que es pot
 * seleccionar, `grab` sobre el que s'arrossega (fletxes del gizmo, nansa) i `grabbing` mentre s'arrossega.
 *
 * Cada component demana el seu (`hover`, `drag`) i es fa servir el de més prioritat de tots: arrossegar guanya a
 * passar per sobre, i entre els de passar per sobre, l'últim. S'escriu al canvas (no al `body`): si el component
 * es desmunta a mig hover, en desmuntar-se treu el seu i no queda cap mà penjada a la resta de l'app.
 */
export type ViewerCursor = "pointer" | "grab" | "grabbing"

interface CanvasCursors {
  hover: Map<symbol, ViewerCursor>
  drag: Map<symbol, ViewerCursor>
}
const byCanvas = new WeakMap<HTMLElement, CanvasCursors>()

function apply(el: HTMLElement, s: CanvasCursors) {
  const last = (m: Map<symbol, ViewerCursor>) => [...m.values()].pop()
  el.style.cursor = last(s.drag) ?? last(s.hover) ?? ""
}

function set(el: HTMLElement, which: keyof CanvasCursors, id: symbol, kind: ViewerCursor | null) {
  let s = byCanvas.get(el)
  if (!s) byCanvas.set(el, (s = { hover: new Map(), drag: new Map() }))
  // Tornar-lo a posar el passa al final (l'últim mana).
  s[which].delete(id)
  if (kind) s[which].set(id, kind)
  apply(el, s)
}

/** `hover(kind | null)` i `drag(kind | null)` d'aquest component; es netegen sols en desmuntar-lo. */
export function useViewerCursor() {
  const el = useThree((st) => st.gl.domElement)
  const api = useMemo(() => {
    const id = Symbol("cursor")
    return {
      id,
      hover: (kind: ViewerCursor | null) => set(el, "hover", id, kind),
      drag: (kind: ViewerCursor | null) => set(el, "drag", id, kind),
    }
  }, [el])
  useEffect(
    () => () => {
      set(el, "hover", api.id, null)
      set(el, "drag", api.id, null)
    },
    [el, api],
  )
  return api
}
