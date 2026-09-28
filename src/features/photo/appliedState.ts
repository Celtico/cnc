import { measureValues, planeModel, type MeasureState } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"

export interface AppliedInfo {
  label: string
  state: MeasureState
}

/** Estat actual de cada mesura aplicada al moble (relativa, estimada o real). */
export function appliedMeasures(cal: PhotoCalibration | undefined): AppliedInfo[] {
  if (!cal?.applied?.length || !cal.measures?.length) return []
  const model = planeModel({ points: cal.points, refW: cal.ref.w, refH: cal.ref.h, aspect: cal.refAspect ?? null })
  const values = model ? measureValues(model, cal.measures, cal.ref.w) : []
  return cal.applied.map((a) => ({ label: a.label, state: values.find((v) => v.id === a.measureId)?.state ?? "relative" }))
}

/** Mesures aplicades que no són reals: el moble es basa en mides estimades. */
export function estimatedApplied(cal: PhotoCalibration | undefined): AppliedInfo[] {
  return appliedMeasures(cal).filter((a) => a.state !== "real")
}

export const ESTIMATED_WARNING = "No tallis amb mides estimades"
