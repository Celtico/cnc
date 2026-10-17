import type { PlanDim } from "../core/build/hardwareMount"
import { fmtNum } from "../lib/format"

/**
 * **Cotes dels dibuixos 2D** (pur, sense React): el mateix joc a tots els plànols de peça i vistes dels ferratges
 * (Preferències › Ferratges: el dibuix del generador, les vistes DXF del fabricant i la peça d'exemple; Editor › la
 * col·locació d'un ferratge). Coordenades de l'SVG (y cap avall, mm). Donen:
 * - la **mida total** (amplada a sota, alçada a l'esquerra);
 * - les **cotes encadenades** de cada eix (a dalt i a la dreta): del cantell al primer element, entre elements (la
 *   distància entre forats), el punt de referència inclòs, i de l'últim al cantell;
 * - les **etiquetes** de cada element (Ø × fondària, ample de ranura…) on no tapin res.
 * Els textos que no caben entre les marques es pugen a una altra fila (`shift`) en lloc d'encavalcar-se. Ho dibuixa
 * `DimLine` (`components/DimLine.tsx`) i `FeatureLabels`.
 */

/** Una cota amb, opcionalment, el text apartat `shift` (mm, cap a fora) quan no hi cap entre les marques. */
export interface DrawDim extends PlanDim {
  shift?: number
}

/** Un element del dibuix: el centre (que es cota) i la mida que ocupa (per no posar-hi textos a sobre). */
export interface DrawFeature {
  x: number
  y: number
  /** Mitja amplada i mitja alçada de l'element (un forat: el radi). */
  hx: number
  hy: number
  /** «Ø8 × 10», «8 × 12 ranura»… */
  label?: string
  /** No es cota al llarg d'aquest eix (una ranura de cantell a cantell no té posició al llarg). */
  skipX?: boolean
  skipY?: boolean
}

export interface FeatureLabel {
  x: number
  y: number
  text: string
  anchor: "start" | "end" | "middle"
}

export interface DimLayout {
  dims: DrawDim[]
  labels: FeatureLabel[]
  /** La caixa que ocupa tot (peça, cotes i textos): el `viewBox`. */
  extent: { x: number; y: number; w: number; h: number }
}

type Box = { x0: number; y0: number; x1: number; y1: number }

/** Amplada aproximada d'un text de cota (la mateixa estimació que `DimLine`). */
export const textW = (s: string, fs: number) => s.length * fs * 0.56

/** Mida de lletra dels plànols: proporcional a la caixa (llegible al mòbil i a l'ordinador). */
export const dimFont = (b: Box) => Math.max(b.x1 - b.x0, b.y1 - b.y0) / 26

/** Posicions úniques ordenades (a 0,05 mm). */
function uniq(xs: number[]): number[] {
  const out: number[] = []
  for (const x of [...xs].sort((a, b) => a - b)) if (!out.length || Math.abs(x - out.at(-1)!) > 0.05) out.push(x)
  return out
}

/**
 * Cotes encadenades d'un eix: `stops` (posicions, de cantell a cantell) sobre la línia `at` (y per a l'eix X, x per a
 * l'eix Y), a `offset` del cantell (signe = costat, com `PlanDim`). Els textos que no hi caben pugen de fila.
 */
function chain(axis: "x" | "y", stops: number[], at: number, offset: number, fs: number, title: string): DrawDim[] {
  const out: DrawDim[] = []
  // Per fila de textos apartats, on acaba l'últim (per no encavalcar-los).
  const rowEnd: number[] = []
  const sg = Math.sign(offset) || 1
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i]!, b = stops[i + 1]!
    const len = b - a
    if (len < 0.05) continue
    const label = fmtNum(len)
    const tw = axis === "x" ? textW(label, fs) : fs * 1.1
    const d: DrawDim = axis === "x" ? { a: [a, at], b: [b, at], offset, label, title } : { a: [at, a], b: [at, b], offset, label, title }
    if (len <= tw + fs * 0.6) {
      // No hi cap: el text centrat a la cota, una fila més enfora (la primera lliure).
      const mid = (a + b) / 2
      let row = 0
      while (row < rowEnd.length && rowEnd[row]! > mid - tw / 2 - fs * 0.3) row++
      rowEnd[row] = mid + tw / 2
      d.shift = sg * fs * (1.15 * (row + 1))
    }
    out.push(d)
  }
  return out
}

/**
 * Les cotes d'una peça o d'una vista: la caixa `box`, els elements i, si n'hi ha, el punt de referència `ref` (entra a
 * les cadenes: la distància del cantell i dels forats a la referència). `fs` = mida de la lletra (mm del dibuix).
 */
