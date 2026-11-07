import { panelBox } from "../build/geometry"
import { panelProcesses } from "../process/processes"
import { EDGE_SIDES, flatten, type Panel } from "../model"
import { PdfPage, pdfBytes, textWidth } from "./pdf"
import { pieceRefs } from "./refs"
import { tallerEdgeNumbers } from "./step/tallerFrame"
import { fmtNum } from "../../lib/format"

/**
 * Plànols acotats en PDF (A4 apaïsat): primer el moble sencer (alçat, perfil i planta amb les mides generals i les
 * amplades dels mòduls) i després una pàgina per peça diferent (les iguals, juntes amb totes les refs), amb el contorn, els
 * cantells, els forats, les ranures i els talls i les cotes de cada forat des de la cantonada de baix a l'esquerra.
 */

const A4 = { w: 297, h: 210 }
const M = 12
type Pt = [number, number]
const mm = (v: number) => fmtNum(v, 1)

/** Cota horitzontal de `x0` a `x1` a l'alçada `y`, amb les línies de referència fins a `fromY`. */
function hDim(page: PdfPage, x0: number, x1: number, y: number, label: string, fromY?: number, size = 2.8): void {
  if (fromY !== undefined) {
    const d = fromY < y ? 1 : -1
    page.line([[x0, fromY + d], [x0, y + d * 1.5]], { width: 0.12 })
    page.line([[x1, fromY + d], [x1, y + d * 1.5]], { width: 0.12 })
  }
  page.line([[x0, y], [x1, y]], { width: 0.15 })
  for (const x of [x0, x1]) page.line([[x - 0.9, y + 0.9], [x + 0.9, y - 0.9]], { width: 0.3 })
  const fits = textWidth(label, size) < x1 - x0 - 1
  page.text(fits ? (x0 + x1) / 2 : x1 + 1, y - 0.8, label, { size, align: fits ? "center" : "left" })
}

/** Cota vertical de `y0` a `y1` a la columna `x`, amb les línies de referència des de `fromX`. */
function vDim(page: PdfPage, y0: number, y1: number, x: number, label: string, fromX?: number, size = 2.8): void {
  if (fromX !== undefined) {
    const d = fromX < x ? 1 : -1
    page.line([[fromX + d, y0], [x + d * 1.5, y0]], { width: 0.12 })
    page.line([[fromX + d, y1], [x + d * 1.5, y1]], { width: 0.12 })
  }
  page.line([[x, y0], [x, y1]], { width: 0.15 })
  for (const y of [y0, y1]) page.line([[x - 0.9, y + 0.9], [x + 0.9, y - 0.9]], { width: 0.3 })
  page.text(x - 0.8, (y0 + y1) / 2, label, { size, align: "center", up: true })
}

function titleBlock(page: PdfPage, project: string, title: string, n: number, total: number, date: string): void {
  const y = A4.h - M
  page.line([[M, y - 7], [A4.w - M, y - 7]], { width: 0.3 })
  page.text(M, y - 1.5, project, { size: 4, font: "bold", maxW: 120 })
  page.text(M + 125, y - 1.5, title, { size: 3.2, maxW: 100 })
  page.text(A4.w - M, y - 1.5, `${date} · ${n}/${total}`, { size: 3, align: "right" })
}

/* ---------- El moble sencer ---------- */

interface Box {
  min: [number, number, number]
  max: [number, number, number]
  module?: number
}

/** Una vista: projecta les caixes de les peces (eixos `a` horitzontal, `b` vertical; `depth`, l'eix cap a qui mira). */
function drawView(page: PdfPage, boxes: Box[], a: 0 | 1 | 2, b: 0 | 1 | 2, depth: 0 | 1 | 2, flipA: boolean, flipB: boolean, ox: number, oy: number, s: number, lo: number[], hi: number[]): void {
  // Pintor: primer les del fons; cada peça tapa (blanc) el que té darrere.
  const sorted = [...boxes].sort((p, q) => p.max[depth] - q.max[depth])
  const A = (v: number) => ox + (flipA ? hi[a]! - v : v - lo[a]!) * s
  const B = (v: number) => oy + (flipB ? v - lo[b]! : hi[b]! - v) * s
  for (const bx of sorted) {
    const x0 = A(bx.min[a]), x1 = A(bx.max[a]), y0 = B(bx.min[b]), y1 = B(bx.max[b])
    const xs = [Math.min(x0, x1), Math.max(x0, x1)], ys = [Math.min(y0, y1), Math.max(y0, y1)]
    if (xs[1]! - xs[0]! < 0.05 && ys[1]! - ys[0]! < 0.05) continue
    page.line([[xs[0]!, ys[0]!], [xs[1]!, ys[0]!], [xs[1]!, ys[1]!], [xs[0]!, ys[1]!]], { width: 0.15, fill: 1 })
  }
}

