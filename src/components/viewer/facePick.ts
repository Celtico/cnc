import { createContext, useContext } from "react"
import type { Panel, Vec3 } from "../../core/model"

/**
 * Una eina que es fa clicant una cara (les del Taulell: bloc condicionat, prestatge, cantell, perforació...): amb una eina
 * activa, clicar una peça al 3D no la tria, sinó que crida l'eina amb la peça, el punt (mm de la composició) i la normal
 * de la cara tocada (al món, cap a fora de la peça).
 */
export interface FaceHit {
  panel: Panel
  point: Vec3
  normal: Vec3
}
export type FacePick = (hit: FaceHit) => void
/** El ratolí sobre una cara amb una eina activa (la vista prèvia en verd, com al Taulell); null en sortir-ne. */
export type FaceHover = (hit: FaceHit | null) => void
export const FaceHoverContext = createContext<FaceHover | null>(null)
export const useFaceHover = () => useContext(FaceHoverContext)

export const FacePickContext = createContext<FacePick | null>(null)
export const useFacePick = () => useContext(FacePickContext)

/** Una línia dels croquis de Modelatge al 3D (mm de la composició): els desats, el triat i el que s'està dibuixant. */
export interface SketchLine {
  pts: Vec3[]
  closed: boolean
  tone: "sketch" | "selected" | "draft"
  /** Una caixa translúcida (la peça que sortiria si es clica). */
  box?: { min: Vec3; max: Vec3 }
}
export const SketchOverlayContext = createContext<SketchLine[]>([])
export const useSketchOverlay = () => useContext(SketchOverlayContext)
