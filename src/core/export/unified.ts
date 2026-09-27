import { EDGE_NUMBER, EDGE_SIDES, type Cutout, type Panel, type PanelRole } from "../model"
import type { Nesting } from "../nesting/nest"
import type { Board, Join, Piece, Role, Side, Solid, UnifiedData } from "./unified.types"

/**
 * Camí B: genera el contracte `UnifiedData` del taller directament des de les
 * peces del configurador, sense passar per TopSolid.
 *
 * Amb `nesting`: taulers i posicions reals (centre de peça i angle al tauler).
 * Sense: s'emet un **tauler virtual** per cada parella material/gruix (2800×2070 per
 * defecte) i totes les peces hi van a la cantonada (centre a L/2, W/2, angle 0), de
 * manera que el JSON passa igualment la validació de l'import del taller
 * (`piece.tab` ha d'existir a `boards`).
 */

export interface UnifiedOptions {
  /** Nom del moble (camp `mueble`). */
  name: string
  /** Índex del mòdul dins del moble, per a la ref `A.<mòdul>.<tipus>.<n>`. */
  module?: number
  /** Mida del tauler virtual (mm) quan no hi ha nesting. Per defecte 2800 × 2070. */
  sheet?: { w: number; h: number }
  /** Resultat del nesting: taulers i posicions reals. */
  nesting?: Nesting
}

/** Posició d'una peça al tauler: `x`/`y` és el centre de la peça, `angle` en graus. */
export interface PiecePosition {
  tab: number
  x: number
  y: number
  angle: number
}

export const DEFAULT_SHEET: { w: number; h: number } = { w: 2800, h: 2070 }

const ROLE_3D: Record<PanelRole, Role> = {
  side: "lateral",
  bottom: "horizontal",
  top: "horizontal",
  shelf: "horizontal",
  back: "back",
  door: "front",
  divider: "lateral",
  fixedShelf: "horizontal",
  plinth: "front",
  drawerFront: "front",
  drawerSide: "lateral",
  drawerBack: "back",
  drawerBottom: "horizontal",
  flap: "front",
  grille: "front",
  hatch: "front",
  panel: "front",
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
    pockets: [
      ...p.grooves.map((g) => ({
        depth: g.depth,
        side: g.face === "A" ? ("a" as const) : ("b" as const),
        pts: [
          [g.x, g.y],
          [g.x + g.w, g.y],
          [g.x + g.w, g.y + g.h],
          [g.x, g.y + g.h],
        ] as [number, number][],
      })),
      // Talls passants: pocket de tota la fondària (depth = gruix), des de la cara A.
      ...(p.cutouts ?? []).map((c) => ({ depth: p.thickness, side: "a" as const, pts: cutoutPolygon(c) })),
    ],
  }
}

/** Perímetre aproximat d'un tall passant (els arcs, per 8 segments per semicercle). */
export function cutoutPolygon(c: Cutout): [number, number][] {
  const r2 = (v: number): number => Math.round(v * 100) / 100
  if (c.kind === "rect") {
    return [
      [c.x, c.y],
      [c.x + c.w, c.y],
      [c.x + c.w, c.y + c.h],
      [c.x, c.y + c.h],
    ]
  }
  if (c.kind === "circle") {
    const rad = c.diameter / 2
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2
      return [r2(c.x + rad * Math.cos(a)), r2(c.y + rad * Math.sin(a))]
    })
  }
  const horizontal = c.w >= c.h
  const rad = Math.min(c.w, c.h) / 2
  const pts: [number, number][] = []
  const arc = (cx: number, cy: number, from: number): void => {
    for (let i = 0; i <= 8; i++) {
      const a = from + (i / 8) * Math.PI
      pts.push([r2(cx + rad * Math.cos(a)), r2(cy + rad * Math.sin(a))])
    }
  }
  if (horizontal) {
    arc(c.x + c.w - rad, c.y + rad, -Math.PI / 2)
    arc(c.x + rad, c.y + rad, Math.PI / 2)
  } else {
    arc(c.x + rad, c.y + c.h - rad, 0)
    arc(c.x + rad, c.y + rad, Math.PI)
  }
  return pts
}

