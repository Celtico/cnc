import type { Groove, Hole, Panel } from "../model"

/**
 * Writer DXF R12 (AC1009) ASCII, escrit a mà.
 *
 * - Una peça per BLOCK (nom = id de la peça), inserida a ENTITIES sense encavalcar.
 * - Contorn: POLYLINE tancada a la capa CONTOUR.
 * - Forats de cara A: CIRCLE a DRILL_D{Ø}_P{prof}. Cara B: DRILL_B_D{Ø}_P{prof}.
 * - Forats de cantell (horitzontals): CIRCLE al punt d'entrada, capa DRILL_H_D{Ø}_P{prof}.
 * - Ranures: POLYLINE tancada a GROOVE_W{ample}_P{prof}.
 * - Etiqueta amb el nom a la capa LABEL.
 * Coordenades en mm, sense escalar.
 */

export const LAYER_CONTOUR = "CONTOUR"
export const LAYER_LABEL = "LABEL"

export interface DxfOptions {
  /** Separació entre peces en mm. */
  gap?: number
  /** Amplada màxima d'una fila abans de saltar a la següent. */
  maxRowWidth?: number
  /** Escriure el nom de la peça com a TEXT. */
  labels?: boolean
}

const EOL = "\r\n"

/** Format numèric DXF: fins a 4 decimals, sempre amb punt decimal. */
export function fmt(n: number): string {
  const s = (Math.round(n * 10000) / 10000).toString()
  return s.includes(".") ? s : `${s}.0`
}

/** Número per a noms de capa: "5", "22.5". */
const num = (n: number): string => (Math.round(n * 100) / 100).toString()

export function holeLayer(h: Hole): string {
  const suffix = `D${num(h.diameter)}_P${num(h.depth)}`
  if (h.face === "edge") return `DRILL_H_${suffix}`
  if (h.face === "B") return `DRILL_B_${suffix}`
  return `DRILL_${suffix}`
}

export function grooveLayer(g: Groove): string {
  const width = Math.min(g.w, g.h)
  const prefix = g.face === "B" ? "GROOVE_B" : "GROOVE"
  return `${prefix}_W${num(width)}_P${num(g.depth)}`
}

/** Totes les capes que fa servir un conjunt de peces, ordenades. */
export function dxfLayers(panels: Panel[], labels = true): string[] {
  const set = new Set<string>([LAYER_CONTOUR])
  if (labels) set.add(LAYER_LABEL)
  for (const p of panels) {
    for (const h of p.holes) set.add(holeLayer(h))
    for (const g of p.grooves) set.add(grooveLayer(g))
  }
  return [...set].sort()
}

export function blockName(panel: Panel): string {
  return panel.id.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
}

// --- Emissió de parells codi/valor ---------------------------------------------

type Pair = [number, string]

function pairs(...items: Pair[]): string {
  return items.map(([code, value]) => `${code}${EOL}${value}`).join(EOL) + EOL
}

function polyline(layer: string, pts: [number, number][]): string {
  let out = pairs([0, "POLYLINE"], [8, layer], [66, "1"], [70, "1"], [10, "0.0"], [20, "0.0"], [30, "0.0"])
  for (const [x, y] of pts) {
    out += pairs([0, "VERTEX"], [8, layer], [10, fmt(x)], [20, fmt(y)], [30, "0.0"])
  }
  out += pairs([0, "SEQEND"], [8, layer])
  return out
}

function circle(layer: string, x: number, y: number, radius: number): string {
  return pairs([0, "CIRCLE"], [8, layer], [10, fmt(x)], [20, fmt(y)], [30, "0.0"], [40, fmt(radius)])
}

function text(layer: string, x: number, y: number, height: number, value: string): string {
  return pairs(
    [0, "TEXT"],
    [8, layer],
    [10, fmt(x)],
    [20, fmt(y)],
    [30, "0.0"],
    [40, fmt(height)],
    [1, value],
  )
}

/** Entitats d'una peça amb l'origen a (0,0). */
export function panelEntities(panel: Panel, labels = true): string {
  const { length: L, width: W } = panel
  let out = polyline(LAYER_CONTOUR, [
    [0, 0],
    [L, 0],
    [L, W],
    [0, W],
  ])
  for (const g of panel.grooves) {
    out += polyline(grooveLayer(g), [
      [g.x, g.y],
      [g.x + g.w, g.y],
      [g.x + g.w, g.y + g.h],
      [g.x, g.y + g.h],
    ])
  }
  for (const h of panel.holes) {
    out += circle(holeLayer(h), h.x, h.y, h.diameter / 2)
  }
  if (labels) {
    const h = Math.max(5, Math.min(20, W / 12))
    out += text(LAYER_LABEL, h, h, h, `${panel.name} ${fmt(L)}x${fmt(W)}x${fmt(panel.thickness)}`)
  }
  return out
}

interface Placed {
  panel: Panel
  x: number
  y: number
}

/** Col·loca les peces en files d'esquerra a dreta sense encavalcar-les. */
export function arrangePanels(panels: Panel[], gap: number, maxRowWidth: number): Placed[] {
  const placed: Placed[] = []
  let x = 0
  let y = 0
  let rowH = 0
  for (const panel of panels) {
    if (x > 0 && x + panel.length > maxRowWidth) {
      x = 0
      y += rowH + gap
      rowH = 0
    }
    placed.push({ panel, x, y })
    x += panel.length + gap
    rowH = Math.max(rowH, panel.width)
  }
  return placed
}

