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

export const FacePickContext = createContext<FacePick | null>(null)
export const useFacePick = () => useContext(FacePickContext)
