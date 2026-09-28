import { useEffect, useState } from "react"

/**
 * Qualitat del visor 3D. És una preferència del dispositiu (un iPhone vell i un Mac no
 * poden anar igual): es desa al navegador.
 *  - fast: resolució 1×, sense ombres. Per a mòbils lents o composicions grans.
 *  - balanced: fins a 2×, ombres suaus. Per defecte.
 *  - high: 2×, ombres de mapa gran i contacte fi. Per revisar acabats i fer imatges.
 *  - presentation: com high, però sense perfils de les peces, sense graella de terra i
 *    sense botons: aspecte de catàleg, per ensenyar el moble o fer-ne una imatge.
 */
export type RenderQuality = "fast" | "balanced" | "high" | "presentation"

export const QUALITY_LABELS: Record<RenderQuality, string> = { fast: "Ràpida", balanced: "Equilibrada", high: "Alta", presentation: "Presentació" }

export interface QualitySpec {
  dpr: [number, number]
  shadows: boolean
  shadowMap: number
  contactResolution: number
  contactBlur: number
  /** Perfils (arestes) de les peces, graella de terra i botons d'edició. */
  guides: boolean
}

export const QUALITY: Record<RenderQuality, QualitySpec> = {
  fast: { dpr: [1, 1], shadows: false, shadowMap: 512, contactResolution: 0, contactBlur: 0, guides: true },
  balanced: { dpr: [1, 2], shadows: true, shadowMap: 1024, contactResolution: 256, contactBlur: 2.2, guides: true },
  high: { dpr: [2, 2], shadows: true, shadowMap: 4096, contactResolution: 1024, contactBlur: 2.6, guides: true },
  presentation: { dpr: [2, 2], shadows: true, shadowMap: 4096, contactResolution: 1024, contactBlur: 3, guides: false },
}

const KEY = "mobles:render-quality"
const EVENT = "mobles:render-quality-change"

function read(): RenderQuality {
  try {
    const v = localStorage.getItem(KEY)
    return v === "fast" || v === "high" || v === "presentation" ? v : "balanced"
  } catch {
    return "balanced"
  }
}

export function useRenderQuality(): [RenderQuality, (q: RenderQuality) => void] {
  const [q, setQ] = useState<RenderQuality>(read)
  useEffect(() => {
    const on = () => setQ(read())
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [])
  const set = (v: RenderQuality) => {
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* només aquesta sessió */
    }
    setQ(v)
    window.dispatchEvent(new Event(EVENT))
  }
  return [q, set]
}
