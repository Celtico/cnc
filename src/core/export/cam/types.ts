/** Tipus de la vista CAM: camins, operacions i peces llegits d'un .xcs. */

export type Pt = [number, number]

/** Tram d'un camí: recta fins a `to` o arc amb centre `c` (horari si `cw`). */
export interface CamSeg {
  to: Pt
  arc?: { c: Pt; cw: boolean }
  /** Recorreguts (`AddSegmentToToolpath`): la Z del punt (0 a la cara de dalt, negativa a dins). */
  z?: number
}

export interface CamPath {
  name: string
  kind: "polyline" | "circle" | "segment" | "toolpath"
  start: Pt
  segs: CamSeg[]
  closed: boolean
  /** Cercles (`CreateCircleCenterRadius`): centre i radi (l'òfset és exacte). */
  circle?: { c: Pt; r: number }
  /** Recorreguts (`CreateToolpath`): la Z més baixa (negativa = dins de la peça). */
  minZ?: number
  /** Recorreguts: la Z del punt de partida. */
  startZ?: number
}

export type CamOpKind = "drill" | "contour" | "pocket" | "rough" | "slot"
/** Costat de l'eina: contorns per dins / per fora, o la correcció d'un fresat (centre, esquerra, dreta). */
export type CamSide = "inside" | "outside" | "center" | "left" | "right"

export interface CamOp {
  /** Ordre al fitxer (1…). */
  n: number
  /** Línia del fitxer (1…). */
  line: number
  kind: CamOpKind
  name: string
  /** Ref de la peça (`A.1.L.1_Forat_3` → `A.1.L.1`), si el nom en porta. */
  ref?: string
  plane: string
  /** Paràmetre `tool` tal com és al fitxer (`"-1"` = la tria el Maestro). */
  toolArg: string
  /** Nom de l'eina: el paràmetre o, amb `"-1"`, el del comentari d'eina anterior (`//BROCA PLANA 006`). */
  tool: string
  depth: number
  desc: string
  /** Forats. */
  x?: number
  y?: number
  diameter?: number
  /** Geometria que consumeix l'operació (la geometria activa, la darrera creada). */
  path?: CamPath
  side?: CamSide
  overMaterial?: number
  /** Passada de les peces petites (`_P1`, «passada 1 de 3»). */
  pass?: { index: number; count: number }
  small?: boolean
  /** Entrada lineal (`SetApproachStrategy(lineal, cota, k)`): k × radi = llargada. */
  approach?: { linear: boolean; k: number }
  /** `CreateBidirectionalMillingStrategy(…, passada, …)`: fondària màxima de cada passada. */
  maxPass?: number
  /** Recorregut explícit del centre de l'eina (`CreateToolpath`, el que fa TopSolid). */
  toolpath?: CamPath
  /** Fresa esfèrica (comentari `//FRESA ESFERICA`): els relleus 3D. */
  ball?: boolean
}

export interface CamPart {
  ref: string
  name: string
  label: string
  length: number
  width: number
  /** Cantonada de la petjada al tauler, gir antihorari i mida de la petjada. */
  x: number
  y: number
  angle: number
  w: number
  h: number
  /** Centre de l'etiqueta (si el fitxer el porta). */
  cx?: number
  cy?: number
}

export interface XcsPreview {
  workpiece?: { name: string; L: number; W: number; T: number }
  parts: CamPart[]
  ops: CamOp[]
  /** Marge del tauler (comentari de la capçalera). */
  edgeTrim?: number
  spacing?: number
  /** Línies que no s'entenen (no fan res). */
  unknown: number
  unknownLines: { line: number; text: string }[]
}
