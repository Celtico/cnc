import { NO_EDGES, type EdgeSide, type HardwareItem, type Panel, type Vec3 } from "../model"
import { X, Y, Z, neg, placement, r } from "./geometry"
import { plinthProfileSpec } from "./hardware"
import type { LinearPiece } from "./linearOrders"

/**
 * **Sòcol perimetral** (per decisió de l'usuari, 2026-10-15: «poder ficar sòcol als laterals» de l'illa): els trams del
 * sòcol al voltant d'un rectangle (la base d'un mòdul amb potes o una fila de baixos), un per costat triat, amb les
 * cantonades a tope (el davant i el darrere passen per davant dels laterals) o a inglet (tots de fora a fora, tallats a
 * 45°), de fusta (peces de CNC) o d'alumini (ferratge per metres: `extras` de només veure i la comanda). El fan servir el
 * sòcol de cada tram de la cuina (`tramPlinth.ts`) i el de la base «Potes» del moble normal (`MountingBuilder.buildLegPlinth`). Pur.
 */

type Side = "front" | "back" | "left" | "right"

export interface PlinthFrame {
  /** Cares de fora del sòcol (mm del sistema on es construeix): x0 (esquerra) … x1 (dreta), zBack … zFront. */
  x0: number
  x1: number
  zBack: number
  zFront: number
  /** De terra (y0) amunt, `h` d'alçada; `t` = gruix del tauler o del perfil. */
  y0: number
  h: number
  t: number
  sides: Record<Side, boolean>
  corners: "butt" | "mitre"
}

interface PlinthPiece {
  side: Side
  length: number
  /** La cara de fora a z = 0 local (la llarga de l'inglet, `Panel.mitres`). */
  placement: Panel["placement"]
  mitres: EdgeSide[]
  /** Cantells vistos d'una unió a tope (l'extrem del davant o del darrere on topa un lateral). */
  ends: EdgeSide[]
}

/**
 * Els trams. Locals: x al llarg, y amunt, z (gruix) cap a dins; la cara de fora a z = 0. Davant: d'x1 a x0 (vist de
 * davant, d'esquerra a dreta); darrere: d'x0 a x1; esquerre: del davant al darrere; dret: del darrere al davant.
 */
export function plinthPieces(f: PlinthFrame): PlinthPiece[] {
  const { sides: s, t } = f
  const mitre = f.corners === "mitre"
  const out: PlinthPiece[] = []
  const W = r(f.x1 - f.x0)
  // Laterals: entre el davant i el darrere (a tope) o de fora a fora (a inglet).
  const zA = s.back && !mitre ? f.zBack + t : f.zBack
  const zB = s.front && !mitre ? f.zFront - t : f.zFront
  const L = r(zB - zA)
  const at = (side: Side, length: number, origin: Vec3, x: Vec3, z: Vec3, mitres: EdgeSide[], ends: EdgeSide[]) => {
    if (length > 0.5) out.push({ side, length, placement: placement([r(origin[0]), r(origin[1]), r(origin[2])], x, Y, z, neg(z)), mitres, ends })
  }
  // Extrems locals: «left» = x 0 local, «right» = el final.
  if (s.front) at("front", W, [f.x1, f.y0, f.zFront], neg(X), neg(Z), mitre ? [...(s.right ? (["left"] as const) : []), ...(s.left ? (["right"] as const) : [])] : [], mitre ? [] : [...(s.right ? (["left"] as const) : []), ...(s.left ? (["right"] as const) : [])])
  if (s.back) at("back", W, [f.x0, f.y0, f.zBack], X, Z, mitre ? [...(s.left ? (["left"] as const) : []), ...(s.right ? (["right"] as const) : [])] : [], mitre ? [] : [...(s.left ? (["left"] as const) : []), ...(s.right ? (["right"] as const) : [])])
  if (s.left) at("left", L, [f.x0, f.y0, zB], neg(Z), X, mitre ? [...(s.front ? (["left"] as const) : []), ...(s.back ? (["right"] as const) : [])] : [], [])
  if (s.right) at("right", L, [f.x1, f.y0, zA], Z, neg(X), mitre ? [...(s.back ? (["left"] as const) : []), ...(s.front ? (["right"] as const) : [])] : [], [])
  return out
}

/** Cantonades entre dos trams (on n'hi ha un a cada costat). */
export function plinthCorners(s: Record<Side, boolean>): number {
  return [s.front && s.left, s.front && s.right, s.back && s.left, s.back && s.right].filter(Boolean).length
}

const LABEL: Record<Side, string> = { front: "Sòcol", back: "Sòcol darrere", left: "Sòcol esquerre", right: "Sòcol dret" }
const ID: Record<Side, string> = { front: "plinth", back: "plinth-back", left: "plinth-left", right: "plinth-right" }

/** Els trams de fusta com a peces de CNC (`socol`, rol `plinth`): veta al llarg, cantell a dalt, a baix i als extrems vistos. */
export function woodPlinthPanels(f: PlinthFrame, material: string, idPrefix = ""): Panel[] {
  return plinthPieces(f).map((p) => ({
    id: `${idPrefix}${ID[p.side]}`,
    name: "socol",
    label: LABEL[p.side],
    role: "plinth",
    length: p.length,
    width: r(f.h),
    thickness: f.t,
    material,
    grain: "x",
    edges: { ...NO_EDGES, top: true, bottom: true, ...Object.fromEntries(p.ends.map((e) => [e, true])) },
    holes: [],
    grooves: [],
    ...(p.mitres.length ? { mitres: p.mitres } : {}),
    placement: p.placement,
  }))
}

/**
 * Un sòcol d'alumini (`plinthProfile`): els trams a tope com a peces de només veure (rol `hardware`, del material de
 * l'item), un tros de la comanda per tram i les cantoneres. L'alçada és la del perfil. Els clips (amb `clipSpacing` 0,
 * l'estàndard): un a cada pota de cada tram (`legs`: les potes que té al darrere cada costat; dues si no es diu).
 */
export function aluPlinth(f: Omit<PlinthFrame, "t" | "h" | "corners">, item: HardwareItem, idPrefix = "", module?: number, legs: Partial<Record<Side, number>> = {}): { extras: Panel[]; pieces: LinearPiece[]; height: number } {
  const s = plinthProfileSpec(item)
  const frame: PlinthFrame = { ...f, t: s.depth, h: s.height, corners: "butt" }
  const parts = plinthPieces(frame)
  const corners = plinthCorners(f.sides)
  const extras: Panel[] = parts.map((p) => ({
    id: `${idPrefix}${ID[p.side]}-alu`,
    name: "ferratge",
    label: `${LABEL[p.side]} (${item.name})`,
    role: "hardware",
    length: p.length,
    width: s.height,
    thickness: s.depth,
    material: s.material,
    grain: "none",
    edges: { ...NO_EDGES },
    holes: [],
    grooves: [],
    placement: p.placement,
  }))
  const pieces: LinearPiece[] = parts.map((p, i) => ({
    item: { id: item.id, name: item.name, ...(item.ref ? { ref: item.ref } : {}), ...(item.maker ? { maker: item.maker } : {}), ...(item.linear ? { linear: item.linear } : {}) },
    length: p.length,
    stock: s.stock,
    clipSpacing: s.clipSpacing,
    clipEnd: s.clipEnd,
    ...(s.clipSpacing > 0 ? {} : { clips: legs[p.side] ?? 2 }),
    corners: i === 0 ? corners : 0,
    ...(module !== undefined ? { module } : {}),
  }))
  return { extras, pieces, height: s.height }
}
