import { panelProcesses } from "../process/processes"
import { EDGE_SIDES, type Panel } from "../model"
import type { Nesting } from "../nesting/nest"
import { DEFAULT_LABEL, type LabelSize } from "./labelPoint"
import { PdfPage, pdfBytes } from "./pdf"
import { pieceRefs } from "./refs"
import { tallerEdgeNumbers } from "./step/tallerFrame"
import { toTopsolidCsv } from "./topsolidCsv"
import { fmtNum } from "../../lib/format"

/** El que surt a l'etiqueta d'una peça (també per als tests). */
interface PieceLabel {
  panelId: string
  /** Ref del taller (`A.1.L.1`): és el que identifica la peça, no la mida. */
  ref: string
  name: string
  module: number
  length: number
  width: number
  thickness: number
  material: string
  /** Tauler del nesting on va (`Melamina_blanca_19#01`), si n'hi ha. */
  board?: string
  /** Cantells folrats en numeració del taller (1 dalt · 2 dreta · 3 baix · 4 esquerra), amb el costat llarg en horitzontal. */
  edges: (1 | 2 | 3 | 4)[]
  /** Veta en horitzontal (pel llarg de l'etiqueta), en vertical o sense. */
  grain: "h" | "v" | "none"
  /** Post-processos després de la CNC («Cantell (1+3)»). */
  processes: string
}

/**
 * Una etiqueta per peça, en l'ordre del nesting (tauler per tauler) i, al final, les que no hi caben. Sense nesting, totes
 * les peces que es fabriquen (no els ferratges).
 */
export function pieceLabels(panels: Panel[], nesting?: Nesting): PieceLabel[] {
  const refs = pieceRefs(panels)
  const byId = new Map(panels.map((p) => [p.id, p]))
  const order: { panel: Panel; board?: string }[] = []
  if (nesting) {
    // El mateix nom de tauler que el CSV del taller (també per a les que no hi caben, que en tenen un a mida).
    const boardOf = new Map(toTopsolidCsv(panels, nesting, { project: "" }).rows.map((r) => [r.panelId, r.board]))
    for (const b of nesting.boards)
      for (const pl of b.placements) {
        const panel = byId.get(pl.panelId)
        if (panel) order.push({ panel, board: boardOf.get(panel.id) })
      }
    for (const id of nesting.unplaced) {
      const panel = byId.get(id)
      if (panel) order.push({ panel, board: boardOf.get(id) })
    }
  } else for (const panel of panels) if (panel.role !== "hardware") order.push({ panel })

  return order.map(({ panel: p, board }) => {
    const nums = tallerEdgeNumbers(p)
    const edges = [...new Set(EDGE_SIDES.filter((s) => p.edges[s]).map((s) => nums[s]))].sort()
    // El taller posa el costat llarg en horitzontal (u): la veta «x» (pel llarg de la peça) hi va si el llarg és el més gran.
    const lengthIsU = p.length >= p.width
    const grain = p.grain === "none" ? "none" : (p.grain === "x") === lengthIsU ? "h" : "v"
    return {
      panelId: p.id,
      ref: refs.get(p.id) ?? "",
      name: p.role === "part" ? p.label : p.label || p.name,
      module: p.module ?? 1,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      material: p.material,
      board,
      edges,
      grain,
      // Amb la numeració del taller també als processos (la de la llista de tall, `EDGE_NUMBER`, va en el marc de la peça).
      processes: panelProcesses(p)
        .map((x) => {
          const detail =
            x.kind === "edge" ? edges.join("+") : x.kind === "mitre" ? `cantell ${[...new Set((p.mitres ?? []).map((s) => nums[s]))].sort().join("+")}` : x.detail
          return `${x.label} (${detail})`
        })
        .join(" → "),
    }
  })
}

const mm = (v: number) => fmtNum(v)

