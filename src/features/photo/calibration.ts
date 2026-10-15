import type { Dispatch, SetStateAction } from "react"
import type { Pt } from "../../core/photo/homography"
import { effectiveReference, planeModel, type DepthMeasure } from "../../core/photo/measure"
import type { PhotoCalibration } from "../../db/db"

export type Tool = "none" | "origin" | "distance" | "rect" | "floor" | "depth"

export type SetCal = Dispatch<SetStateAction<PhotoCalibration>>

/** Fondària mesurada a terra i el punt de la foto on s'ha tocat. */
export type DepthResult = DepthMeasure & { at: Pt }

export type Vec3m = [number, number, number]
export type Drag =
  | { kind: "point"; index: number }
  | { kind: "measure"; id: string; index: number }
  | { kind: "floor"; index: number }
  | { kind: "origin"; z: number }
  | { kind: "axis"; axis: 0 | 1 | 2; start: Pt; o0: Vec3m; dir: Pt; pxPerMm: number }
  | { kind: "cabinet"; start: Pt; offset0: Pt }

/** Llargada de cada eix de l'origen (mm). */
export const AXIS_MM = 300

/** Un camp buit mentre s'escriu dona NaN: pel dibuix compta com a 0. */
export const fin = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0)
/** Sense mesures: sempre la mateixa llista (si no, els `useMemo` que en depenen es tornarien a fer a cada render). */
export const NO_MEASURES: never[] = []
/** Valor conegut o null (camp en blanc). */
export const known = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null)

/** Amplada efectiva de la referència (mm) d'un calibratge, o null si no se sap l'escala. */
function calibrationWidth(c: PhotoCalibration): number | null {
  if (c.points.length !== 4) return null
  const m = planeModel({ points: c.points, refW: known(c.ref.w), refH: known(c.ref.h), aspect: c.refAspect ?? null })
  return m ? (effectiveReference(m, c.measures ?? [], known(c.ref.w))?.w ?? null) : null
}

/**
 * Origen desat abans sense escala (`originScale`): agafa la d'ara, així una recalibració posterior el deixa al mateix
 * punt de la foto. Sense escala, es queda en mm. No es desa fins al pròxim canvi (obrir no desa).
 */
export function withOriginScale(c: PhotoCalibration): PhotoCalibration {
  if (!c.originMm || c.originScale) return c
  const w = calibrationWidth(c)
  return w ? { ...c, originScale: w } : c
}

let measureCounter = 0
export const newMeasureId = (): string => `m${Date.now().toString(36)}${(measureCounter++).toString(36)}`
