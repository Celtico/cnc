import { useCallback, useRef, useState } from "react"

/**
 * Amplada (px) d'un element, seguida amb un ResizeObserver; `initial` fins a la primera mesura. Torna una ref de
 * callback: si l'element es desmunta i torna (Vista CAM 2D ↔ 3D), es torna a mesurar.
 */
export function useElementWidth<T extends HTMLElement>(initial: number) {
  const [width, setWidth] = useState(initial)
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect()
    ro.current = null
    if (!el) return
    const obs = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setWidth(Math.floor(e.contentRect.width)))
    obs.observe(el)
    ro.current = obs
  }, [])
  return [ref, width] as const
}
