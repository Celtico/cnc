import type { BPt } from "../../model"
import type { Machine, MachineTool } from "../../model/machine"
import type { XcsPostProcess } from "./panel"
import type { XcsOp } from "./script"

/** Tipus del programa per tauler (nesting) i el pas de coordenades de la peça al tauler. */

/** Gir de la peça al tauler (antihorari, vist des de dalt). El nesting en fa servir 0 i 90. Sense mirall. */
export type NestAngle = 0 | 90 | 180 | 270

/** Col·locació: cantonada de baix a l'esquerra de la petjada al tauler, gir i mides de la peça (L = u, A = v). */
export interface PartPlace {
  x: number
  y: number
  angle: NestAngle
  length: number
  width: number
}

/**
 * Punt (u, v) de la peça (cara A amunt) → punt del tauler. Gir antihorari al voltant de la cantonada de la
 * petjada (el mateix que `localToBoard` del CSV): 90° → (A − v, u). Un gir conserva el sentit dels contorns
 * (antihorari segueix antihorari) i el signe dels bulges.
 */
export function toBoard(pl: PartPlace, u: number, v: number): [number, number] {
  const { x, y, length: L, width: W } = pl
  if (pl.angle === 90) return [x + W - v, y + u]
  if (pl.angle === 180) return [x + L - u, y + W - v]
  if (pl.angle === 270) return [x + v, y + L - u]
  return [x + u, y + v]
}

export const toBoardPts = (pl: PartPlace, pts: BPt[]): BPt[] => pts.map((p) => (p.length > 2 ? [...toBoard(pl, p[0], p[1]), p[2]!] : toBoard(pl, p[0], p[1])))

export type NestStage = "drill" | "groove" | "inner" | "outer"
export const STAGES: NestStage[] = ["drill", "groove", "inner", "outer"]

/** Un mecanitzat del programa del tauler: punts en coordenades del tauler. */
export interface NestOp extends XcsOp {
  ref: string
  stage: NestStage
}

export interface NestPart {
  ref: string
  panelId: string
  label: string
  name: string
  /** Cantonada de la petjada, mida al tauler i gir. */
  x: number
  y: number
  w: number
  h: number
  angle: NestAngle
  /** Centre (etiqueta). */
  cx: number
  cy: number
  /** Àrea real de la peça (amb forma, la del contorn). */
  area: number
}

export interface NestSheetXcs {
  file: string
  /** Nom de la peça de treball (el tauler) al programa: el mateix que el tauler del CSV, `Melamina_blanca_19#01`. */
  workpiece: string
  /** Número del tauler (1..n). */
  tab: number
  material: string
  thickness: number
  w: number
  h: number
  /** Aprofitament 0..1. */
  efficiency: number
  parts: NestPart[]
  ops: NestOp[]
  text: string
}

export interface NestPanelInfo {
  ref: string
  label: string
  /** Tauler on va (sense: no hi cap). */
  tab?: number
  route: string
  postProcesses: XcsPostProcess[]
}

export interface XcsNestExport {
  files: { name: string; text: string }[]
  /** Codificació dels .xcs (la de la màquina): `xcsZip` la fa servir. */
  encoding: NonNullable<Machine["xcsEncoding"]>
  sheets: NestSheetXcs[]
  panels: NestPanelInfo[]
  warnings: string[]
  missingTool: number
  postProcessPanels: number
  programs: number
  /** Refs de les peces que no caben a cap tauler. */
  unplaced: string[]
  spacing: number
  /** La fresa que fixa la separació (`cncNestOptions`), si el nesting es va fer amb aquesta separació. */
  tool?: MachineTool
}

export interface Feat {
  stage: NestStage
  /** Agrupa per eina (menys canvis d'eina). */
  key: string
  start: [number, number]
  end: [number, number]
  /** Contorns: àrea de la peça. */
  area: number
  /** Comentari del grup (la broca automàtica). */
  groupNote?: string
  /**
   * Eina del grup per al comentari `//BROCA PLANA <nom>` / `//FRESA PLANA <nom>` que la precedeix (com el programa real del
   * taller: el parser del taller, `parseXcs`, atribueix els forats a l'últim comentari d'eina).
   */
  tool: { kind: "BROCA" | "FRESA"; name: string }
  /** Contorns de les peces petites: passada n de m (els desbastos van abans, la final amb les petites). */
  pass?: { index: number; count: number }
  /** Contorn d'una peça petita (`isSmallPart`): la passada final (o l'única) va amb les petites, al final o al principi. */
  small?: boolean
  lines: string[]
  op: NestOp
}
