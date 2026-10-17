import { needsSecondFace, processSummary } from "../process/processes"
import {
  EDGE_NUMBER,
  EDGE_SIDES,
  flatten,
  type EdgeBanding,
  type EdgeSide,
  type Grain,
  type Panel,
  type PanelRole,
} from "../model"

const ROLE_LABELS: Record<PanelRole, string> = {
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
  part: "Peça lliure",
  hardware: "Ferratge",
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
  "part",
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

/** Gira o emmiralla una peça en el seu pla: identitat, mirall esquerra/dreta, mirall dalt/baix i gir de 180°. */
const SIDE_MAPS: readonly Record<EdgeSide, EdgeSide>[] = [
  { left: "left", right: "right", bottom: "bottom", top: "top" },
  { left: "right", right: "left", bottom: "bottom", top: "top" },
  { left: "left", right: "right", bottom: "top", top: "bottom" },
  { left: "right", right: "left", bottom: "top", top: "bottom" },
]
/** Costats en l'ordre de la numeració del taller (1 dalt · 2 dreta · 3 baix · 4 esquerra). */
const BY_NUMBER: readonly EdgeSide[] = ["top", "right", "bottom", "left"]

/**
 * Cantells i inglets normalitzats: de les quatre maneres equivalents de posar la peça (mirall
 * esquerra/dreta, dalt/baix o girada 180°), la que deixa els cantells i després els inglets més
 * cap a 1 · 2 (dalt, dreta). Cantells i inglets es giren junts, així dues peces mirall (lateral
 * esquerre/dret) cauen a la mateixa fila i la fila diu el mateix per a totes.
 */
function canonicalSides(p: Pick<Panel, "edges" | "mitres">): { edges: EdgeBanding; mitres: EdgeSide[]; code: string } {
  let best: { edges: EdgeBanding; mitres: EdgeSide[]; code: string } | undefined
  for (const m of SIDE_MAPS) {
    const edges = { left: false, right: false, bottom: false, top: false } as EdgeBanding
    for (const s of EDGE_SIDES) if (p.edges[s]) edges[m[s]] = true
    const mitreSet = new Set((p.mitres ?? []).map((s) => m[s]))
    const code = BY_NUMBER.map((s) => (edges[s] ? "1" : "0")).join("") + BY_NUMBER.map((s) => (mitreSet.has(s) ? "1" : "0")).join("")
    if (!best || code > best.code) best = { edges, mitres: BY_NUMBER.filter((s) => mitreSet.has(s)), code }
  }
  return best!
}

/**
 * Clau d'agrupació. Cantells i inglets normalitzats (`canonicalSides`), de manera que dues peces
 * mirall (lateral esquerre/dret) cauen a la mateixa fila. Tot el que surt a la fila (processos,
 * inglets, forats de cantell, 2a cara) forma part de la clau, perquè sigui cert per a totes les
 * peces de la fila.
 */
function groupKey(p: Panel): string {
  const sides = canonicalSides(p)
  const edgeHoles = p.holes.filter((h) => h.face === "edge").length
  // Peces amb forma o talls (de qualsevol rol): només s'agrupen amb el mateix contorn i talls.
  const shape = p.outline || p.cutouts?.length ? JSON.stringify([p.outline ?? null, p.cutouts ?? null]) : ""
  // Peces lliures: a més, els mateixos mecanitzats.
  const machining = p.role === "part" ? `${p.holes.length}/${p.grooves.length + (p.pockets?.length ?? 0)}` : ""
  return [
    p.role,
    p.length,
    p.width,
    p.thickness,
    p.material,
    p.grain,
    sides.code,
    needsSecondFace(p) ? "B" : "",
    edgeHoles,
    p.assembly ?? "",
    p.push ? "push" : "",
    shape,
    machining,
  ].join("|")
}

/** Mil·límetres de cantell d'una peça. Amb contorn (`outline`) i els quatre cantells folrats, el perímetre real. */
export function edgeLengthOf(length: number, width: number, edges: EdgeBanding, outline?: Panel["outline"]): number {
  if (outline && EDGE_SIDES.every((s) => edges[s])) {
    const pts = flatten(outline)
    let per = 0
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length]!
      per += Math.hypot(nx - x, ny - y)
    })
    return per
  }
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
  // Contorn de cada fila (les peces lliures només s'agrupen amb el mateix contorn).
  const outlines = new Map<CutListItem, Panel["outline"]>()
  for (const p of panels) {
    const key = groupKey(p)
    const existing = groups.get(key)
    if (existing) {
      existing.qty += 1
      existing.panelIds.push(p.id)
      existing.holes += p.holes.length
      // Peces lliures: els seus noms («Prestatge 1, Prestatge 3»).
      if (p.role === "part" && !existing.label.split(", ").includes(p.label)) existing.label += `, ${p.label}`
      continue
    }
    // La fila es descriu amb els cantells i inglets normalitzats (els mateixos per a totes les peces).
    const sides = canonicalSides(p)
    const canon: Panel = { ...p, edges: sides.edges, mitres: sides.mitres.length ? sides.mitres : undefined }
    groups.set(key, {
      label: p.role === "part" ? p.label : ROLE_LABELS[p.role],
      role: p.role,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      material: p.material,
      grain: p.grain,
      edges: { ...sides.edges },
      edgeNumbers: EDGE_SIDES.filter((s) => sides.edges[s])
        .map((s) => EDGE_NUMBER[s])
        .sort((a, b) => a - b),
      processes: processSummary(canon),
      mitreNumbers: sides.mitres.map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b),
      edgeLength: 0,
      qty: 1,
      area: 0,
      panelIds: [p.id],
      holes: p.holes.length,
    })
    if (p.outline) outlines.set(groups.get(key)!, p.outline)
  }

  const items = [...groups.values()]
    .map((it) => ({
      ...it,
      area: round4((it.length * it.width * it.qty) / 1e6),
      edgeLength: round4((edgeLengthOf(it.length, it.width, it.edges, outlines.get(it)) * it.qty) / 1000),
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