function toPiece(p: Panel, index: number, ref: string, pos: PiecePosition): Piece {
  const role = ROLE_3D[p.role]
  const lam: (string | null)[] = [1, 2, 3, 4].map((n) => {
    const side = EDGE_SIDES.find((s) => EDGE_NUMBER[s] === n)!
    return p.edges[side] ? p.material : null
  })
  return {
    ref,
    name: p.name,
    thick: p.thickness,
    tab: pos.tab,
    x: pos.x,
    y: pos.y,
    angle: pos.angle,
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

interface BoardLayout {
  boards: Board[]
  positionOf: (p: Panel) => PiecePosition
}

/** Sense nesting: un tauler virtual per cada parella material/gruix, peces a la cantonada. */
export function virtualLayout(panels: Panel[], sheet = DEFAULT_SHEET): BoardLayout {
  const boards: Board[] = []
  const tabOf = new Map<string, number>()
  for (const p of panels) {
    const key = `${p.material}|${p.thickness}`
    if (tabOf.has(key)) continue
    const tab = boards.length + 1
    tabOf.set(key, tab)
    boards.push({
      tab,
      name: `${p.material} ${sheet.w}x${sheet.h} (sense nesting)`,
      w: sheet.w,
      h: sheet.h,
      thick: p.thickness,
    })
  }
  return {
    boards,
    positionOf: (p) => ({
      tab: tabOf.get(`${p.material}|${p.thickness}`) ?? 1,
      x: p.length / 2,
      y: p.width / 2,
      angle: 0,
    }),
  }
}

/**
 * Amb nesting: els taulers reals. Les peces que no han cabut van a un tauler extra
 * "(sense col·locar)" prou gran perquè el JSON continuï sent vàlid.
 */
export function nestedLayout(panels: Panel[], nesting: Nesting): BoardLayout {
  const boards: Board[] = nesting.boards.map((b) => ({
    tab: b.tab,
    name: `${b.material} ${b.w}x${b.h} #${String(b.tab).padStart(2, "0")}`,
    w: b.w,
    h: b.h,
    thick: b.thickness,
  }))
  const posOf = new Map<string, PiecePosition>()
  for (const b of nesting.boards)
    for (const pl of b.placements) posOf.set(pl.panelId, { tab: b.tab, x: pl.cx, y: pl.cy, angle: pl.angle })

  const unplaced = panels.filter((p) => nesting.unplaced.includes(p.id))
  if (unplaced.length > 0) {
    const tab = boards.length + 1
    const first = unplaced[0]!
    boards.push({
      tab,
      name: "(sense col·locar)",
      w: Math.max(...unplaced.map((p) => p.length)),
      h: Math.max(...unplaced.map((p) => p.width)),
      thick: first.thickness,
    })
    for (const p of unplaced) posOf.set(p.id, { tab, x: p.length / 2, y: p.width / 2, angle: 0 })
  }

  return {
    boards,
    positionOf: (p) => posOf.get(p.id) ?? { tab: boards[0]?.tab ?? 1, x: p.length / 2, y: p.width / 2, angle: 0 },
  }
}

export function toUnifiedData(panels: Panel[], options: UnifiedOptions): UnifiedData {
  const module = options.module ?? 1
  const layout = options.nesting
    ? nestedLayout(panels, options.nesting)
    : virtualLayout(panels, options.sheet ?? DEFAULT_SHEET)
  const { boards } = layout
  const solids = panels.map(toSolid)
  // Refs: A.<mòdul>.<tipus>.<n>, amb n consecutiu dins de cada mòdul.
  const counters = new Map<number, number>()
  const pieces = panels.map((p, i) => {
    const letter = ROLE_LETTER[ROLE_3D[p.role]]
    const mod = p.module ?? module
    const n = (counters.get(mod) ?? 0) + 1
    counters.set(mod, n)
    return toPiece(p, i, `A.${mod}.${letter}.${n}`, layout.positionOf(p))
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
    boards,
    tabs: boards.map((b) => b.tab),
    pieces,
    solids,
    ctr,
    joins: deriveJoins(panels),
  }
}