function furniturePage(panels: Panel[]): PdfPage {
  const page = new PdfPage(A4.w, A4.h)
  const boxes: Box[] = panels.map((p) => ({ ...panelBox(p), module: p.module }))
  const lo = [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k]!)))
  const hi = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k]!)))
  const [W, H, D] = [hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!]
  // Alçat a dalt a l'esquerra, perfil (dret) al costat, planta a sota de l'alçat.
  const gapX = 32, gapY = 30
  const availW = A4.w - 2 * M - 28 - gapX
  const availH = A4.h - (M + 14) - gapY - 14 - (M + 10)
  const s = Math.min(availW / (W + D), availH / (H + D))
  const ox = M + 18, oy = M + 14
  const sx = ox + W * s + gapX
  const ty = oy + H * s + gapY

  page.text(ox, oy - 6, "Alçat", { size: 3.4, font: "bold" })
  drawView(page, boxes, 0, 1, 2, false, false, ox, oy, s, lo, hi)
  page.text(sx, oy - 6, "Perfil (des de la dreta)", { size: 3.4, font: "bold" })
  drawView(page, boxes, 2, 1, 0, true, false, sx, oy, s, lo, hi)
  page.text(ox, ty - 4, "Planta", { size: 3.4, font: "bold" })
  drawView(page, boxes, 0, 2, 1, false, true, ox, ty, s, lo, hi)

  // Cotes generals.
  vDim(page, oy, oy + H * s, ox - 10, mm(H), ox)
  hDim(page, sx, sx + D * s, oy + H * s + 8, mm(D), oy + H * s)
  hDim(page, ox, ox + W * s, ty + D * s + 8, mm(W), ty + D * s)
  // Amplades dels mòduls a sota de l'alçat.
  const mods = new Map<number, [number, number]>()
  for (const b of boxes) {
    if (b.module === undefined) continue
    const r = mods.get(b.module)
    mods.set(b.module, r ? [Math.min(r[0], b.min[0]), Math.max(r[1], b.max[0])] : [b.min[0], b.max[0]])
  }
  if (mods.size > 1) {
    const y = oy + H * s + 8
    for (const [n, [x0, x1]] of [...mods].sort((p, q) => p[1][0] - q[1][0])) {
      const a = ox + (x0 - lo[0]!) * s, c = ox + (x1 - lo[0]!) * s
      hDim(page, a, c, y, mm(x1 - x0), oy + H * s, 2.4)
      page.text((a + c) / 2, y + 4, `Mòdul ${n}`, { size: 2.2, align: "center", maxW: Math.max(4, c - a) })
    }
  }
  page.text(A4.w - M, M + 2, `${mm(W)} × ${mm(H)} × ${mm(D)} mm (amplada × alçada × fondària) · ${panels.length} peces`, { size: 3, align: "right" })
  return page
}

/* ---------- Les peces ---------- */

interface PieceGroup {
  panel: Panel
  refs: string[]
}

/** Peces iguals (mateixa geometria, material i mecanitzats) en un sol plànol, amb totes les refs. */
function pieceGroups(panels: Panel[]): PieceGroup[] {
  const refs = pieceRefs(panels)
  const groups = new Map<string, PieceGroup>()
  for (const p of panels) {
    if (p.role === "hardware") continue
    const key = JSON.stringify([p.role, p.length, p.width, p.thickness, p.material, p.grain, p.edges, p.holes, p.grooves, p.cutouts, p.pockets, p.outline, p.mitres])
    const g = groups.get(key)
    const ref = refs.get(p.id) ?? ""
    if (g) g.refs.push(ref)
    else groups.set(key, { panel: p, refs: [ref] })
  }
  return [...groups.values()]
}

