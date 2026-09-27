import { EDGE_NUMBER, EDGE_SIDES, type Panel, type PanelRole } from "../model"
import type { Join, Piece, Role, Side, Solid, UnifiedData } from "./unified.types"

/**
 * Camí B: genera el contracte `UnifiedData` del taller directament des de les
 * peces del configurador, sense passar per TopSolid. Sense nesting encara:
 * `boards` i `tabs` buits, `tab` = 0 i posició al tauler a 0.
 */

export interface UnifiedOptions {
  /** Nom del moble (camp `mueble`). */
  name: string
  /** Índex del mòdul dins del moble, per a la ref `A.<mòdul>.<tipus>.<n>`. */
  module?: number
}

const ROLE_3D: Record<PanelRole, Role> = {
  side: "lateral",
  bottom: "horizontal",
  top: "horizontal",
  shelf: "horizontal",
  back: "back",
  door: "front",
}

/** Lletra de tipus per a la ref: L lateral · H horitzontal · T trassera · F front. */
const ROLE_LETTER: Record<Role, string> = {
  lateral: "L",
  horizontal: "H",
  back: "T",
  front: "F",
  hw: "W",
}

function sideOf(p: Panel): Side {
  if (p.role !== "side") return null
  return p.id.endsWith("left") ? "e" : "d"
}

/** Caixa englobant de la peça en coordenades del moble. */
export function panelAabb(p: Panel): { min: [number, number, number]; size: [number, number, number] } {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const cx of [0, p.length])
    for (const cy of [0, p.width])
      for (const cz of [0, p.thickness])
        for (let i = 0; i < 3; i++) {
          const v = o[i]! + cx * x[i]! + cy * y[i]! + cz * z[i]!
          min[i] = Math.min(min[i]!, v)
          max[i] = Math.max(max[i]!, v)
        }
  const r = (v: number) => Math.round(v * 100) / 100
  return {
    min: [r(min[0]), r(min[1]), r(min[2])],
    size: [r(max[0] - min[0]), r(max[1] - min[1]), r(max[2] - min[2])],
  }
}

function toSolid(p: Panel): Solid {
  const { min, size } = panelAabb(p)
  const role = ROLE_3D[p.role]
  return {
    min,
    size,
    role,
    side: sideOf(p),
    label: p.name,
    mach: p.holes
      .filter((h) => h.face !== "edge")
      .map((h) => ({
        u: h.x,
        v: h.y,
        r: h.diameter / 2,
        depth: h.depth,
        side: h.face === "A" ? "a" : "b",
        ...(h.tag ? { fit: h.tag } : {}),
      })),
    edges: p.holes
      .filter((h) => h.face === "edge" && h.edge !== undefined)
      .map((h) => ({
        u: h.x,
        v: h.y,
        r: h.diameter / 2,
        depth: h.depth,
        edge: EDGE_NUMBER[h.edge!],
        ...(h.tag ? { fit: h.tag } : {}),
      })),
    pockets: p.grooves.map((g) => ({
      depth: g.depth,
      side: g.face === "A" ? "a" : "b",
      pts: [
        [g.x, g.y],
        [g.x + g.w, g.y],
        [g.x + g.w, g.y + g.h],
        [g.x, g.y + g.h],
      ] as [number, number][],
    })),
  }
}

function toPiece(p: Panel, index: number, ref: string): Piece {
  const role = ROLE_3D[p.role]
  const lam: (string | null)[] = [1, 2, 3, 4].map((n) => {
    const side = EDGE_SIDES.find((s) => EDGE_NUMBER[s] === n)!
    return p.edges[side] ? p.material : null
  })
  return {
    ref,
    name: p.name,
    thick: p.thickness,
    tab: 0,
    x: 0,
    y: 0,
    angle: 0,
    L: p.length,
    W: p.width,
    r3d: role,
    side3d: sideOf(p),
    dim: [p.length, p.width],
    solid: index,
    match: "exact",
    mec2: null,
    lam,
  }
}

/** Unions deduïdes dels forats: espigues lateral↔base/sostre i frontisses porta↔lateral. */
export function deriveJoins(panels: Panel[]): Join[] {
  const idx = (pred: (p: Panel) => boolean) => panels.findIndex(pred)
  const left = idx((p) => p.id === "side-left")
  const right = idx((p) => p.id === "side-right")
  const joins: Join[] = []

  for (const role of ["bottom", "top"] as const) {
    const h = idx((p) => p.role === role)
    if (h < 0) continue
    const perSide = panels[h]!.holes.filter((x) => x.tag === "dowel").length / 2
    if (left >= 0) joins.push({ a: left, b: h, fit: "espiga", n: perSide })
    if (right >= 0) joins.push({ a: right, b: h, fit: "espiga", n: perSide })
  }

  panels.forEach((p, i) => {
    if (p.role !== "door") return
    const cups = p.holes.filter((h) => h.tag === "hinge").length
    // Porta única o esquerra: frontisses al lateral esquerre; porta dreta: al dret.
    const side = p.id === "door-right" ? right : left
    if (side >= 0 && cups > 0) joins.push({ a: i, b: side, fit: "frontissa", n: cups })
  })

  return joins
}

export function toUnifiedData(panels: Panel[], options: UnifiedOptions): UnifiedData {
  const module = options.module ?? 1
  const solids = panels.map(toSolid)
  const pieces = panels.map((p, i) => {
    const letter = ROLE_LETTER[ROLE_3D[p.role]]
    return toPiece(p, i, `A.${module}.${letter}.${i + 1}`)
  })

  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const s of solids)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, s.min[i]!)
      max[i] = Math.max(max[i]!, s.min[i]! + s.size[i]!)
    }
  const ctr: [number, number, number] = solids.length
    ? [(min[0]! + max[0]!) / 2, (min[1]! + max[1]!) / 2, (min[2]! + max[2]!) / 2]
    : [0, 0, 0]

  const material = panels.find((p) => p.role !== "back")?.material ?? ""

  return {
    mueble: options.name,
    material,
    boards: [],
    tabs: [],
    pieces,
    solids,
    ctr,
    joins: deriveJoins(panels),
  }
}
