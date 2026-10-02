import { z } from "zod"
import type { Panel } from "../model"

/**
 * Nesting simple de peces rectangulars sobre taulers, per franges ("shelf packing").
 *
 * No busca l'òptim: busca ser correcte i previsible.
 *  - Un grup de taulers per cada parella material/gruix.
 *  - Les peces s'ordenen per alçada de franja i àrea, i es col·loquen a la primera
 *    franja on caben (primer encaix); si no, s'obre una franja nova o un tauler nou.
 *  - La veta del tauler va al llarg del seu costat llarg (X). Una peça amb veta "x"
 *    es col·loca a 0°, amb veta "y" a 90°, i amb veta "none" en l'orientació que
 *    encaixi millor. Un tauler entrat dret (alt > ample, p. ex. 1220 × 2440) és el mateix
 *    tauler: es fa servir apaïsat (`landscape`), i els taulers del resultat sempre tenen
 *    `w ≥ h` (la veta en X).
 *  - Es respecta un marge al voltant del tauler i un kerf (gruix de fresa) entre peces.
 *
 * Coordenades del tauler: origen a la cantonada inferior esquerra, X cap a la dreta,
 * Y cap amunt, en mm.
 */

export const SheetSchema = z.object({
  w: z.number().positive(),
  h: z.number().positive(),
})
export type Sheet = z.infer<typeof SheetSchema>

export const STANDARD_SHEETS: readonly (Sheet & { label: string })[] = [
  { label: "2800 × 2070", w: 2800, h: 2070 },
  { label: "2440 × 1220", w: 2440, h: 1220 },
]

export const NestOptionsSchema = z.object({
  sheet: SheetSchema,
  /** Gruix de la fresa: separació mínima entre peces. */
  kerf: z.number().min(0).max(30),
  /** Marge de tauler que no s'aprofita (cantell danyat, subjecció). */
  margin: z.number().min(0).max(100),
  /** Mida de tauler per a materials concrets (la resta fan servir `sheet`). */
  sheetsByMaterial: z.record(z.string(), SheetSchema).optional(),
  /** Permet girar les peces 90° encara que tinguin veta. */
  ignoreGrain: z.boolean().optional(),
})
export type NestOptions = z.infer<typeof NestOptionsSchema>

export const DEFAULT_NEST_OPTIONS: NestOptions = {
  sheet: { w: 2800, h: 2070 },
  kerf: 6,
  margin: 10,
}

export interface Placement {
  panelId: string
  /** Cantonada inferior esquerra de la peça al tauler. */
  x: number
  y: number
  /** Petjada al tauler (ja rotada). */
  w: number
  h: number
  /** 0: el costat llarg de la peça va en X. 90: va en Y. */
  angle: 0 | 90
  /** Centre de la peça (per a etiquetes i per al contracte del taller). */
  cx: number
  cy: number
}

export interface NestedBoard {
  /** Numeració 1..n global sobre tot el nesting. */
  tab: number
  w: number
  h: number
  material: string
  thickness: number
  placements: Placement[]
  /** Àrea de peces / àrea de tauler, 0..1. */
  efficiency: number
}

export interface Nesting {
  options: NestOptions
  boards: NestedBoard[]
  /** Ids de peces que no caben a cap tauler (més grans que el tauler útil). */
  unplaced: string[]
  totalEfficiency: number
}

/** Orientacions permeses per la veta: [w, h, angle] de la petjada. */
function orientations(p: Panel, ignoreGrain = false): [number, number, 0 | 90][] {
  const flat: [number, number, 0 | 90] = [p.length, p.width, 0]
  const turned: [number, number, 0 | 90] = [p.width, p.length, 90]
  if (ignoreGrain) return [flat, turned]
  if (p.grain === "x") return [flat]
  if (p.grain === "y") return [turned]
  return [flat, turned]
}

interface Shelf {
  y: number
  height: number
  /** X on començaria la peça següent. */
  cursor: number
}

interface OpenBoard {
  board: NestedBoard
  shelves: Shelf[]
  /** X on comença cada franja (el marge). */
  x0: number
  /** Y on començaria la franja següent. */
  nextShelfY: number
}

const r = (v: number): number => Math.round(v * 100) / 100

/** El tauler apaïsat: el costat llarg (i la veta) en X. */
export function landscape(sheet: Sheet): Sheet {
  return sheet.h > sheet.w ? { w: sheet.h, h: sheet.w } : sheet
}