function header(extMax: [number, number]): string {
  return pairs(
    [0, "SECTION"],
    [2, "HEADER"],
    [9, "$ACADVER"],
    [1, "AC1009"],
    [9, "$EXTMIN"],
    [10, "0.0"],
    [20, "0.0"],
    [30, "0.0"],
    [9, "$EXTMAX"],
    [10, fmt(extMax[0])],
    [20, fmt(extMax[1])],
    [30, "0.0"],
    [0, "ENDSEC"],
  )
}

function tables(layers: string[]): string {
  let out = pairs([0, "SECTION"], [2, "TABLES"])
  out += pairs(
    [0, "TABLE"],
    [2, "LTYPE"],
    [70, "1"],
    [0, "LTYPE"],
    [2, "CONTINUOUS"],
    [70, "64"],
    [3, "Solid line"],
    [72, "65"],
    [73, "0"],
    [40, "0.0"],
    [0, "ENDTAB"],
  )
  // La capa "0" sempre hi ha de ser: BLOCK/INSERT hi van.
  const all = ["0", ...layers.filter((l) => l !== "0")]
  out += pairs([0, "TABLE"], [2, "LAYER"], [70, String(all.length)])
  all.forEach((name, i) => {
    out += pairs([0, "LAYER"], [2, name], [70, "64"], [62, String((i % 7) + 1)], [6, "CONTINUOUS"])
  })
  out += pairs([0, "ENDTAB"])
  out += pairs([0, "ENDSEC"])
  return out
}

function blocks(panels: Panel[], labels: boolean): string {
  let out = pairs([0, "SECTION"], [2, "BLOCKS"])
  for (const p of panels) {
    const name = blockName(p)
    out += pairs([0, "BLOCK"], [8, "0"], [2, name], [70, "0"], [10, "0.0"], [20, "0.0"], [30, "0.0"], [3, name])
    out += panelEntities(p, labels)
    out += pairs([0, "ENDBLK"], [8, "0"])
  }
  out += pairs([0, "ENDSEC"])
  return out
}

function entities(placed: Placed[]): string {
  let out = pairs([0, "SECTION"], [2, "ENTITIES"])
  for (const { panel, x, y } of placed) {
    out += pairs([0, "INSERT"], [8, "0"], [2, blockName(panel)], [10, fmt(x)], [20, fmt(y)], [30, "0.0"])
  }
  out += pairs([0, "ENDSEC"])
  return out
}

/** Genera un DXF R12 amb totes les peces, cadascuna en el seu bloc. */
export function toDxf(panels: Panel[], options: DxfOptions = {}): string {
  const gap = options.gap ?? 100
  const maxRowWidth = options.maxRowWidth ?? 3000
  const labels = options.labels ?? true

  const placed = arrangePanels(panels, gap, maxRowWidth)
  const extMax: [number, number] = [
    Math.max(0, ...placed.map((p) => p.x + p.panel.length)),
    Math.max(0, ...placed.map((p) => p.y + p.panel.width)),
  ]

  return (
    header(extMax) +
    tables(dxfLayers(panels, labels)) +
    blocks(panels, labels) +
    entities(placed) +
    pairs([0, "EOF"])
  )
}

/** DXF d'una sola peça, amb l'origen a la cantonada inferior esquerra. */
export function panelToDxf(panel: Panel, options: Omit<DxfOptions, "gap" | "maxRowWidth"> = {}): string {
  return toDxf([panel], { ...options, gap: 0 })
}

// --- Lector mínim per a tests i validació --------------------------------------

export interface DxfEntity {
  type: string
  layer: string | null
  values: Record<number, string[]>
}

/** Divideix el text en parells (codi, valor). */
export function parseDxfPairs(dxf: string): Pair[] {
  const lines = dxf.split(/\r?\n/)
  if (lines.at(-1) === "") lines.pop()
  const out: Pair[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    out.push([Number(lines[i]!.trim()), lines[i + 1]!])
  }
  return out
}

/** Entitats de les seccions BLOCKS i ENTITIES (POLYLINE, VERTEX, CIRCLE, TEXT, INSERT...). */
export function parseDxfEntities(dxf: string): DxfEntity[] {
  const result: DxfEntity[] = []
  let section: string | null = null
  let current: DxfEntity | null = null
  const ps = parseDxfPairs(dxf)
  for (let i = 0; i < ps.length; i++) {
    const [code, value] = ps[i]!
    if (code === 0) {
      if (current) result.push(current)
      current = null
      if (value === "SECTION") {
        section = ps[i + 1]?.[1] ?? null
        continue
      }
      if (value === "ENDSEC") {
        section = null
        continue
      }
      if (section === "BLOCKS" || section === "ENTITIES") {
        current = { type: value, layer: null, values: {} }
      }
      continue
    }
    if (current) {
      if (code === 8) current.layer = value
      ;(current.values[code] ??= []).push(value)
    }
  }
  if (current) result.push(current)
  return result
}
