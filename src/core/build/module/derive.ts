import { hasBottom, zoneBacks, type PNode, type Module, type Zone } from "../../model"
import type { ZoneRect } from "../layout"

/** Mides derivades de la carcassa. */
export interface Derived {
  t: number
  tb: number
  W: number
  H: number
  D: number
  sideDepth: number
  sideZ0: number
  backInnerZ: number
  availDepth: number
  /** Llum interior del mòdul. */
  interior: ZoneRect
  hasBase: boolean
  hasTop: boolean
  /** Y de la cara inferior de la base (0 o alçada del sòcol). */
  baseY: number
  /** Tapa a inglet amb els laterals (a cada costat on hi ha lateral). */
  mitreTop: boolean
  /** Base a inglet amb els laterals (quan la base és a baix de tot dels laterals: no amb sòcol). */
  mitreBottom: boolean
  /**
   * Fronts de calaix a inglet amb els laterals: cantonades a inglet, fronts recobrents i només
   * calaixos (les portes, en obrir-se, toparien amb el lateral). Els laterals arriben fins a la
   * cara dels fronts amb el cantell de davant a 45°; els fronts, de fora a fora.
   */
  mitreFronts: boolean
  /** Fronts encastats (dins de la llum) en lloc de recobrents. */
  inset: boolean
  /** Tauler de taula: tapa per sobre dels laterals, amb voladís i forma. */
  tableTop: { overhang: number; shape?: PNode[] } | null
  /** Alçada dels laterals (més curts si la tapa hi va per sobre). */
  sideH: number
  /** Parets buides: gruix aparent (null si són massisses). */
  hollow: number | null
  /** Gruix de cada paret exterior (el del tauler o l'aparent si és buida). */
  ws: number
  wb: number
  wt: number
  /** Z de la cara de davant dels fronts (encastats: el davant de la caixa). */
  frontZ: number
}

export function derive(m: Module): Derived {
  const c = m.carcass
  const t = c.thickness
  const tb = c.backThickness
  const { width: W, height: H, depth: D } = c
  // Un mòdul sense fons amb alguna zona de fons cargolat (per decisió de l'usuari, 2026-10-21: «si en interior te un
  // cargolat no miris el principal»): la caixa deixa el lloc del fons al darrere, com un mòdul cargolat.
  const screwed = c.back === "screwed" || (c.back === "none" && [...zoneBacks(m).values()].some((b) => b.kind === "screwed"))
  const sideDepth = screwed ? D - tb : D
  const sideZ0 = D - sideDepth
  // Encastat: entre laterals, a `backInsetSetback` del darrere; l'interior comença a la seva cara de davant.
  const backInnerZ = c.back === "groove" ? c.backSetback + tb : screwed ? tb : c.back === "inset" ? (c.backInsetSetback ?? 0) + tb : 0
  // «Sense base» (`noBottom`, o el `open` d'abans): cap peça de baix; amb sòcol, l'interior comença a dalt del sòcol.
  const hasBase = hasBottom(c)
  const hasTop = c.top.kind !== "none"
  const baseY = c.base.kind === "plinth" ? c.base.height : 0
  // Paret buida: cal lloc per a dues pells i un llistó (almenys 6 mm entre pells).
  const tableTop = c.tableTop && c.top.kind === "full" ? c.tableTop : null
  const hollow = c.hollow && c.hollow.thickness >= 2 * t + 6 ? c.hollow.thickness : null
  const ws = hollow ?? t
  const wb = hollow ?? t
  const wt = hollow && c.top.kind === "full" && !tableTop ? hollow : t
  return {
    t,
    tb,
    W,
    H,
    D,
    sideDepth,
    sideZ0,
    backInnerZ,
    availDepth: D - backInnerZ,
    interior: {
      x0: c.sides.left ? ws : 0,
      x1: c.sides.right ? W - ws : W,
      y0: hasBase ? baseY + wb : baseY,
      y1: hasTop ? H - wt : H,
    },
    hasBase,
    hasTop,
    baseY,
    mitreTop: !hollow && !tableTop && c.joint === "mitre" && hasTop && (c.sides.left || c.sides.right),
    mitreBottom: !hollow && c.joint === "mitre" && hasBase && baseY === 0 && (c.sides.left || c.sides.right),
    mitreFronts: !hollow && c.joint === "mitre" && m.fronts.style !== "inset" && (c.sides.left || c.sides.right) && onlyDrawers(m.root),
    inset: m.fronts.style === "inset",
    frontZ: m.fronts.style === "inset" ? D : D + t,
    tableTop,
    sideH: tableTop ? H - t : H,
    hollow,
    ws,
    wb,
    wt,
  }
}

/** Tots els fronts del mòdul són calaixos (n'hi ha almenys un). */
function onlyDrawers(root: Zone): boolean {
  let drawers = 0
  let other = 0
  const walk = (z: Zone) => {
    if (z.front) {
      if (z.front.kind === "drawers") drawers++
      else other++
    }
    z.split?.children.forEach(walk)
  }
  walk(root)
  return drawers > 0 && other === 0
}