/** Cotes en ordenada (des de 0) d'una llista de posicions: les etiquetes s'aparten si no hi caben. */
function ordinates(values: number[]): number[] {
  const out: number[] = []
  for (const v of [...values].sort((a, b) => a - b)) if (!out.length || Math.abs(v - out[out.length - 1]!) > 0.05) out.push(v)
  return out
}

function piecePage(g: PieceGroup): PdfPage {
  const page = new PdfPage(A4.w, A4.h)
  const p = g.panel
  const L = p.length, Wd = p.width
  const area = { x0: M + 30, y0: M + 18, x1: A4.w - M - 8, y1: A4.h - M - 58 }
  const s = Math.min((area.x1 - area.x0) / L, (area.y1 - area.y0) / Wd)
  const ox = area.x0 + (area.x1 - area.x0 - L * s) / 2
  const oy = area.y0 + (area.y1 - area.y0 - Wd * s) / 2
  const P = (u: number, v: number): Pt => [ox + u * s, oy + (Wd - v) * s]
  const bottom = oy + Wd * s, left = ox

  page.text(M, M + 2, g.refs.join(" · "), { size: 5, font: "bold", maxW: A4.w - 2 * M })
  page.text(M, M + 8, `${p.label} · ${mm(L)} × ${mm(Wd)} × ${mm(p.thickness)} mm · ${p.material}`, { size: 3.4, maxW: A4.w - 2 * M })

  // Contorn i cantells.
  if (p.outline) page.line(flatten(p.outline).map(([u, v]) => P(u, v)), { width: 0.35, fill: 0.97 })
  else {
    page.line([P(0, 0), P(L, 0), P(L, Wd), P(0, Wd)], { width: 0.35, fill: 0.97 })
    const sides: Record<(typeof EDGE_SIDES)[number], [Pt, Pt]> = { left: [P(0, 0), P(0, Wd)], right: [P(L, 0), P(L, Wd)], bottom: [P(0, 0), P(L, 0)], top: [P(0, Wd), P(L, Wd)] }
    for (const side of EDGE_SIDES) if (p.edges[side]) page.line(sides[side], { width: 1.1 })
  }
  // Ranures, buidats i talls.
  for (const gr of p.grooves) page.line([P(gr.x, gr.y), P(gr.x + gr.w, gr.y), P(gr.x + gr.w, gr.y + gr.h), P(gr.x, gr.y + gr.h)], { width: 0.2, dash: gr.face === "B" ? 0.8 : undefined, fill: 0.85 })
  for (const k of p.pockets ?? []) page.line(flatten(k.points).map(([u, v]) => P(u, v)), { width: 0.2, dash: k.face === "B" ? 0.8 : undefined, fill: 0.88 })
  for (const c of p.cutouts ?? []) {
    if (c.kind === "circle") page.circle(...P(c.x, c.y), (c.diameter / 2) * s, { width: 0.3, fill: 1 })
    else if (c.kind === "polygon") page.line(flatten(c.points).map(([u, v]) => P(u, v)), { width: 0.3, fill: 1 })
    else page.line([P(c.x, c.y), P(c.x + c.w, c.y), P(c.x + c.w, c.y + c.h), P(c.x, c.y + c.h)], { width: 0.3, fill: 1 })
  }
  // Forats: cara A ple, cara B discontinu, de cantell com un rectangle des del cantell.
  const faceHoles = p.holes.filter((h) => h.face !== "edge")
  for (const h of faceHoles) {
    const r = Math.max(0.35, (h.diameter / 2) * s)
    page.circle(...P(h.x, h.y), r, { width: 0.2, dash: h.face === "B" ? 0.5 : undefined, fill: h.face === "A" ? 0.55 : undefined })
  }
  for (const h of p.holes.filter((x) => x.face === "edge")) {
    const r = h.diameter / 2
    const d = h.depth
    const rect: Record<string, [number, number, number, number]> = {
      left: [0, h.y - r, d, h.y + r],
      right: [L - d, h.y - r, L, h.y + r],
      bottom: [h.x - r, 0, h.x + r, d],
      top: [h.x - r, Wd - d, h.x + r, Wd],
    }
    const q = rect[h.edge ?? "left"]!
    page.line([P(q[0], q[1]), P(q[2], q[1]), P(q[2], q[3]), P(q[0], q[3])], { width: 0.15, dash: 0.5 })
  }

  // Cotes en ordenada dels forats de cara: X a sota (text girat), Y a l'esquerra.
  const xs = ordinates(faceHoles.map((h) => h.x).filter((x) => x > 0.05 && x < L - 0.05))
  const ys = ordinates(faceHoles.map((h) => h.y).filter((y) => y > 0.05 && y < Wd - 0.05))
  const tick = 2.7
  if (xs.length && xs.length <= 60) {
    const y = bottom + 3
    let last = -Infinity
    for (const x of xs) {
      const px = ox + x * s
      const tx = Math.max(px, last + tick)
      last = tx
      page.line([[px, bottom + 0.6], [px, y], [tx, y + 1.5]], { width: 0.1 })
      page.text(tx + 1, y + 2, mm(x), { size: 2.2, up: true, align: "right" })
    }
  }
  if (ys.length && ys.length <= 60) {
    const x = left - 3
    let last = Infinity
    for (const v of ys) {
      const py = oy + (Wd - v) * s
      const ty = Math.min(py, last - tick)
      last = ty
      page.line([[left - 0.6, py], [x, py], [x - 1.5, ty]], { width: 0.1 })
      page.text(x - 2, ty + 0.8, mm(v), { size: 2.2, align: "right" })
    }
  }
  hDim(page, ox, ox + L * s, bottom + (xs.length ? 18 : 8), mm(L), bottom)
  vDim(page, oy, bottom, left - (ys.length ? 19 : 8), mm(Wd), left)
  page.text(...P(0, 0).map((v, i) => v + (i ? 4 : -1)) as Pt, "0,0", { size: 2, align: "right" })

  // Resum de mecanitzats.
  const nums = tallerEdgeNumbers(p)
  const edges = [...new Set(EDGE_SIDES.filter((x) => p.edges[x]).map((x) => nums[x]))].sort()
  const byDia = new Map<string, number>()
  for (const h of p.holes) {
    const k = `Ø${mm(h.diameter)} × ${mm(h.depth)} ${h.face === "edge" ? "cantell" : `cara ${h.face}`}`
    byDia.set(k, (byDia.get(k) ?? 0) + 1)
  }
  const lines = [
    `Quantitat: ${g.refs.length} · Mòdul ${p.module ?? 1} · Veta: ${p.grain === "none" ? "sense" : p.grain === "x" ? "pel llarg" : "per l'ample"} · Cantells (taller): ${edges.length ? edges.join("+") : "cap"}`,
    byDia.size ? `Forats: ${[...byDia].map(([k, n]) => `${n} × ${k}`).join(" · ")}` : "Sense forats",
    [p.grooves.length && `${p.grooves.length} ranures`, p.pockets?.length && `${p.pockets.length} buidats`, p.cutouts?.length && `${p.cutouts.length} talls passants`].filter(Boolean).join(" · "),
    panelProcesses(p).filter((x) => x.kind !== "edge").map((x) => `${x.label} (${x.detail})`).join(" → "),
    "Vista de la cara A · cotes en mm des de la cantonada de baix a l'esquerra · cara B en discontinu",
  ].filter(Boolean)
  lines.forEach((t, i) => page.text(M, A4.h - M - 30 + i * 4.2, t, { size: 2.9, maxW: A4.w - 2 * M }))
  return page
}

/** El PDF dels plànols: el moble i una pàgina per peça diferent. */
export function drawingsPdf(panels: Panel[], options: { project: string; date?: Date }): { bytes: Uint8Array; pages: number; pieces: number } {
  const date = (options.date ?? new Date()).toLocaleDateString("ca-ES")
  const made = panels.filter((p) => p.role !== "hardware")
  const groups = pieceGroups(made)
  const pages = [furniturePage(panels), ...groups.map((g) => piecePage(g))]
  pages.forEach((pg, i) => titleBlock(pg, options.project, i === 0 ? "Moble" : `Peça ${i} de ${groups.length}`, i + 1, pages.length, date))
  return { bytes: pdfBytes(pages, `Plànols · ${options.project}`), pages: pages.length, pieces: groups.length }
}
