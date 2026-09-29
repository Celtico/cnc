import { useEffect, useState } from "react"

/**
 * Mode del visor 3D (preferència del dispositiu, es desa al navegador):
 *  - fast («Ràpida»): per treballar. Fins a 2× de resolució, ombra de contacte, sense ombres
 *    projectades; amb perfils de les peces, graella de terra i botons d'edició.
 *  - presentation: 2×, ombres suaus i sense perfils, graella ni botons: aspecte de catàleg,
 *    per ensenyar el moble o fer-ne una imatge. Es commuta amb el botó del visor.
 */
export type RenderQuality = "fast" | "presentation" | "raytrace"

export const QUALITY_LABELS: Record<RenderQuality, string> = { fast: "Ràpida", presentation: "Presentació", raytrace: "Ray tracing" }

export interface QualitySpec {
  dpr: [number, number]
  shadows: boolean
  shadowMap: number
  contactResolution: number
  contactBlur: number
  /** Perfils (arestes) de les peces, graella de terra i botons d'edició. */
  guides: boolean
  /** Ray tracing progressiu (path tracing): llum rebotada i ombres de debò. */
  pathTrace?: boolean
}

export const QUALITY: Record<RenderQuality, QualitySpec> = {
  fast: { dpr: [1, 2], shadows: false, shadowMap: 512, contactResolution: 256, contactBlur: 2.2, guides: true },
  presentation: { dpr: [2, 2], shadows: true, shadowMap: 4096, contactResolution: 1024, contactBlur: 3, guides: false },
  // El path tracer fa les ombres i la llum: sense mapa d'ombres ni ombra de contacte.
  raytrace: { dpr: [1, 2], shadows: false, shadowMap: 512, contactResolution: 0, contactBlur: 0, guides: false, pathTrace: true },
}

const KEY = "mobles:render-quality"
const EVENT = "mobles:render-quality-change"

function read(): RenderQuality {
  try {
    const v = localStorage.getItem(KEY)
    // Els modes antics (equilibrada, alta) passen a «Ràpida».
    return v === "presentation" || v === "raytrace" ? v : "fast"
  } catch {
    return "fast"
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
