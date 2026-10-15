import { useEffect, useRef, useState } from "react"

/** Amplada (px) d'un element, seguida amb un ResizeObserver; `initial` fins a la primera mesura. */
export function useElementWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && e.contentRect.width > 0 && setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}