export function nest(panels: Panel[], options: NestOptions = DEFAULT_NEST_OPTIONS): Nesting {
  const { kerf, margin } = options
  const ignoreGrain = options.ignoreGrain ?? false

  // Agrupa per material i gruix, en ordre d'aparició.
  const groups = new Map<string, Panel[]>()
  for (const p of panels) {
    const key = `${p.material}|${p.thickness}`
    const g = groups.get(key)
    if (g) g.push(p)
    else groups.set(key, [p])
  }

  const boards: NestedBoard[] = []
  const unplaced: string[] = []
  let tab = 0

  for (const group of groups.values()) {
    const first = group[0]!
    const sheet = landscape(options.sheetsByMaterial?.[first.material] ?? options.sheet)
    const usableW = sheet.w - 2 * margin
    const usableH = sheet.h - 2 * margin
    const open: OpenBoard[] = []

    // Ordre: alçada de la petjada preferida descendent, després àrea descendent.
    const sorted = [...group].sort((a, b) => {
      const ha = orientations(a, ignoreGrain)[0]![1]
      const hb = orientations(b, ignoreGrain)[0]![1]
      if (hb !== ha) return hb - ha
      return b.length * b.width - a.length * a.width
    })

    for (const p of sorted) {
      const fits = orientations(p, ignoreGrain).filter(([w, h]) => w <= usableW && h <= usableH)
      if (fits.length === 0) {
        unplaced.push(p.id)
        continue
      }

      let placed = false

      // 1) Primer encaix en una franja existent (la que deixa menys alçada sobrera).
      let best: { ob: OpenBoard; shelf: Shelf; w: number; h: number; angle: 0 | 90; waste: number } | null = null
      for (const ob of open) {
        for (const shelf of ob.shelves) {
          for (const [w, h, angle] of fits) {
            if (h > shelf.height) continue
            if (shelf.cursor + w > margin + usableW) continue
            const waste = shelf.height - h
            if (!best || waste < best.waste) best = { ob, shelf, w, h, angle, waste }
          }
        }
      }
      if (best) {
        place(best.ob, best.shelf, p, best.w, best.h, best.angle, kerf)
        placed = true
      }

      // 2) Franja nova en un tauler obert que tingui alçada lliure.
      if (!placed) {
        for (const ob of open) {
          const orient = pickForNewShelf(fits, ob.nextShelfY, margin + usableH)
          if (!orient) continue
          const shelf = newShelf(ob, orient[1], kerf)
          place(ob, shelf, p, orient[0], orient[1], orient[2], kerf)
          placed = true
          break
        }
      }

      // 3) Tauler nou.
      if (!placed) {
        tab += 1
        const ob: OpenBoard = {
          board: {
            tab,
            w: sheet.w,
            h: sheet.h,
            material: first.material,
            thickness: first.thickness,
            placements: [],
            efficiency: 0,
          },
          shelves: [],
          x0: margin,
          nextShelfY: margin,
        }
        open.push(ob)
        boards.push(ob.board)
        const orient = pickForNewShelf(fits, ob.nextShelfY, margin + usableH)!
        const shelf = newShelf(ob, orient[1], kerf)
        place(ob, shelf, p, orient[0], orient[1], orient[2], kerf)
      }
    }
  }

  let usedArea = 0
  for (const b of boards) {
    const area = b.placements.reduce((s, pl) => s + pl.w * pl.h, 0)
    b.efficiency = r(area / (b.w * b.h))
    usedArea += area
  }
  const totalArea = boards.reduce((s, b) => s + b.w * b.h, 0)

  return {
    options,
    boards,
    unplaced,
    totalEfficiency: totalArea ? r(usedArea / totalArea) : 0,
  }
}

/** Orientació per obrir franja nova: la de menys alçada que càpiga sota el límit. */
function pickForNewShelf(
  fits: [number, number, 0 | 90][],
  y: number,
  limitY: number,
): [number, number, 0 | 90] | undefined {
  const ok = fits.filter(([, h]) => y + h <= limitY)
  if (ok.length === 0) return undefined
  return ok.reduce((a, b) => (b[1] < a[1] ? b : a))
}

function newShelf(ob: OpenBoard, height: number, kerf: number): Shelf {
  const shelf: Shelf = { y: ob.nextShelfY, height, cursor: ob.x0 }
  ob.shelves.push(shelf)
  ob.nextShelfY = shelf.y + height + kerf
  return shelf
}

function place(ob: OpenBoard, shelf: Shelf, p: Panel, w: number, h: number, angle: 0 | 90, kerf: number): void {
  const x = shelf.cursor
  const y = shelf.y
  // Sense arrodonir: x, y, w i h han de ser coherents (amb kerf 0, arrodonir només x/y feia
  // solapar peces de mides amb decimals).
  ob.board.placements.push({
    panelId: p.id,
    x,
    y,
    w,
    h,
    angle,
    cx: x + w / 2,
    cy: y + h / 2,
  })
  shelf.cursor = x + w + kerf
}

/** Comprova que un nesting és geomètricament vàlid (per a tests i per a la UI). */
export function validateNesting(n: Nesting): string[] {
  const problems: string[] = []
  for (const b of n.boards) {
    for (const pl of b.placements) {
      if (pl.x < 0 || pl.y < 0 || pl.x + pl.w > b.w + 1e-6 || pl.y + pl.h > b.h + 1e-6) {
        problems.push(`${pl.panelId} surt del tauler ${b.tab}`)
      }
    }
    for (let i = 0; i < b.placements.length; i++) {
      for (let j = i + 1; j < b.placements.length; j++) {
        const a = b.placements[i]!
        const c = b.placements[j]!
        const sepX = a.x + a.w <= c.x + 1e-6 || c.x + c.w <= a.x + 1e-6
        const sepY = a.y + a.h <= c.y + 1e-6 || c.y + c.h <= a.y + 1e-6
        if (!sepX && !sepY) problems.push(`${a.panelId} i ${c.panelId} se solapen al tauler ${b.tab}`)
      }
    }
  }
  return problems
}
