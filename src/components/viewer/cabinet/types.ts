import type { RenderQuality } from "../renderQuality"
import type { SceneGetter } from "../render/RenderDialog"
import type { ViewName } from "../viewNames"
import type { MaterialMode } from "../exportablePanel"
import type { CameraPose, FreePart, MaterialPref, ModelObject, Panel, RefObject } from "../../../core/model"

/** Mòdul de la composició, per ressaltar-lo, seleccionar-lo i afegir-ne al costat. */
export interface ViewerModule {
  id: string
  /** Número de mòdul (1..n), el mateix que `Panel.module`. */
  index: number
  /** Cantonada baix-esquerra-darrere en mm (coordenades de la composició). */
  x: number
  y: number
  width: number
  height: number
  depth: number
  /** Penjat a la paret: també es pot moure amunt i avall. */
  wall?: boolean
  /** Separació de la paret en mm (mòduls «Al terra»). */
  z?: number
  /** «Al terra» lliure: es mou pel terra (de costat i endavant/enrere). */
  free?: boolean
  /** D'esquena a la paret d'un costat (`wallSides`): es mou al llarg d'aquella paret (endavant/enrere), no de costat. */
  side?: "left" | "right"
  /** La distància d'ara des de la paret del fons, al llarg de la del costat (mm). */
  along?: number
  /** Potes regulables: alçada (mm) i fondària de la caixa, per dibuixar-les. */
  /** Potes (base «Potes»): `inset` de les vores; `fitted` = la pota importada i confirmada ja es dibuixa amb el seu model (`Panel.fittings`). */
  legs?: { height: number; depth: number; inset?: number; fitted?: boolean; points?: [number, number][] }
}

