import type { Hole, Panel } from "../model"

type Box = { min: [number, number, number]; max: [number, number, number] }

/** Volum (caixa local) que ocupa un forat dins de la peça. */
function holeBox(p: Panel, h: Hole): Box | null {
  const r = h.diameter / 2
  const { length: L, width: W, thickness: T } = p
  if (h.face === "A") return { min: [h.x - r, h.y - r, T - h.depth], max: [h.x + r, h.y + r, T] }
  if (h.face === "B") return { min: [h.x - r, h.y - r, 0], max: [h.x + r, h.y + r, h.depth] }
  const zc: [number, number] = [T / 2 - r, T / 2 + r]
  if (h.edge === "left") return { min: [0, h.y - r, zc[0]], max: [h.depth, h.y + r, zc[1]] }
  if (h.edge === "right") return { min: [L - h.depth, h.y - r, zc[0]], max: [L, h.y + r, zc[1]] }
  if (h.edge === "bottom") return { min: [h.x - r, 0, zc[0]], max: [h.x + r, h.depth, zc[1]] }
  if (h.edge === "top") return { min: [h.x - r, W - h.depth, zc[0]], max: [h.x + r, W, zc[1]] }
  return null
}

const overlaps = (a: Box, b: Box) => [0, 1, 2].every((k) => a.min[k]! < b.max[k]! - 0.01 && b.min[k]! < a.max[k]! - 0.01)
const half = (v: number) => Math.floor(v * 2) / 2

/** Fondària màxima d'un forat de cantell perquè s'aturi 1 mm abans del forat de cara `f`. */
function edgeStop(p: Panel, e: Hole, f: Hole): number {
  const r = f.diameter / 2
  if (e.edge === "left") return f.x - r - 1
  if (e.edge === "right") return p.length - (f.x + r) - 1
  if (e.edge === "bottom") return f.y - r - 1
  return p.width - (f.y + r) - 1
}

/** Fondària mínima perquè una espiga o un forat de cantell aguanti. */
const MIN_EDGE_DEPTH = 10

/**
 * Forats que es trobarien per dins de la peça (el taller els faria i la peça quedaria
 * foradada on no toca; el STEP seria un sòlid que s'autointerseca). Es corregeixen com ho
 * faria un tècnic:
 *  - Dos forats de cara per les dues cares al mateix lloc (System 32 d'un divisor, a banda i
 *    banda): tots dos s'escurcen perquè quedi 1 mm de matèria entre ells.
 *  - Un forat de cantell (espiga) que arriba a un forat de cara (guia, System 32): l'espiga
 *    s'escurça fins a 1 mm abans. Si quedaria de menys de 10 mm, no es toca i s'avisa.
 * Modifica les fondàries de `p.holes`; retorna els avisos dels que no s'han pogut resoldre.
 */
export function resolveHoleClashes(p: Panel): string[] {
  const warnings: string[] = []
  const hs = p.holes
  for (let i = 0; i < hs.length; i++)
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i]!
      const b = hs[j]!
      const ba = holeBox(p, a)
      const bb = holeBox(p, b)
      if (!ba || !bb || !overlaps(ba, bb)) continue
      const faceA = a.face !== "edge", faceB = b.face !== "edge"
      if (faceA && faceB && a.face !== b.face) {
        const max = half((p.thickness - 1) / 2)
        if (a.depth + b.depth > p.thickness - 1) {
          a.depth = Math.min(a.depth, max)
          b.depth = Math.min(b.depth, max)
        }
        continue
      }
      if (faceA !== faceB) {
        const e = faceA ? b : a
        const f = faceA ? a : b
        const stop = half(edgeStop(p, e, f))
        if (stop >= MIN_EDGE_DEPTH) e.depth = Math.min(e.depth, stop)
        else warnings.push(`${p.label || p.name}: un forat de cantell Ø${e.diameter} xoca per dins amb un forat de cara Ø${f.diameter} a (${f.x}, ${f.y}); mou-ne un.`)
        continue
      }
      warnings.push(`${p.label || p.name}: dos forats Ø${a.diameter} i Ø${b.diameter} a (${a.x}, ${a.y}) i (${b.x}, ${b.y}) es toquen.`)
    }
  return warnings
}