/** Dibuixa una etiqueta a la pàgina (de la mida de l'etiqueta). */
function drawLabel(page: PdfPage, l: PieceLabel, project: string, index: number, total: number): void {
  const { w: W, h: H } = page
  const m = Math.min(3, H * 0.06)
  const s = Math.min(H / 50, W / 100) // escala respecte d'una etiqueta de 100 × 50
  // Esquema de la peça a la dreta: quadrat del costat que deixa l'alçada.
  const D = Math.min(H - 2 * m - 8 * s, W * 0.3)
  const textW = W - 3 * m - D
  let y = m + 8.5 * s
  page.text(m, y, l.ref, { size: 9 * s, font: "bold", maxW: textW })
  y += 6 * s
  page.text(m, y, l.name, { size: 4.2 * s, maxW: textW })
  y += 6 * s
  page.text(m, y, `${mm(l.length)} × ${mm(l.width)} × ${mm(l.thickness)} mm`, { size: 4.6 * s, font: "bold", maxW: textW })
  y += 5.2 * s
  page.text(m, y, l.material, { size: 3.4 * s, maxW: textW })
  y += 4.6 * s
  page.text(m, y, [`Mòdul ${l.module}`, l.board].filter(Boolean).join(" · "), { size: 3 * s, maxW: textW })
  if (l.processes) {
    y += 4.2 * s
    page.text(m, y, l.processes, { size: 2.6 * s, maxW: textW })
  }
  page.text(m, H - m, project, { size: 2.6 * s, maxW: textW * 0.75 })
  page.text(W - m, H - m, `${index}/${total}`, { size: 2.6 * s, align: "right" })

  // Esquema: la peça amb el costat llarg en horitzontal; els cantells folrats amb línia gruixuda i el número al costat.
  const u = Math.max(l.length, l.width)
  const v = Math.min(l.length, l.width)
  const boxW = D - 6 * s
  const boxH = Math.max(boxW * 0.18, (boxW * v) / u)
  const bx = W - m - D + 3 * s
  const by = m + 4 * s + (D - 12 * s - boxH) / 2
  page.rect(bx, by, boxW, boxH, { width: 0.25, fill: 0.93 })
  const thick = 1.1 * s
  const sides: Record<1 | 2 | 3 | 4, { pts: [number, number][]; lx: number; ly: number; align: "left" | "center" | "right" }> = {
    1: { pts: [[bx, by], [bx + boxW, by]], lx: bx + boxW / 2, ly: by - 1.2 * s, align: "center" },
    2: { pts: [[bx + boxW, by], [bx + boxW, by + boxH]], lx: bx + boxW + 1.2 * s, ly: by + boxH / 2 + 1 * s, align: "left" },
    3: { pts: [[bx, by + boxH], [bx + boxW, by + boxH]], lx: bx + boxW / 2, ly: by + boxH + 3.4 * s, align: "center" },
    4: { pts: [[bx, by], [bx, by + boxH]], lx: bx - 1.2 * s, ly: by + boxH / 2 + 1 * s, align: "right" },
  }
  for (const k of [1, 2, 3, 4] as const) {
    const side = sides[k]
    const on = l.edges.includes(k)
    if (on) page.line(side.pts, { width: thick })
    page.text(side.lx, side.ly, String(k), { size: 2.6 * s, font: on ? "bold" : "regular", align: side.align })
  }
  // Veta: una fletxa doble al mig.
  if (l.grain !== "none") {
    const cx = bx + boxW / 2
    const cy = by + boxH / 2
    const a = 1.2 * s
    if (l.grain === "h") {
      const r = Math.min(boxW * 0.3, 10 * s)
      page.line([[cx - r, cy], [cx + r, cy]], { width: 0.3 })
      page.line([[cx + r - a, cy - a], [cx + r, cy], [cx + r - a, cy + a]], { width: 0.3 })
      page.line([[cx - r + a, cy - a], [cx - r, cy], [cx - r + a, cy + a]], { width: 0.3 })
    } else {
      const r = Math.min(boxH * 0.35, 10 * s)
      page.line([[cx, cy - r], [cx, cy + r]], { width: 0.3 })
      page.line([[cx - a, cy - r + a], [cx, cy - r], [cx + a, cy - r + a]], { width: 0.3 })
      page.line([[cx - a, cy + r - a], [cx, cy + r], [cx + a, cy + r - a]], { width: 0.3 })
    }
  }
  const edgeText = l.edges.length ? `Cantells ${l.edges.join("+")}` : "Sense cantells"
  page.text(bx + boxW / 2, by + boxH + 7.6 * s, l.grain === "none" ? edgeText : `${edgeText} · veta`, { size: 2.6 * s, align: "center", maxW: D })
}

/** PDF d'etiquetes: una pàgina de la mida de l'etiqueta (Preferències › Etiqueta de peça) per peça. */
export function labelsPdf(labels: PieceLabel[], options: { project: string; label?: LabelSize }): Uint8Array {
  const size = options.label ?? DEFAULT_LABEL
  const pages = labels.map((l, i) => {
    const page = new PdfPage(size.w, size.h)
    drawLabel(page, l, options.project, i + 1, labels.length)
    return page
  })
  return pdfBytes(pages, `Etiquetes · ${options.project}`)
}