export interface CabinetViewerProps {
  /** Acabats propis de l'escena de Presentació (`Composition.scene`): terra, paret i parets dels costats. */
  sceneFinish?: { floor?: string; wall?: string; leftWall?: boolean; rightWall?: boolean }
  panels: Panel[]
  /** Mides exteriors del moble (o de tota la composició) en mm, per centrar la càmera. */
  size: { width: number; height: number; depth: number }
  exploded: boolean
  showHoles?: boolean
  /** Opacitat de les peces (Opcions de vista › Opacitat): translúcides per veure tots els mecanitzats. Sense, opaques. */
  seeThrough?: number
  /** Mòduls de la composició: el seleccionat es ressalta i té botons + als costats. */
  modules?: ViewerModule[]
  selectedModuleId?: string | null
  /** Clic a una peça d'un mòdul; `at` = punt tocat en mm de la composició. */
  onSelectModule?: (id: string, at?: [number, number, number]) => void
  /** Objectes fantasma (translúcids). */
  ghosts?: RefObject[]
  /** Costat des d'on enquadra la càmera (perspectiva) quan canvia `fitKey`: null = el 3/4 d'«Enquadrar». */
  viewDir?: ViewName | null
  /** Totes les peces en filferro (com les vistes d'escaire). */
  wireAll?: boolean
  /** Filferro a sobre de les cares (Modelatge: Filferro amb Ombrejat, Plana o Transparent): els cantells i els forats de totes les peces. */
  edgesAll?: boolean
  /** Un pla de secció (mm de la composició): es veu la meitat de sota del pla (`flip`: la de sobre). */
  section?: { axis: 0 | 1 | 2; pos: number; flip: boolean; paint?: boolean } | null
  /** Obertura de portes i calaixos, 0..1. */
  opening?: number
  /** Si hi és, només s'obren aquests grups (ids de `movingGroups`). */
  openOnly?: Set<string> | null
  /** Pintar per material (amb veta) o per tipus de peça. */
  materialMode?: MaterialMode
  /** Materials de les preferències, per resoldre els acabats. */
  materials?: MaterialPref[]
  /** Qualitat del render (resolució i ombres). */
  quality?: RenderQuality
  /** Rep una funció que dona l'escena i la càmera actuals (per al render per CPU). */
  onSceneAccess?: (get: SceneGetter) => void
  /** Ferratges visuals (frontisses, tiradors, potes). */
  hardware?: boolean
  /** Objecte de referència seleccionat i clic sobre un objecte al 3D. */
  selectedRefId?: string | null
  onSelectRef?: (id: string) => void
  /** Arrossegar el mòdul seleccionat (o tot el moble, `all`) amb la nansa: desplaçament en mm. */
  onMoveModule?: (id: string, dx: number, dy: number, all: boolean, dz: number) => void
  /** Arrossegar l'objecte seleccionat al 3D: posició nova (mm) en deixar-lo anar. */
  onMoveRef?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Peces lliures: clic a la peça la selecciona; la seleccionada porta el gizmo per moure-la. */
  parts?: FreePart[]
  selectedPartId?: string | null
  onSelectPart?: (id: string) => void
  onMovePart?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Selecció múltiple (Maj + clic): una caixa amb el gizmo que els mou tots junts. */
  selectedSet?: { kind: "part" | "model" | "ref" | "module"; id: string }[]
  onMoveSet?: (dx: number, dy: number, dz: number) => void
  /** Models 3D (`.glb`): clic per seleccionar-los; el seleccionat porta el gizmo per moure'l. */
  models?: ModelObject[]
  selectedModelId?: string | null
  onSelectModel?: (id: string) => void
  /** Ferratge col·locat a mà triat (`Composition.hardwarePlacements`): contorn i barra flotant (Duplicar · Editar · Eliminar). */
  selectedHardwareId?: string | null
  /** Clic a un ferratge col·locat (amb «Ferratges» visible). */
  onSelectHardware?: (id: string) => void
  onMoveModel?: (id: string, pos: { x: number; y: number; z: number }) => void
  /** Objectes que xoquen amb alguna peça: es pinten de vermell. */
  collidingRefIds?: Set<string>
  /** Els objectes i peces que tallen i toquen alguna peça (verd); els que tallen i no en toquen cap, vermell. */
  cuttingRefIds?: Set<string>
  /** Compartiment seleccionat (mm, coordenades de la composició): contorn taronja. */
  highlightZone?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; veil?: boolean } | null
  /** Què es ressalta amb el ratolí sobre el mòdul `moduleId` al punt `at` (mm): la clau de `useHoverLink` (el mòdul o, dins del mòdul triat, el compartiment). */
  hoverAt?: (moduleId: string, at: [number, number, number]) => string
  /** Compartiment sota el ratolí a l'arbre (mm, com `highlightZone`): contorn suau. */
  hoverZone?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } | null
  /** Clic amb el botó dret sense arrossegar (arrossegant, mou la càmera): on (px de la finestra del navegador). */
  onContextClick?: (x: number, y: number) => void
  /** Clic a l'espai buit (sense arrossegar): treure la selecció. */
  onDeselect?: () => void
  /** Canviar-lo torna a enquadrar la càmera (la resta de canvis no la mouen). */
  fitKey?: number
  /** Avisa si la càmera és a l'enquadrament automàtic (true) o l'usuari l'ha moguda / el moble ha canviat de mida (false). */
  onFramedChange?: (framed: boolean) => void
  /** Càmera desada (vista 3D): en muntar-se s'hi torna en lloc d'enquadrar. Només es llegeix en muntar-se. */
  initialCamera?: CameraPose
  /** La càmera de la vista 3D s'ha quedat quieta (1 s després de moure-la o d'enquadrar): per desar-la. */
  onCameraChange?: (camera: CameraPose) => void
  /** Posa la càmera en aquesta posició (desfer/refer d'una càmera): cada `n` nou hi va, sense animació ni desar-la. */
  cameraGoto?: { pose: CameraPose; n: number } | null
  /** Vola (amb animació) a aquesta càmera: anar a un avís. */
  cameraFly?: { pose: CameraPose; n: number } | null
  /** Les peces d'un avís (ids): es marquen en vermell i la resta es veu translúcida. */
  alertPanels?: ReadonlySet<string>
}
