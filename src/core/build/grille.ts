import { cutoutArea, type Cutout, type GrillePattern } from "../model"
import { roundTo } from "../../lib/format"

/**
 * Patró de reixeta sobre una peça de `length` × `width` (coordenades locals de la
 * peça). Les ranures "verticals" van al llarg de l'eix x local (que a un front és
 * l'eix vertical del moble), i les "horitzontals" al llarg de y.
 *
 * `exclude`: rectangles (locals) on no s'hi fa cap tall (p. ex. la trapa i el seu marge).
 */
interface GrilleResult {
  cutouts: Cutout[]
  /** Àrea oberta / àrea de la peça, 0..1. */
  openRatio: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}


function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

/** Distribueix `count` elements de mida `size` amb separació `gap`, centrats dins de `total`. */
function centered(total: number, size: number, gap: number): number[] {
  const count = Math.floor((total + gap) / (size + gap))
  if (count <= 0) return []
  const span = count * size + (count - 1) * gap
  const start = (total - span) / 2
  return Array.from({ length: count }, (_, i) => roundTo(start + i * (size + gap), 2))
}

export function grilleCutouts(
  length: number,
  width: number,
  p: GrillePattern,
  exclude: Rect[] = [],
): GrilleResult {
  const m = p.margin
  const innerL = length - 2 * m
  const innerW = width - 2 * m
  const cutouts: Cutout[] = []
  if (innerL <= 0 || innerW <= 0) return { cutouts, openRatio: 0 }

  const blocked = (rect: Rect) => exclude.some((e) => overlaps(rect, e))

  if (p.kind === "slotsV") {
    // Ranures al llarg de x, repartides en y.
    for (const y of centered(innerW, p.slotWidth, p.slotGap)) {
      const rect: Rect = { x: m, y: m + y, w: innerL, h: p.slotWidth }
      for (const piece of splitAround(rect, exclude, "x", p.slotWidth)) {
        if (!blocked(piece)) cutouts.push({ kind: "slot", ...piece, tag: "grille" })
      }
    }
  } else if (p.kind === "slotsH") {
    for (const x of centered(innerL, p.slotWidth, p.slotGap)) {
      const rect: Rect = { x: m + x, y: m, w: p.slotWidth, h: innerW }
      for (const piece of splitAround(rect, exclude, "y", p.slotWidth)) {
        if (!blocked(piece)) cutouts.push({ kind: "slot", ...piece, tag: "grille" })
      }
    }
  } else {
    // Forats al tresbolillo: files en y amb pas · sin 60°, alternant mig pas en x.
    const d = p.holeDiameter
    const pitch = p.holePitch
    const rowStep = pitch * Math.sqrt(3) / 2
    const rows = Math.floor((innerW - d) / rowStep) + 1
    const spanY = (rows - 1) * rowStep + d
    const y0 = m + (innerW - spanY) / 2 + d / 2
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 === 0 ? 0 : pitch / 2
      const cols = Math.floor((innerL - d - offset) / pitch) + 1
      const spanX = (cols - 1) * pitch + d + offset
      const x0 = m + (innerL - spanX) / 2 + d / 2 + offset
      for (let c = 0; c < cols; c++) {
        const cx = roundTo(x0 + c * pitch, 2)
        const cy = roundTo(y0 + r * rowStep, 2)
        const rect: Rect = { x: cx - d / 2, y: cy - d / 2, w: d, h: d }
        if (!blocked(rect)) cutouts.push({ kind: "circle", x: cx, y: cy, diameter: d, tag: "grille" })
      }
    }
  }

  const open = cutouts.reduce((s, c) => s + cutoutArea(c), 0)
  return { cutouts, openRatio: roundTo(open / (length * width) * 10000, 2) / 10000 }
}

/**
 * Retalla una ranura al voltant dels rectangles exclosos que la tallen, deixant trossos
 * de longitud mínima igual a l'amplada (perquè encara siguin ranures amb extrems rodons).
 */
function splitAround(rect: Rect, exclude: Rect[], axis: "x" | "y", minLen: number): Rect[] {
  let pieces: Rect[] = [rect]
  for (const e of exclude) {
    const next: Rect[] = []
    for (const piece of pieces) {
      if (!overlaps(piece, e)) {
        next.push(piece)
        continue
      }
      if (axis === "x") {
        const left: Rect = { ...piece, w: e.x - piece.x }
        const right: Rect = { ...piece, x: e.x + e.w, w: piece.x + piece.w - (e.x + e.w) }
        if (left.w >= minLen) next.push({ ...left, w: roundTo(left.w, 2) })
        if (right.w >= minLen) next.push({ ...right, x: roundTo(right.x, 2), w: roundTo(right.w, 2) })
      } else {
        const bottom: Rect = { ...piece, h: e.y - piece.y }
        const top: Rect = { ...piece, y: e.y + e.h, h: piece.y + piece.h - (e.y + e.h) }
        if (bottom.h >= minLen) next.push({ ...bottom, h: roundTo(bottom.h, 2) })
        if (top.h >= minLen) next.push({ ...top, y: roundTo(top.y, 2), h: roundTo(top.h, 2) })
      }
    }
    pieces = next
  }
  return pieces
}

/** Llindar per sota del qual la reixeta no ventila prou. */
export const MIN_OPEN_RATIO = 0.4
