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
  /** El 3D tal com es veu (làser): el raig de veritat i quants mm fa un píxel. */
  probe?: SceneProbe
}
/** Des de `from` (mm del moble) en la direcció `dir`: a quants mm toca una peça, i quina. */
export type RayCast = (from: Vec3, dir: Vec3) => { t: number; panel: string } | null
/** El raig (`cast`, fins a la primera cara que toca, ranures i forats buidats inclosos) i l'escala de la pantalla. */
export interface SceneProbe {
  cast: RayCast
  mmPerPx: (at: Vec3) => number
}
/** On el 3D deixa la seva sonda (`RayCaster`), perquè les eines la facin servir. */
export const RayCastContext = createContext<{ current: SceneProbe | null } | null>(null)
export type FacePick = (hit: FaceHit) => void
/** El ratolí sobre una cara amb una eina activa (la vista prèvia en verd, com al Taulell); null en sortir-ne. */
export type FaceHover = (hit: FaceHit | null) => void
export const FaceHoverContext = createContext<FaceHover | null>(null)
export const useFaceHover = () => useContext(FaceHoverContext)

export const FacePickContext = createContext<FacePick | null>(null)
export const useFacePick = () => useContext(FacePickContext)
/** Clic al buit amb una eina de cara: el làser i el mesurar s'esborren (com al Taulell). */
/** Cara dinàmica: la cara es pot arrossegar directament (`FaceDrag`). */
export const FaceDragContext = createContext(false)
/** L'eina activa també dibuixa a terra (Rectangle, Polilínia, Cercle). */
export const FloorPickContext = createContext(false)
export const FaceMissContext = createContext<(() => void) | null>(null)

/** Una línia dels croquis de Modelatge al 3D (mm de la composició): els desats, el triat i el que s'està dibuixant. */
export interface SketchLine {
  pts: Vec3[]
  closed: boolean
  tone: "sketch" | "selected" | "draft"
  /** Una caixa translúcida (la peça que sortiria si es clica). */
  box?: { min: Vec3; max: Vec3 }
  /** L'etiqueta de la vista prèvia (què es farà i a quina mida), al costat de la caixa. */
  label?: string
  /** Una mida (làser, mesurar): un punt a cada cap i la distància al mig, com al Taulell. */
  measure?: boolean
}
export const SketchOverlayContext = createContext<SketchLine[]>([])
export const useSketchOverlay = () => useContext(SketchOverlayContext)

/** Una fletxa d'arrossegar de Modelatge (tauler dinàmic, cara dinàmica): on és i cap on apunta (mm de la composició). */
export interface ViewerArrow {
  id: string
  at: Vec3
  dir: Vec3
  color: string
}
/**
 * Les fletxes i què passa en arrossegar-les: `onDrag` amb els mm cap a on apunta la fletxa i l'imant en mm (els píxels de
 * la pantalla), i retorna el text del costat del ratolí; `onDrop` en deixar-la (null si no s'ha mogut).
 */
export interface ArrowHandles {
  arrows: ViewerArrow[]
  onDrag: (id: string, mm: number, tolMm: number, free: boolean) => string | null
  onDrop: (id: string | null) => void
}
export const ArrowHandlesContext = createContext<ArrowHandles | null>(null)
export const useArrowHandles = () => useContext(ArrowHandlesContext)
