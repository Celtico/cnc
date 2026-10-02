import { camDraw, camRows, camTools, cutWidth, findTool, parseXcsPreview, toolKey, type CamDraw, type CamOp, type CamRow, type CamToolInfo, type Pt, type XcsPreview } from "../../core/export/xcsPreview"
import type { Machine } from "../../core/model"

/** Colors per eina (tokens de Chakra: s'adapten al mode fosc). El groc és per a les peces petites. */
const PALETTE = ["blue", "orange", "green", "purple", "pink", "teal", "red", "cyan"]
export const toolColor = (i: number) => `var(--chakra-colors-${PALETTE[i % PALETTE.length]}-solid)`
export const token = (name: string) => `var(--chakra-colors-${name.replace(/\./g, "-")})`

export interface CamSheetView {
  preview: XcsPreview
  tools: (CamToolInfo & { color: string })[]
  colorOf: Map<string, string>
  rows: CamRow[]
  /** Dibuix de cada operació de fresa (per número). */
  draws: Map<number, CamDraw>
  /** Amplada de tall de cada operació (si se sap l'eina). */
  widths: Map<number, number>
  /** Refs de les peces petites (alguna operació marcada). */
  small: Set<string>
  /** Contorn de cada peça (el de la seva última operació per fora), per pintar-la. */
  outlines: Map<string, Pt[]>
}

/** Tot el que cal per dibuixar un programa: lector, llegenda, colors, files i recorreguts. */
export function camSheetView(text: string, m: Machine | undefined): CamSheetView {
  const preview = parseXcsPreview(text)
  const base = camTools(preview.ops, m)
  const tools = base.map((t, i) => ({ ...t, color: toolColor(i) }))
  const colorOf = new Map(tools.map((t) => [t.key, t.color]))
  const draws = new Map<number, CamDraw>()
  const widths = new Map<number, number>()
  const small = new Set<string>()
  const outlines = new Map<string, Pt[]>()
  for (const o of preview.ops) {
    if (o.ref && (o.small || o.pass)) small.add(o.ref)
    if (o.kind === "drill") continue
    const w = cutWidth(findTool(m, o.tool))
    if (w) widths.set(o.n, w)
    const d = camDraw(o, w)
    if (!d) continue
    draws.set(o.n, d)
    if (o.ref && o.kind === "contour" && o.side === "outside" && d.closed) outlines.set(o.ref, d.outline)
  }
  return { preview, tools, colorOf, rows: camRows(preview.ops), draws, widths, small, outlines }
}

export const colorFor = (v: CamSheetView, o: CamOp) => v.colorOf.get(toolKey(o)) ?? token("fg.muted")

/** Camí SVG (y cap avall: `H − y`). */
export function svgPath(pts: Pt[], closed: boolean, H: number): string {
  if (!pts.length) return ""
  return pts.map((p, i) => `${i ? "L" : "M"}${r2(p[0])} ${r2(H - p[1])}`).join("") + (closed ? "Z" : "")
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Mm amb coma decimal (com a la resta de la UI). */
export const fmtMm = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",")

/** Nom curt del tipus d'operació. */
export function opLabel(o: Pick<CamOp, "kind" | "side" | "diameter">, count = 1): string {
  switch (o.kind) {
    case "drill":
      return `${count > 1 ? `${count} forats` : "Forat"} Ø${fmtMm(o.diameter ?? 0)}`
    case "contour":
      return o.side === "inside" ? "Tall per dins" : "Contorn per fora"
    case "pocket":
      return "Caixera"
    case "slot":
      return "Ranura (disc)"
    default:
      return o.side === "left" ? "Fresat (esquerra)" : o.side === "right" ? "Fresat (dreta)" : "Fresat"
  }
}
