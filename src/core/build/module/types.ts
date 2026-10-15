import type { LinearPiece } from "../linearOrders"
import type { HardwareItem, KitLevel, KitOptions, Panel } from "../../model"
import type { KitOrderLine, KitWoodSize } from "../drawerKit"
import type { SlotSpec } from "../hardware"
import type { Layout } from "../layout"
import type { LightOrder } from "../lightOrders"

/* Tipus del build d'un mòdul (`buildModule`): el resultat, els avisos i les referències internes. */

export interface BuildWarning {
  code:
    | "door-too-wide"
    | "door-too-tall"
    | "shelf-span"
    | "drawer-no-slide"
    | "grille-open-ratio"
    | "back-groove"
    | "back-inset"
    | "cable-hole"
    | "ref-cut"
    | "mitre"
    | "push"
    | "inset"
    | "hollow"
    | "table"
    | "layout"
    | "no-side"
    | "material-heat"
    | "collision"
    | "overlap"
    | "rail"
    | "light"
    | "hanging"
    | "hole-clash"
    | "island"
    | "hinge"
    | "drawer-bottom"
    | "invalid-part"
    | "edge-notch"
    | "drawer-box"
    | "handle"
    | "shelves"
    // Un ferratge del mòdul o d'un front que no es pot fer servir (paràmetre que falta, fórmula dolenta, tipus que no toca).
    | "hardware"
    // Materials que no lliguen amb Preferències (`materialIssues`, fora del build: el build no llegeix preferències).
    | "unknown-material"
    | "thickness-not-listed"
  message: string
  zoneId?: string
  panelId?: string
}

/** Un calaix fet amb un joc paramètric: el que cal comprar (números d'article) i la fusta que demana. */
export interface KitOrder {
  zoneId: string
  drawer: number
  /** Nom de l'item de la biblioteca i del joc («DTC MAGIC-PRO HT11 M»). */
  item: string
  kit: string
  nl: number
  options: KitOptions
  lines: KitOrderLine[]
  wood: KitWoodSize[]
  rule?: { stabilizer: KitLevel; syncRod: KitLevel }
  syncRod?: number
}

export interface ModuleBuild {
  panels: Panel[]
  /** Elements que no són de CNC (barres de penjar; components dels jocs de calaix, rol `hardware`): 3D i llista, sense nesting. */
  extras: Panel[]
  /** Calaixos amb joc paramètric: la comanda per al taller (Peces › «Ferratges dels jocs», LLEGEIX-ME). */
  hardwareKits: KitOrder[]
  /** Compartiments amb un joc de llum: les làmpades i el sistema elèctric (Peces › «Llums», LLEGEIX-ME; `lightOrders.ts`). */
  lightKits: LightOrder[]
  /** La comanda dels ferratges col·locats (frontisses, tiradors, pistons, potes): una línia per item (Peces › «Ferratges», LLEGEIX-ME). */
  fittingOrders: KitOrderLine[]
  /** Ferratges per metres del mòdul (regleta dels penjadors, sòcol d'alumini): els trossos (`buildLinearOrders`). */
  linear: LinearPiece[]
  /** La instal·lació dels llums del mòdul (alimentador, recorreguts dels cables, sortida a l'endoll) per al plànol de Peces. */
  wiring?: Wiring
  warnings: BuildWarning[]
  layout: Layout
  /** % d'àrea oberta de cada reixeta, per id de zona (o "top" per a la tapa). */
  openRatios: Record<string, number>
  /** Alçades reals dels fronts de cada pila de calaixos (mm, de baix a dalt), per id de zona: les de les «Auto» a l'inspector. */
  drawerHeights: Record<string, number[]>
}

/** Panells verticals registrats (laterals i divisors) per resoldre unions i fileres. */
export interface VerticalRef {
  panel: Panel
  /** X de les dues cares (esquerra i dreta). */
  xL: number
  xR: number
  yB: number
  yT: number
  zRear: number
  zFront: number
  outer: boolean
  /**
   * Folgança de les peces de dins: la peça s'atura aquests mm abans a cada cap (`yB`/`yT` són els de la llum; la peça
   * va de `yB + endGap` a `yT − endGap`). Sense (laterals, mòdul sense dividir): 0.
   */
  endGap?: number
}

/** Panells horitzontals registrats (base, tapa, prestatges fixos). */
export interface HorizontalRef {
  panel: Panel
  yBottom: number
  yTop: number
  xL: number
  xR: number
  outer: boolean
  /** Z del cantell de darrere i del de davant (prestatges fixos: més enrere si un front encastat els tapa; tapa amb
   * ranura d'aire: comença després de la ranura). Les espigues dels divisors van dins del tram comú. */
  zRear: number
  zFront: number
  /** Com `VerticalRef.endGap`: la peça va de `xL + endGap` a `xR − endGap`. */
  endGap?: number
}

/** El tirador resolt d'un front (`Builder.frontHandle`): push (cap forat) o els números del tirador, a demanda. */
export interface HandleChoice {
  push: boolean
  kitPush: boolean
  readonly spec: SlotSpec<"handle">
  readonly item: HardwareItem
}

/**
 * Un obstacle que entra pel darrere del mòdul (una columna de la casa, `buildComposition`): en coordenades del mòdul, de
 * `x0` a `x1`, i fins a `z` (des del darrere, ja amb el fons nou que s'hi posa davant). Els calaixos d'aquell tram es
 * fan més curts (guia i caixa, o la NL del joc) perquè hi càpiguen.
 */
export interface RearLimit {
  x0: number
  x1: number
  z: number
}

/**
 * La instal·lació elèctrica dels llums d'un mòdul, vista de davant (x, y del mòdul, mm): l'alimentador, cada làmpada i el
 * recorregut del seu cable fins a l'alimentador (amb la llargada), l'interruptor i la sortida del cable de xarxa.
 */
export interface Wiring {
  driver: { x0: number; x1: number; y0: number; y1: number; name: string; article: string; where: string }
  lamps: { x: number; y: number; label: string }[]
  runs: { from: string; points: [number, number][]; length: number }[]
  switch?: { x: number; y: number; kind: "door" | "touch" }
  mains?: { x: number; y: number }
  /** Els forats que fa el recorregut (a més dels de les làmpades): per a la llegenda. */
  holes: { x: number; y: number; label: string }[]
  notes: string[]
}

/** La frontissa d'una porta de vidre: la triada (la seva placa al lateral) i on va. */
export type GlassHinge = { hinge: { spec: SlotSpec<"hinge">; item: HardwareItem }; side: "left" | "right"; panel?: VerticalRef; rowYs: number[]; zoneId?: string }
