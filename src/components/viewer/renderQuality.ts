import { useEffect, useState } from "react"
import { LOW_MEMORY } from "./deviceLimits"

/**
 * Mode del visor 3D (preferència del dispositiu, es desa al navegador):
 *  - fast («Ràpida»): per treballar. Fins a 2× de resolució, ombra de contacte, sense ombres
 *    projectades; amb perfils de les peces, graella de terra i botons d'edició.
 *  - presentation: 2×, ombres suaus i sense perfils, graella ni botons: aspecte de catàleg,
 *    per ensenyar el moble o fer-ne una imatge. Es commuta amb el botó del visor.
 */
export type RenderQuality = "fast" | "presentation"

export const QUALITY_LABELS: Record<RenderQuality, string> = { fast: "Ràpida", presentation: "Presentació" }

interface QualitySpec {
  dpr: [number, number]
  shadows: boolean
  shadowMap: number
  contactResolution: number
  contactBlur: number
  /** Perfils (arestes) de les peces, graella de terra i botons d'edició. */
  guides: boolean
}

export const QUALITY: Record<RenderQuality, QualitySpec> = {
  fast: { dpr: [1, 2], shadows: false, shadowMap: 512, contactResolution: 256, contactBlur: 2.2, guides: true },
  // A l'iPhone, l'ombra de 4096 (64 MB) i 2× fan que iOS tanqui la pàgina: 2048 i fins a 2×.
  presentation: LOW_MEMORY
    ? { dpr: [1.5, 2], shadows: true, shadowMap: 2048, contactResolution: 512, contactBlur: 3, guides: false }
    : { dpr: [2, 2], shadows: true, shadowMap: 4096, contactResolution: 1024, contactBlur: 3, guides: false },
}

const KEY = "mobles:render-quality"
const EVENT = "mobles:render-quality-change"

function read(): RenderQuality {
  try {
    const v = localStorage.getItem(KEY)
    // Els modes antics (equilibrada, alta) passen a «Ràpida».
    return v === "presentation" ? "presentation" : "fast"
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
