import { processSummary } from "../process/processes"
import {
  EDGE_NUMBER,
  EDGE_SIDES,
  type EdgeBanding,
  type Grain,
  type Panel,
  type PanelRole,
} from "../model"

export const ROLE_LABELS: Record<PanelRole, string> = {
  side: "Lateral",
  bottom: "Base",
  top: "Sostre",
  back: "Fons",
  shelf: "Prestatge",
  door: "Porta",
  divider: "Divisor",
  fixedShelf: "Prestatge fix",
  plinth: "Sòcol",
  drawerFront: "Front calaix",
  drawerSide: "Lateral calaix",
  drawerBack: "Darrere calaix",
  drawerBottom: "Fons calaix",
  flap: "Abatible",
  grille: "Reixeta",
  hatch: "Trapa",
  panel: "Front fix",
  worktop: "Taulell",
  spacer: "Llistó interior",
  facing: "Tira frontal",
}

export interface CutListItem {
  /** Nom de grup: "Lateral", "Porta"... */
  label: string
  role: PanelRole
  length: number
  width: number
  thickness: number
  material: string
  grain: Grain
  edges: EdgeBanding
  /** Cantells folrats en numeració del taller (1 dalt · 2 dreta · 3 baix · 4 esquerra). */
  edgeNumbers: number[]
  /** Post-processos després del nesting, en ordre («Inglet 45° (cantell 2) → Cantell (1+3)»). */
  processes: string
  /** Cantells a inglet (45°) en la mateixa numeració. */
  mitreNumbers: number[]
  /** Metres lineals de cantell de la fila (qty inclosa). */
  edgeLength: number
  qty: number
  /** Superfície total de la fila en m². */
  area: number
  /** Ids de les peces agrupades. */
  panelIds: string[]
  /** Nombre total de forats de la fila. */
  holes: number
}

export interface CutList {
  items: CutListItem[]
  totalPanels: number
  totalArea: number
  totalEdgeLength: number
}

const ROLE_ORDER: PanelRole[] = [
  "side",
  "divider",
  "facing",
  "spacer",
  "bottom",
  "top",
  "fixedShelf",
  "shelf",
  "plinth",
  "worktop",
  "door",
  "flap",
  "grille",
  "hatch",
  "panel",
  "drawerFront",
  "drawerSide",
  "drawerBack",
  "drawerBottom",
  "back",
]

/**
 * Clau d'agrupació. Els cantells es comparen per nombre de costats llargs i curts
 * folrats, de manera que dues peces mirall (lateral esquerre/dret) cauen a la
 * mateixa fila.
 */
function groupKey(p: Panel): string {
  const longEdges = Number(p.edges.top) + Number(p.edges.bottom)
  const shortEdges = Number(p.edges.left) + Number(p.edges.right)
  return [p.role, p.length, p.width, p.thickness, p.material, p.grain, longEdges, shortEdges, (p.mitres ?? []).length, p.assembly ?? ""].join("|")
}

/** Mil·límetres de cantell d'una peça. */
export function edgeLengthOf(length: number, width: number, edges: EdgeBanding): number {
  let mm = 0
  if (edges.top) mm += length
  if (edges.bottom) mm += length
  if (edges.left) mm += width
  if (edges.right) mm += width
  return mm
}

const round4 = (v: number): number => Math.round(v * 10000) / 10000

/** Agrupa les peces idèntiques (rol, mides, material, veta i cantells) en files. */
export function toCutList(panels: Panel[]): CutList {
  const groups = new Map<string, CutListItem>()
  for (const p of panels) {
    const key = groupKey(p)
    const existing = groups.get(key)
    if (existing) {
      existing.qty += 1
      existing.panelIds.push(p.id)
      existing.holes += p.holes.length
      continue
    }
    groups.set(key, {
      label: ROLE_LABELS[p.role],
      role: p.role,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      material: p.material,
      grain: p.grain,
      edges: { ...p.edges },
      edgeNumbers: EDGE_SIDES.filter((s) => p.edges[s])
        .map((s) => EDGE_NUMBER[s])
        .sort((a, b) => a - b),
      processes: processSummary(p),
      mitreNumbers: (p.mitres ?? []).map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b),
      edgeLength: 0,
      qty: 1,
      area: 0,
      panelIds: [p.id],
      holes: p.holes.length,
    })
  }

  const items = [...groups.values()]
    .map((it) => ({
      ...it,
      area: round4((it.length * it.width * it.qty) / 1e6),
      edgeLength: round4((edgeLengthOf(it.length, it.width, it.edges) * it.qty) / 1000),
    }))
    .sort((a, b) => {
      const ra = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
      if (ra !== 0) return ra
      return b.length * b.width - a.length * a.width
    })

  return {
    items,
    totalPanels: panels.length,
    totalArea: round4(items.reduce((s, i) => s + i.area, 0)),
    totalEdgeLength: round4(items.reduce((s, i) => s + i.edgeLength, 0)),
  }
}
