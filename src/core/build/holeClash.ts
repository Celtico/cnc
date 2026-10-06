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

/** Fondària mínima d'un forat de ferratge (placa, frontissa) escurçat perquè no es trobi amb el de l'altra cara. */
export const MIN_FITTING_DEPTH = 8

/** Forat d'un ferratge que s'ha revisat (placa o frontissa importada): escurçar-lo s'ha de dir. */
const fitting = (h: Hole) => h.tag === "plate" || !!h.tag?.startsWith("hinge")

/**
 * Dos forats de cara per les dues cares que es trobarien per dins i un és d'un ferratge (la placa d'una frontissa a banda
 * i banda d'un divisor, o sobre la filera System 32 de l'altra cara): primer s'escurça el que no és del ferratge; si no
 * n'hi ha prou, tots dos a (T − 1)/2. Cap per sota de `MIN_FITTING_DEPTH` (ni de la seva fondària, si ja era menys): si
 * no es pot, no es toca i l'avís ho diu clar. Torna l'avís (sempre n'hi ha).
 */
function shortenFitting(p: Panel, a: Hole, b: Hole): string {
  const room = p.thickness - 1
  const min = (h: Hole) => Math.min(h.depth, MIN_FITTING_DEPTH)
  const what = (h: Hole) => (h.tag === "plate" ? `de placa Ø${h.diameter}` : fitting(h) ? `de frontissa Ø${h.diameter}` : `Ø${h.diameter}`)
  const where = `${p.label || p.name}: un forat ${what(a)} a (${a.x}, ${a.y}) i un ${what(b)} a (${b.x}, ${b.y}), a cares contràries`
  const [keep, other] = fitting(a) && !fitting(b) ? [a, b] : fitting(b) && !fitting(a) ? [b, a] : [null, null]
  if (keep && other) {
    const rest = half(room - keep.depth)
    if (rest >= min(other)) {
      const was = other.depth
      other.depth = rest
      return `${where}, es trobarien per dins: el ${what(other)} s'escurça de ${was} a ${rest} mm (1 mm de matèria entre tots dos).`
    }
  }
  const max = half(room / 2)
  const da = Math.min(a.depth, max)
  const db = Math.min(b.depth, max)
  if (da < min(a) || db < min(b))
    return `${where}, es trobarien per dins i no es poden escurçar prou (gruix ${p.thickness} mm, com a mínim ${MIN_FITTING_DEPTH} mm cadascun): no es toquen. Mou una de les portes o les frontisses, o fes la peça més gruixuda.`
  const was = [a.depth, b.depth]
  a.depth = da
  b.depth = db
  return `${where}, es trobarien per dins: s'escurcen de ${was[0]} i ${was[1]} a ${da} i ${db} mm (1 mm de matèria entre tots dos). Comprova que la placa hi aguanta.`
}

/**
 * Forats que es trobarien per dins de la peça (el taller els faria i la peça quedaria
 * foradada on no toca; el STEP seria un sòlid que s'autointerseca). Es corregeixen com ho
 * faria un tècnic:
 *  - Dos forats de cara per les dues cares al mateix lloc (System 32 d'un divisor, a banda i
 *    banda): tots dos s'escurcen perquè quedi 1 mm de matèria entre ells. Si un és d'un ferratge
 *    (placa, frontissa), `shortenFitting`: mai per sota d'un mínim i sempre amb avís.
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
        if (a.depth + b.depth <= p.thickness - 1) continue
        // System 32 contra System 32 (un divisor): tots dos a (T − 1)/2, com sempre, sense avís.
        if (!fitting(a) && !fitting(b)) {
          a.depth = Math.min(a.depth, max)
          b.depth = Math.min(b.depth, max)
          continue
        }
        // Una placa o una frontissa: mai en silenci ni per sota d'un mínim que aguanti.
        const message = shortenFitting(p, a, b)
        if (message) warnings.push(message)
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
