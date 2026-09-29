import type { Panel } from "../model"
import type { Nesting } from "../nesting/nest"
import { pieceRefs } from "../export/refs"
import { panelProcesses } from "./processes"

export interface LabelSheetOptions {
  project: string
  /** Mida de l'etiqueta (mm). */
  w: number
  h: number
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

/**
 * Full d'etiquetes per imprimir (HTML): per a cada peça, l'etiqueta de la peça (ref, nom,
 * mòdul, mides, material i tauler) i, si en té, l'etiqueta de procés (què li toca després
 * del nesting, en ordre). Una etiqueta per pàgina, de la mida de les preferències.
 */
export function labelSheetHtml(panels: Panel[], nesting: Nesting | null, o: LabelSheetOptions): string {
  const refs = pieceRefs(panels)
  const tab = new Map<string, number>()
  for (const b of nesting?.boards ?? []) for (const pl of b.placements) tab.set(pl.panelId, b.tab)
  const labels: string[] = []
  for (const p of panels) {
    const ref = refs.get(p.id) ?? p.id
    const board = tab.get(p.id)
    labels.push(`<section class="l"><div class="ref">${esc(ref)}</div><div class="name">${esc(p.label)}</div>
<div class="row">${p.length} × ${p.width} × ${p.thickness} mm</div><div class="row">${esc(p.material)}</div>
<div class="foot">${esc(o.project)}${p.module ? ` · mòdul ${p.module}` : ""}${board ? ` · tauler ${board}` : ""}</div></section>`)
    const pr = panelProcesses(p)
    if (pr.length)
      labels.push(`<section class="l proc"><div class="ref">${esc(ref)} <span>PROCÉS</span></div>
<ol>${pr.map((x) => `<li><b>${esc(x.label)}</b> ${esc(x.detail)}</li>`).join("")}</ol>
<div class="foot">${esc(p.label)}</div></section>`)
  }
  return `<!doctype html><html lang="ca"><head><meta charset="utf-8"><title>Etiquetes · ${esc(o.project)}</title>
<style>
@page { size: ${o.w}mm ${o.h}mm; margin: 0 }
* { box-sizing: border-box; margin: 0 }
body { font-family: system-ui, sans-serif; color: #000 }
.l { width: ${o.w}mm; height: ${o.h}mm; padding: 3mm; display: flex; flex-direction: column; gap: 1mm; page-break-after: always; overflow: hidden }
.ref { font-size: ${Math.max(10, Math.min(28, o.h / 3))}pt; font-weight: 800; letter-spacing: .02em }
.ref span { font-size: 9pt; border: 1px solid #000; padding: 0 2mm; vertical-align: middle }
.name { font-size: 11pt; font-weight: 600 }
.row { font-size: 10pt }
.proc ol { font-size: 10pt; padding-left: 5mm; display: flex; flex-direction: column; gap: .5mm }
.foot { margin-top: auto; font-size: 8pt; color: #333 }
@media screen { body { background: #ddd; padding: 8px; display: flex; flex-wrap: wrap; gap: 8px } .l { background: #fff; page-break-after: auto } }
</style></head><body>${labels.join("\n")}</body></html>`
}