export function layoutDims(box: Box, feats: readonly DrawFeature[], fs: number, opts: { ref?: [number, number]; title?: string } = {}): DimLayout {
  const { x0, y0, x1, y1 } = box
  const inX = (x: number) => x > x0 + 0.05 && x < x1 - 0.05
  const inY = (y: number) => y > y0 + 0.05 && y < y1 - 0.05
  const xs = uniq([x0, x1, ...feats.filter((f) => !f.skipX && inX(f.x)).map((f) => f.x), ...(opts.ref && inX(opts.ref[0]) ? [opts.ref[0]] : [])])
  const ys = uniq([y0, y1, ...feats.filter((f) => !f.skipY && inY(f.y)).map((f) => f.y), ...(opts.ref && inY(opts.ref[1]) ? [opts.ref[1]] : [])])
  const gap = fs * 1.7
  const dims: DrawDim[] = []
  // Encadenades: a dalt (X) i a la dreta (Y), només si hi ha algun element entre els cantells.
  const chainX = xs.length > 2 ? chain("x", xs, y0, -gap, fs, "Encadenada") : []
  const chainY = ys.length > 2 ? chain("y", ys, x1, -gap, fs, "Encadenada") : []
  dims.push(...chainX, ...chainY)
  // Total: a sota (amplada) i a l'esquerra (alçada).
  dims.push({ a: [x0, y1], b: [x1, y1], offset: gap, label: fmtNum(x1 - x0), title: opts.title ? `${opts.title}: amplada` : "Amplada" })
  dims.push({ a: [x0, y0], b: [x0, y1], offset: gap, label: fmtNum(y1 - y0), title: opts.title ? `${opts.title}: alçada` : "Alçada" })
  // Etiquetes dels elements: a una de les quatre cantonades de fora, on no toquin cap element ni cap altra etiqueta.
  const busy: Box[] = feats.map((f) => ({ x0: f.x - f.hx, y0: f.y - f.hy, x1: f.x + f.hx, y1: f.y + f.hy }))
  const labels: FeatureLabel[] = []
  const lfs = fs * 0.8
  const seen = new Set<string>()
  for (const f of feats) {
    if (!f.label) continue
    // Un sol cop cada text per fila d'elements iguals al mateix lloc (els 16 forats d'una filera tenen el mateix Ø).
    const key = `${f.label}|${Math.round(f.y)}`
    if (seen.has(key) && feats.length > 6) continue
    const w = textW(f.label, lfs)
    const h = lfs * 1.1
    const g = lfs * 0.2
    // A les cantonades de fora de l'element, després als costats; si no hi cap enlloc, cap (els números són a la llista).
    const tries: [number, number, "start" | "end" | "middle"][] = [
      [f.x + f.hx + g, f.y - f.hy - g, "start"],
      [f.x - f.hx - g, f.y - f.hy - g, "end"],
      [f.x + f.hx + g, f.y + f.hy + h, "start"],
      [f.x - f.hx - g, f.y + f.hy + h, "end"],
      [f.x + f.hx + g, f.y + h * 0.35, "start"],
      [f.x - f.hx - g, f.y + h * 0.35, "end"],
      [f.x, f.y - f.hy - g, "middle"],
      [f.x, f.y + f.hy + h, "middle"],
    ]
    for (const [tx, ty, anchor] of tries) {
      const left = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2
      const b: Box = { x0: left, y0: ty - h * 0.85, x1: left + w, y1: ty + h * 0.15 }
      if (busy.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue
      busy.push(b)
      labels.push({ x: tx, y: ty, text: f.label, anchor })
      seen.add(key)
      break
    }
  }
  // La caixa de tot: la peça, les files de cotes (amb els textos apartats) i les etiquetes.
  const rows = (list: DrawDim[]) => Math.max(0, ...list.map((d) => Math.abs(d.shift ?? 0)))
  const top = y0 - gap - fs * 1.2 - (chainX.length ? rows(chainX) : -gap)
  // Les verticals: el text al costat, i els apartats `shift` × 2,2 més enfora (com els dibuixa `DimLine`).
  const right = x1 + (chainY.length ? gap + fs * 0.9 + Math.max(...chainY.map((d) => Math.abs(d.shift ?? 0) * 2.2 + textW(d.label, fs))) : fs * 0.6)
  const bottom = y1 + gap + fs * 1.4
  const left = x0 - gap - textW(fmtNum(y1 - y0), fs) - fs * 0.6
  let ex0 = left, ey0 = top, ex1 = right, ey1 = bottom
  for (const l of labels) {
    const w = textW(l.text, lfs)
    const lx = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2
    ex0 = Math.min(ex0, lx)
    ex1 = Math.max(ex1, lx + w)
    ey0 = Math.min(ey0, l.y - lfs)
    ey1 = Math.max(ey1, l.y + lfs * 0.3)
  }
  return { dims, labels, extent: { x: ex0, y: ey0, w: ex1 - ex0, h: ey1 - ey0 } }
}

/** Cercles d'una vista 2D (polilínies tancades rodones): centre i radi, com els llegeix l'enganxament del generador. */
export function viewCircles(lines: readonly number[][]): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = []
  for (const l of lines) {
    const all = l.length / 2
    if (all < 8 || Math.hypot(l[0]! - l[2 * all - 2]!, l[1]! - l[2 * all - 1]!) > 0.05) continue
    // Sense el punt final (repeteix el primer: desplaçaria el centre).
    const n = all - 1
    let sx = 0, sy = 0
    for (let i = 0; i < n; i++) {
      sx += l[2 * i]!
      sy += l[2 * i + 1]!
    }
    const cx = sx / n, cy = sy / n
    const ds = Array.from({ length: n }, (_, i) => Math.hypot(l[2 * i]! - cx, l[2 * i + 1]! - cy))
    const r = ds.reduce((a, b) => a + b, 0) / n
    if (r < 0.2 || ds.some((d) => Math.abs(d - r) > Math.max(0.15, r * 0.06))) continue
    if (out.some((c) => Math.hypot(c.x - cx, c.y - cy) < 0.05 && Math.abs(c.r - r) < 0.05)) continue
    out.push({ x: cx, y: cy, r })
  }
  return out
}
