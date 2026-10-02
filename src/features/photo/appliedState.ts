import { measureValues, planeModel, type MeasureState } from "../../core/photo/measure"
import type { AppliedMeasure, PhotoCalibration } from "../../db/db"

export interface AppliedInfo {
  label: string
  state: MeasureState
}

/** Estat actual de cada mesura aplicada al moble (relativa, estimada o real). */
export function appliedMeasures(cal: PhotoCalibration | undefined): AppliedInfo[] {
  if (!cal?.applied?.length || !cal.measures?.length) return []
  const model = planeModel({ points: cal.points, refW: cal.ref.w, refH: cal.ref.h, aspect: cal.refAspect ?? null })
  const values = model ? measureValues(model, cal.measures, cal.ref.w) : []
  return cal.applied.map((a) => {
    const v = values.find((x) => x.id === a.measureId)
    return { label: a.label, state: (appliedWhich(a) === "second" ? v?.state2 : v?.state) ?? "relative" }
  })
}

/** Quin valor de la mesura es va aplicar (els antics, per l'etiqueta: « (alçada)» = el segon). */
export function appliedWhich(a: AppliedMeasure): "main" | "second" {
  return a.which ?? (a.label.endsWith(" (alçada)") ? "second" : "main")
}

/** Mesures aplicades que no són reals: el moble es basa en mides estimades. */
export function estimatedApplied(cal: PhotoCalibration | undefined): AppliedInfo[] {
  return appliedMeasures(cal).filter((a) => a.state !== "real")
}

export const ESTIMATED_WARNING = "No tallis amb mides estimades"
