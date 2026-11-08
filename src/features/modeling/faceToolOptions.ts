import type { Selection } from "../composition/StructureTree"
import type { Composition, DynLimit, PartOrient, Vec3 } from "../../core/model"

/** Les eines del Taulell que es fan clicant una cara de la peça. */
export type FaceToolId = "groove" | "rebate" | "cut" | "measure" | "laser" | "dowel" | "screw" | "cabineo" | "rect" | "poly" | "circle" | "board" | "face" | "dynpanel" | "fitblock" | "shelf" | "band" | "hole" | "cup" | "line32"

/** Les opcions de les eines (les mateixes del Taulell, amb els seus valors per defecte). */
export interface FaceToolOpts {
  fitOrient: PartOrient
  fitGap: number
  /** Tauler dinàmic: desplaçament des de la cara on es recolza. */
  dynOff: number
  /** Tauler dinàmic (com el Taulell): «auto» clica la cara on es recolza; «ref» clica les cares que el limiten, una a una. */
  dynMode: "auto" | "ref"
  /** L'orientació del tauler: «auto» com la cara clicada; si no, l'eix del gruix (0 de costat, 1 horitzontal, 2 de cara). */
  dynOrient: "auto" | 0 | 1 | 2
  /** Cares de referència: les triades fins ara i el primer punt clicat (per on passa el tauler). */
  refLimits?: DynLimit[]
  refSeed?: Vec3
  /** Cara dinàmica: la cara triada (la peça lliure, l'eix i el costat: 0 el de baix, 1 el de dalt). */
  facePick?: { part?: string; module?: string; a: number; s: 0 | 1 }
  /** Cara dinàmica (com el Taulell): estirar la peça (o el moble), desplaçar-la, o enganxar-la a una altra cara. */
  faceMode: "pull" | "move" | "mate"
  /** Enganxar: «contact» les cares es toquen, «flush» queden al mateix pla; la separació entre totes dues. */
  mateMode: "contact" | "flush"
  faceGap: number
  /** Enganxar: la cara de la peça que es mou (el primer clic). */
  mateFrom?: { part: string; a: number; s: 0 | 1 }
  /** Esbós: el croquis que s'està dibuixant (el pla i els punts clicats). */
  draft?: { a: number; level: number; dir: 1 | -1; pts: [number, number][] }
  /** Esbós: el croquis triat (el de l'Extrusió). */
  selSketch?: string
  /** Esbós: les mides escrites del rectangle i el diàmetre del cercle. */
  sketchL: number
  sketchW: number
  sketchD: number
  /** Unions (els valors del Taulell): clavilles, cargols i Cabineo. */
  /** Clavilles: la mida (8×40, 8×30, 5×30) i si es reparteixen a tota la junta (si no, una on es clica). */
  dowM: DowelSize
  dowDist: boolean
  dowD: number
  dowF: number
  dowE: number
  dowMargin: number
  dowPitch: number
  /** Cargols: diàmetre i llargada (el nom del cargol i l'avís si no passa del gruix), forat passant i repartiment. */
  scrD: number
  scrL: number
  scrDist: boolean
  scrHole: number
  scrMargin: number
  scrPitch: number
  cabiM: "12" | "8"
  cabiMargin: number
  cabiPitch: number
  /** Cabineo, les mides del mecanitzat (Taulell): butxaca Ø i fondària, 1r forat i pas des del cantell, eix i Ø del cargol. */
  cabiD: number
  cabiDepth: number
  cabiFirst: number
  cabiStep: number
  cabiAxis: number
  cabiSd: number
  /** Ranura i galze (els valors del Taulell). `grOff`: distància fixa al cantell més proper (0: on es clica). */
  grW: number
  grD: number
  grDir: "L" | "A"
  grOff: number
  rbW: number
  rbD: number
  /** Làser: «face» cara a cara (el raig fins a la peça del davant) o «axis» eix a eix (centres de forats o mig del gruix). */
  laserMode: "face" | "axis"
  /** Mesurar i Làser: el primer punt clicat i l'última mesura (es veu com una línia al 3D). */
  measureFrom?: Vec3
  /** Retall: la peça que s'ha de retallar (la primera clicada). */
  cutTarget?: string
  measureLine?: [Vec3, Vec3]
  /** Làser: què es va mesurar (l'etiqueta que queda al costat de la mida). */
  measureLabel?: string
  T: number
  /** Tauler dinàmic: el gruix és el que s'ha escrit (si no, el del moble on va). */
  ownT?: boolean
  /** Bloc, tauler dinàmic i prestatge: el material triat (buit: el del moble on va, o el de la peça clicada). */
  mat: string
  setback: number
  d: number
  depth: number
  cd: number
  cdepth: number
  ld: number
  ldepth: number
  pitch: number
  margin: number
}
export const DEFAULT_FACE_OPTS: FaceToolOpts = { fitOrient: "flat", fitGap: 0, dynOff: 0, sketchL: 600, sketchW: 400, sketchD: 300, dowM: "8x40", dowDist: true, dowD: 8, dowF: 12, dowE: 29, dowMargin: 50, dowPitch: 200, scrD: 4, scrL: 60, scrDist: true, scrHole: 4, scrMargin: 50, scrPitch: 300, cabiM: "12", cabiMargin: 50, cabiPitch: 300, cabiD: 15, cabiDepth: 11, cabiFirst: 3.6, cabiStep: 11.2, cabiAxis: 5, cabiSd: 5, grW: 4, grD: 8, grDir: "L", grOff: 0, rbW: 10, rbD: 10, T: 19, dynMode: "auto", dynOrient: "auto", laserMode: "face", faceMode: "pull", mateMode: "contact", faceGap: 0, mat: "", setback: 1, d: 8, depth: 12, cd: 35, cdepth: 13, ld: 5, ldepth: 12, pitch: 32, margin: 37 }

