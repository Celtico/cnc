import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { Ambient, PlanPt } from "../../../core/model"
import type { ItemGeometry } from "../ambientData"
import { ambientBox, fitView, type View } from "../planGeom"

/** Mida del requadre i vista del plànol (desplaçament i zoom): encabir en obrir i quan es demana. */
export function usePlanView({ ambient, geos, fitSignal, onFramedChange }: { ambient: Ambient; geos: Map<string, ItemGeometry | null>; fitSignal: number; onFramedChange?: (framed: boolean) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ tx: 0, ty: 0, s: 0.1 })

  // Mida del requadre.
  useLayoutEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  // Encabir en obrir i quan es demana.
  const fitted = useRef(-1)
  useEffect(() => {
    if (size.w < 50 || fitted.current === fitSignal) return
    fitted.current = fitSignal
    const v = fitView(ambientBox(ambient, geos), size.w, size.h)
    setView(v)
    setFitV(v)
  }, [fitSignal, size, ambient, geos])
  // Qualsevol desplaçament o zoom fa una vista nova (un altre objecte): ja no és la d'«Encabir».
  const [fitV, setFitV] = useState<View | null>(null)
  useEffect(() => onFramedChange?.(view === fitV), [view, fitV, onFramedChange])

  const toWorld = (clientX: number, clientY: number): PlanPt => {
    const r = host.current!.getBoundingClientRect()
    return [(clientX - r.left - view.tx) / view.s, (clientY - r.top - view.ty) / view.s]
  }

  return { host, size, view, setView, toWorld }
}

/** Roda del ratolí sobre el plànol (es crida després de les eines, com abans). */
export function usePlanWheel(host: RefObject<HTMLDivElement | null>, setView: Dispatch<SetStateAction<View>>) {
  // Roda: desplaçar; Ctrl/⌘ + roda (o pessigar al trackpad): zoom al punt.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const px = e.clientX - r.left, py = e.clientY - r.top
      setView((v) => {
        // Com al 3D: la roda fa zoom al punt del ratolí (pessigar al trackpad, més fi). Maj + roda: desplaçar.
        if (e.shiftKey) return { ...v, tx: v.tx - (e.deltaX || e.deltaY), ty: v.ty }
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
        const k = Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015))
        return zoomAt(v, px, py, k)
      })
    }
    el.addEventListener("wheel", wheel, { passive: false })
    return () => el.removeEventListener("wheel", wheel)
    // `host` i `setView` no canvien: s'enganxa en muntar-se.
  }, [host, setView])
}

/** Zoom de la vista al voltant d'un punt de la pantalla. */
export function zoomAt(v: View, px: number, py: number, k: number): View {
  const s = Math.min(3, Math.max(0.005, v.s * k))
  return { s, tx: px - ((px - v.tx) / v.s) * s, ty: py - ((py - v.ty) / v.s) * s }
}
