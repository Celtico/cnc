import type { CamOp, Pt, XcsPreview } from "../../core/export/xcsPreview"
import { bounds, polylineLength } from "../../core/model"
import { opLabel, type CamSheetView } from "./camDrawing"
import { fmtNum } from "../../lib/format"

type CamPart = XcsPreview["parts"][number]

/** Cotes de la Vista CAM: el que es mostra en passar el ratolí (o tocar) una peça o una operació. Pur. */

/** Què s'inspecciona: una peça (per ref) o una operació (pel número del fitxer). */
export type CamTarget = { kind: "part"; ref: string } | { kind: "op"; n: number }

/** Cota de `a` a `b` (mm del tauler), desplaçada `off` px de pantalla a l'esquerra de a→b (0 = sobre la mateixa línia). */
export interface CamDim {
  a: Pt
  b: Pt
  off: number
  label: string
  /** Què mesura (el `<title>` de la cota). */
  title: string
}

export interface CamInspection {
  title: string
  lines: string[]
  dims: CamDim[]
  /** Centre del que s'inspecciona (per triar a quin racó va la fitxa). */
  focus: Pt
  /** Contorn per ressaltar (peces). */
  outline?: Pt[]
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Distàncies d'una caixa (o un punt) als quatre cantells d'una altra. */
export function edgeGaps(inner: Box, outer: Box) {
  return { left: inner.x0 - outer.x0, right: outer.x1 - inner.x1, bottom: inner.y0 - outer.y0, top: outer.y1 - inner.y1 }
}

const partBox = (q: CamPart): Box => ({ x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h })
const EPS = 0.05
const mm = (n: number) => `${fmtNum(n)} mm`

/** Cotes dels cantells més propers: d'`inner` al cantell esquerre o dret i al de baix o de dalt d'`outer`. */
function gapDims(inner: Box, outer: Box): { dims: CamDim[]; text: string } {
  const g = edgeGaps(inner, outer)
  const yRef = (inner.y0 + inner.y1) / 2
  const xRef = (inner.x0 + inner.x1) / 2
  const dims: CamDim[] = []
  const left = g.left <= g.right
  const bottom = g.bottom <= g.top
  const gx = left ? g.left : g.right
  const gy = bottom ? g.bottom : g.top
  if (gx > EPS) dims.push(left ? { a: [outer.x0, yRef], b: [inner.x0, yRef], off: 0, label: fmtNum(gx), title: "Al cantell de la peça" } : { a: [inner.x1, yRef], b: [outer.x1, yRef], off: 0, label: fmtNum(gx), title: "Al cantell de la peça" })
  if (gy > EPS) dims.push(bottom ? { a: [xRef, outer.y0], b: [xRef, inner.y0], off: 0, label: fmtNum(gy), title: "Al cantell de la peça" } : { a: [xRef, inner.y1], b: [xRef, outer.y1], off: 0, label: fmtNum(gy), title: "Al cantell de la peça" })
  return { dims, text: `a ${fmtNum(gx)} del cantell ${left ? "esquerre" : "dret"} · a ${fmtNum(gy)} del ${bottom ? "de baix" : "de dalt"}` }
}

/** Cotes d'amplada (a dalt) i alçada (a la dreta) d'una caixa. */
function sizeDims(b: Box): CamDim[] {
  const out: CamDim[] = []
  if (b.x1 - b.x0 > EPS) out.push({ a: [b.x0, b.y1], b: [b.x1, b.y1], off: 16, label: fmtNum(b.x1 - b.x0), title: "Amplada" })
  if (b.y1 - b.y0 > EPS) out.push({ a: [b.x1, b.y1], b: [b.x1, b.y0], off: 16, label: fmtNum(b.y1 - b.y0), title: "Alçada" })
  return out
}

/** Peça d'una operació: per la ref o, si no en porta, la que conté el punt. */
function partOf(view: CamSheetView, o: CamOp, at: Pt | null): CamPart | undefined {
  const ps = view.preview.parts
  if (o.ref) {
    const q = ps.find((p) => p.ref === o.ref)
    if (q) return q
  }
  if (!at) return undefined
  return ps.find((p) => at[0] >= p.x - EPS && at[0] <= p.x + p.w + EPS && at[1] >= p.y - EPS && at[1] <= p.y + p.h + EPS)
}

function inspectPart(view: CamSheetView, q: CamPart): CamInspection {
  const L = view.preview.workpiece?.L
  const W = view.preview.workpiece?.W
  const b = partBox(q)
  const midY = (b.y0 + b.y1) / 2
  const midX = (b.x0 + b.x1) / 2
  const dims = sizeDims(b)
  if (b.x0 > EPS) dims.push({ a: [0, midY], b: [b.x0, midY], off: 0, label: fmtNum(b.x0), title: "X des de l'origen" })
  if (b.y0 > EPS) dims.push({ a: [midX, 0], b: [midX, b.y0], off: 0, label: fmtNum(b.y0), title: "Y des de l'origen" })
  const nOps = view.preview.ops.filter((o) => o.ref === q.ref).length
  const lines = [
    `X ${fmtNum(b.x0)} · Y ${fmtNum(b.y0)} des de l'origen`,
    ...(L !== undefined && W !== undefined ? [`a ${fmtNum(L - b.x1)} del cantell dret · a ${fmtNum(W - b.y1)} del de dalt del tauler`] : []),
    `Llarg ${mm(q.length)} · ample ${fmtNum(q.width)}${q.angle ? ` · girada ${q.angle}°` : ""}`,
    ...(q.name ? [q.name] : []),
    `${nOps} ${nOps === 1 ? "operació" : "operacions"}`,
  ]
  return { title: `Peça ${q.ref} · ${fmtNum(q.w)} × ${mm(q.h)}`, lines, dims, focus: [midX, midY], ...(view.outlines.has(q.ref) ? { outline: view.outlines.get(q.ref)! } : {}) }
}

function depthLine(o: CamOp): string {
  const parts = [`prof. ${fmtNum(o.depth)}`]
  if (o.maxPass && o.maxPass > 0 && o.depth > o.maxPass + EPS) parts.push(`${Math.ceil(o.depth / o.maxPass - 1e-6)} passades de ${fmtNum(o.maxPass)}`)
  if (o.pass) parts.push(`passada ${o.pass.index}/${o.pass.count}`)
  if (o.overMaterial) parts.push(`sobrant ${fmtNum(o.overMaterial)}`)
  return parts.join(" · ")
}

function inspectOp(view: CamSheetView, o: CamOp): CamInspection {
  const title = [opLabel(o), o.ref].filter(Boolean).join(" · ")
  const top = o.plane === "Top"
  const tool = o.tool === "-1" ? "automàtica" : o.tool
  if (o.kind === "drill") {
    const c: Pt = [o.x ?? 0, o.y ?? 0]
    const q = partOf(view, o, c)
    const lines = [`Ø ${fmtNum(o.diameter ?? 0)} · prof. ${fmtNum(o.depth)}`, `X ${fmtNum(c[0])} · Y ${fmtNum(c[1])} des de l'origen`]
    let dims: CamDim[] = []
    if (q) {
      const g = gapDims({ x0: c[0], y0: c[1], x1: c[0], y1: c[1] }, partBox(q))
      const all = edgeGaps({ x0: c[0], y0: c[1], x1: c[0], y1: c[1] }, partBox(q))
      dims = g.dims
      lines.push(g.text, `Peça ${q.ref}: esq. ${fmtNum(all.left)} · dreta ${fmtNum(all.right)} · baix ${fmtNum(all.bottom)} · dalt ${fmtNum(all.top)}`)
    } else {
      if (c[0] > EPS) dims.push({ a: [0, c[1]], b: c, off: 0, label: fmtNum(c[0]), title: "X des de l'origen" })
      if (c[1] > EPS) dims.push({ a: [c[0], 0], b: c, off: 0, label: fmtNum(c[1]), title: "Y des de l'origen" })
    }
    lines.push(`Broca ${tool}`)
    return { title, lines, dims: top ? dims : [], focus: c }
  }

  const d = view.draws.get(o.n)
  const w = view.widths.get(o.n)
  const toolLine = `Eina ${tool} · Ø ${w ? fmtNum(w) : "?"}`
  if (!d || !d.outline.length) return { title, lines: [toolLine, depthLine(o)], dims: [], focus: [0, 0] }
  // Un fresat o una ranura sense compensació (el camí és el centre de l'eina): el que es talla és el camí més mig Ø per
  // banda. Si no, una ranura de fons de 10,8 feta amb una fresa de 8 en dues passades sortia com «8» d'ample i «2,8»
  // d'alt (la distància entre les dues passades).
  const centreline = (o.kind === "rough" || o.kind === "slot") && (!o.side || o.side === "center") && !!w
  const path = bounds(d.outline)
  const b: Box = centreline ? { x0: path.x0 - w! / 2, y0: path.y0 - w! / 2, x1: path.x1 + w! / 2, y1: path.y1 + w! / 2 } : path
  const focus: Pt = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
  const len = polylineLength(d.outline, d.closed)
  const circle = o.path?.circle
  const size = circle ? `Ø ${fmtNum(2 * circle.r)}` : `${fmtNum(b.x1 - b.x0)} × ${fmtNum(b.y1 - b.y0)}`
  const lines: string[] = []
  if (centreline) {
    const long = Math.max(b.x1 - b.x0, b.y1 - b.y0)
    const wide = Math.min(b.x1 - b.x0, b.y1 - b.y0)
    const passes = wide > w! + EPS ? ` (${fmtNum(w!)} d'eina + ${fmtNum(wide - w!)} entre passades)` : ""
    lines.push(`Amplada ${fmtNum(wide)}${passes} · llargada ${mm(long)}`, `Recorregut ${mm(len)}`)
  } else if (o.kind === "pocket" || o.kind === "rough" || o.kind === "slot") {
    const long = o.kind === "pocket" ? Math.max(b.x1 - b.x0, b.y1 - b.y0) : len
    const wide = o.kind === "pocket" ? Math.min(b.x1 - b.x0, b.y1 - b.y0) : (w ?? 0)
    lines.push(`Amplada ${wide ? fmtNum(wide) : "?"} · llargada ${mm(long)}`)
  } else lines.push(`${size} mm · llargada ${mm(len)}`)
  lines.push(toolLine, depthLine(o), `X ${fmtNum(b.x0)} · Y ${fmtNum(b.y0)} des de l'origen`)
  const dims = sizeDims(b)
  const q = partOf(view, o, focus)
  if (q && !(o.kind === "contour" && o.side === "outside")) {
    const g = gapDims(b, partBox(q))
    dims.push(...g.dims)
    lines.push(g.text)
  }
  return { title, lines, dims: top ? dims : [], focus }
}

/** Fitxa i cotes del que s'inspecciona, o `null` si ja no hi és (canvi de tauler). */
export function camInspect(view: CamSheetView, t: CamTarget | null): CamInspection | null {
  if (!t) return null
  if (t.kind === "part") {
    const q = view.preview.parts.find((p) => p.ref === t.ref)
    return q ? inspectPart(view, q) : null
  }
  const o = view.preview.ops.find((x) => x.n === t.n)
  return o ? inspectOp(view, o) : null
}