/** Les clavilles del Taulell: diàmetre, llargada i fondàries a la cara i al cantell. */
export const DOWELS = { "8x40": { d: 8, L: 40, f: 12, e: 29 }, "8x30": { d: 8, L: 30, f: 12, e: 19 }, "5x30": { d: 5, L: 30, f: 10, e: 21 } } as const
export type DowelSize = keyof typeof DOWELS

/** El nom de cada eina (el títol de la seva finestra d'opcions). */
export const FACE_TOOL_LABEL: Record<FaceToolId, string> = { groove: "Ranura", rebate: "Galze", cut: "Retall", measure: "Mesurar", laser: "Làser", dowel: "Clavilles", screw: "Cargols", cabineo: "Cabineo", rect: "Rectangle", board: "Tauler", poly: "Polilínia", circle: "Cercle", face: "Cara dinàmica", dynpanel: "Tauler dinàmic", fitblock: "Bloc condicionat", shelf: "Prestatge", band: "Cantell", hole: "Perforació", cup: "Cassoleta", line32: "Línia 32" }

/** El que diu cada eina mentre és activa (els textos del Taulell). */
export const FACE_TOOL_INFO: Record<FaceToolId, string> = {
  groove: "Ranura: clica una cara principal on va la ranura (de punta a punta de la peça).",
  rebate: "Galze: clica una cara principal a prop del cantell.",
  cut: "Retall: clica la peça que s'ha de retallar i després la peça solta que la retalla (fa de tall només en aquella).",
  measure: "Mesurar: clica el primer punt i després el segon.",
  laser: "Làser: clica una cara i mesura fins a la peça del davant.",
  dowel: "Clavilles: clica la cara de fora del tauler on darrere hi ha el cantell de l'altra peça.",
  screw: "Cargols: clica la cara per on entra el cargol (p. ex. la cara de fora del lateral). Es centra al cantell de la peça de darrere.",
  cabineo: "Cabineo: clica la cara del tauler que porta el connector, a prop del cantell que toca l'altra peça.",
  board: "Tauler: clica a terra o sobre una cara per al primer cantó i després l'altre cantó (o escriu Llarg i Ample). Surt un tauler del gruix triat.",
  rect: "Rectangle: clica una cara per al primer cantó i després l'altre cantó (o escriu les mides).",
  poly: "Polilínia: clica els punts sobre una cara. Clica el primer punt o «Tanca» per acabar.",
  circle: "Cercle: clica el centre sobre una cara i després un punt de la vora (o escriu el diàmetre).",
  face: "Cara dinàmica: clica una cara d'una peça i escriu la mida nova en aquella direcció (la cara del davant es queda on és).",
  dynpanel: "Tauler dinàmic: clica la cara on es recolza (per exemple la base). Surt el tauler fins a les cares del costat i les segueix si el moble canvia.",
  fitblock: "Bloc condicionat: clica una cara de dins del buit. La peça l'omple i el segueix.",
  shelf: "Prestatge: clica la cara interior d'un lateral.",
  band: "Cantell: clica a prop del cantell de la peça per posar-lo o treure'l.",
  hole: "Perforació: clica la cara on va el forat.",
  cup: "Cassoleta: clica la cara de la porta on va la cassoleta.",
  line32: "Línia 32: clica la cara on va la filera de forats (al llarg de la peça).",
}

export interface FaceToolResult {
  comp?: Composition
  select?: Selection
  /** Opcions noves de l'eina (la cara triada de la Cara dinàmica). */
  opts?: FaceToolOpts
  message: string
  error?: boolean
  /** El que es faria, per a la vista prèvia en verd (forats de les unions), en mm de la composició. */
  ghost?: { min: Vec3; max: Vec3 }[]
}
