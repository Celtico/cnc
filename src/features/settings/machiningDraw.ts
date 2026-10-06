import { useCallback, useState } from "react"
import { AXIS_ENDS, axisRect, newId, partAxes, type GenOp, type GenTool, type MachineTool, type PartKind, type Pos } from "../../core/model"
import type { HardwareView } from "../../core/import/views"
import { toolLabel } from "../../core/model"

/**
 * Geometria del dibuix del generador de mecanitzats (Preferències › Ferratges): una peça d'exemple de cada grup en el
 * pla P·Q (mm, Q amunt), el punt de referència al mig, les operacions i la vista 2D del fitxer posada al punt de
 * referència. Pur (sense React): el fa servir `MachiningGenerator.tsx`.
 */

/**
 * Estat de la pantalla del generador, compartit entre el dibuix (a l'esquerra, amb el 3D) i el formulari (a la dreta):
 * la peça que es mira, el mecanitzat triat i la vista de fons (gir i mirall). Es reinicia en canviar de ferratge.
 */
export interface MachiningUi {
  part: PartKind | null
  sel: string | null
  view: string | null
  rot: 0 | 90 | 180 | 270
  mirror: boolean
}
const UI0: MachiningUi = { part: null, sel: null, view: null, rot: 0, mirror: false }
export function useMachiningUi(itemId: string | undefined): [MachiningUi, (patch: Partial<MachiningUi>) => void] {
  const [s, setS] = useState<{ id: string | undefined; ui: MachiningUi }>({ id: itemId, ui: UI0 })
  const ui = s.id === itemId ? s.ui : UI0
  const patch = useCallback((p: Partial<MachiningUi>) => setS((cur) => ({ id: itemId, ui: { ...(cur.id === itemId ? cur.ui : UI0), ...p } })), [itemId])
  return [ui, patch]
}

/** Mida d'exemple de cada grup de peces (P × Q, mm). */
export const SAMPLE: Record<PartKind, [number, number]> = {
  front: [450, 700],
  side: [560, 720],
  bottom: [600, 560],
  top: [600, 560],
  shelf: [600, 520],
  back: [600, 720],
  drawer: [500, 160],
  part: [600, 400],
  any: [600, 400],
}

/** Noms dels dos eixos i dels seus cantells per a un grup («De costat: esquerra · dreta»). */
export function axisNames(part: PartKind): { p: { name: string; ends: [string, string] }; q: { name: string; ends: [string, string] } } {
  const ax = partAxes(part)
  if (!ax) return { p: { name: "Eix 1", ends: ["inici", "final"] }, q: { name: "Eix 2", ends: ["inici", "final"] } }
  const label = { x: "De costat", y: "Alçada", z: "Fondària" } as const
  return { p: { name: label[ax.p], ends: AXIS_ENDS[ax.p] }, q: { name: label[ax.q], ends: AXIS_ENDS[ax.q] } }
}

/** Coordenada a la peça d'exemple d'una posició (mida `size` de l'eix, referència a `ref`). */
export function sampleAt(pos: Pos, size: number, ref: number): number {
  return pos.from === "ref" ? ref + pos.at : pos.from === "min" ? pos.at : pos.from === "max" ? size - pos.at : size / 2 + pos.at
}

/** El valor de `at` que posa la coordenada a `x` amb l'ancoratge de `pos`. */
export function atFor(pos: Pos, x: number, size: number, ref: number): number {
  const v = pos.from === "ref" ? x - ref : pos.from === "min" ? x : pos.from === "max" ? size - x : x - size / 2
  return Math.round(v * 10) / 10
}

export type Shape =
  | { kind: "circle"; cx: number; cy: number; r: number; through: boolean; faceB: boolean }
  | { kind: "rect"; x0: number; y0: number; x1: number; y1: number; through: boolean; faceB: boolean }
  | { kind: "poly"; pts: [number, number][]; through: boolean; faceB: boolean }
  | { kind: "edge"; cx: number; cy: number; r: number; dx: number; dy: number; depth: number }

/** La forma d'una operació a la peça d'exemple (`size` = P × Q, `ref` = punt de referència). */
export function opShape(op: GenOp, size: [number, number], ref: [number, number]): Shape | null {
  const cp = sampleAt(op.p, size[0], ref[0])
  const cq = sampleAt(op.q, size[1], ref[1])
  const through = !!op.through
  const faceB = op.face === "B"
  if (op.kind === "drill" && op.face === "edge") {
    const r = (op.d ?? 0) / 2
    const e = op.edge ?? "pmin"
    const [dx, dy] = e === "pmin" ? [1, 0] : e === "pmax" ? [-1, 0] : e === "qmin" ? [0, 1] : [0, -1]
    const cx = e === "pmin" ? 0 : e === "pmax" ? size[0] : cp
    const cy = e === "qmin" ? 0 : e === "qmax" ? size[1] : cq
    return { kind: "edge", cx, cy, r, dx, dy, depth: op.depth }
  }
  if (op.kind === "drill") return { kind: "circle", cx: cp, cy: cq, r: (op.d ?? 0) / 2, through, faceB }
  if (op.kind === "groove") {
    const w = op.w ?? 0
    const half = (op.len ?? 0) / 2
    if (op.along === "q") return { kind: "rect", x0: cp - w / 2, x1: cp + w / 2, y0: op.full ? 0 : cq - half, y1: op.full ? size[1] : cq + half, through, faceB }
    return { kind: "rect", x0: op.full ? 0 : cp - half, x1: op.full ? size[0] : cp + half, y0: cq - w / 2, y1: cq + w / 2, through, faceB }
  }
  if (op.kind === "pocket") {
    const w = op.w ?? 0, h = op.h ?? 0
    return { kind: "rect", x0: cp - w / 2, x1: cp + w / 2, y0: cq - h / 2, y1: cq + h / 2, through, faceB }
  }
  const pts = (op.points ?? []).map(([a, b]) => [cp + a, cq + b] as [number, number])
  if (pts.length < 3) return null
  const rect = !through ? axisRect(pts) : null
  if (rect) return { kind: "rect", x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3], through, faceB }
  return { kind: "poly", pts, through, faceB }
}

/** Gir d'una vista (graus, antihorari) i transformació al punt de referència. */
export function placeLines(view: HardwareView, rot: 0 | 90 | 180 | 270, mirror: boolean, ref: [number, number]): number[][] {
  const tf = (x: number, y: number): [number, number] => {
    const mx = mirror ? -x : x
    const [a, b] = rot === 0 ? [mx, y] : rot === 90 ? [-y, mx] : rot === 180 ? [-mx, -y] : [y, -mx]
    return [ref[0] + a, ref[1] + b]
  }
  return view.lines.map((l) => {
    const out: number[] = []
    for (let i = 0; i + 1 < l.length; i += 2) out.push(...tf(l[i]!, l[i + 1]!))
    return out
  })
}

/** Punts on s'enganxa un clic al dibuix: els vèrtexs de la vista i el centre dels cercles (polilínies petites tancades). */
export function snapPoints(lines: number[][]): [number, number][] {
  const out: [number, number][] = []
  for (const l of lines) {
    const n = l.length / 2
    for (let i = 0; i < n; i++) out.push([l[2 * i]!, l[2 * i + 1]!])
    if (n >= 8 && Math.hypot(l[0]! - l[2 * n - 2]!, l[1]! - l[2 * n - 1]!) < 0.05) {
      let sx = 0, sy = 0
      for (let i = 0; i < n; i++) {
        sx += l[2 * i]!
        sy += l[2 * i + 1]!
      }
      out.push([sx / n, sy / n])
    }
  }
  return out
}

/** El punt més proper a `p` a menys de `tol`, o `p`. */
export function snapTo(p: [number, number], pts: [number, number][], tol: number): [number, number] {
  let best: [number, number] | null = null
  let d = tol
  for (const q of pts) {
    const e = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (e < d) {
      d = e
      best = q
    }
  }
  return best ?? p
}

/** Una operació nova (forat Ø5 × 12, cara A, al punt de referència). */
export function newOp(part: PartKind): GenOp {
  return { id: newId("op"), part, kind: "drill", face: "A", d: 5, depth: 12, p: { from: "ref", at: 0 }, q: { from: "ref", at: 0 } }
}

/** Canvia el tipus d'una operació amb mides raonables per al nou. */
export function withKind(op: GenOp, kind: GenOp["kind"]): GenOp {
  const { d: _d, w: _w, h: _h, len: _l, full: _f, along: _a, r: _r, points: _p, edge: _e, tool: _t, ...rest } = op
  const face = op.face === "edge" && kind !== "drill" ? "A" : op.face
  if (kind === "drill") return { ...rest, kind, face, d: op.d ?? 5, ...(op.edge ? { edge: op.edge } : {}) }
  if (kind === "groove") return { ...rest, kind, face, w: op.w ?? 8, len: op.len ?? 200, along: op.along ?? "p" }
  if (kind === "pocket") return { ...rest, kind, face, w: op.w ?? 40, h: op.h ?? 20 }
  return { ...rest, kind, face, points: op.points ?? [[-20, -10], [20, -10], [20, 10], [-20, 10]] }
}

/** Les eines de la màquina per defecte que el generador pot fer servir (muntades: broques i freses), amb la seva etiqueta. */
export function genTools(tools: readonly MachineTool[]): GenTool[] {
  return tools.filter((t) => t.mounted && (t.kind === "drill" || t.kind === "router") && t.diameter > 0).map((t) => ({ code: t.code, kind: t.kind, diameter: t.diameter, maxDepth: t.maxDepth, label: toolLabel(t) }))
}

/** Text dels punts d'un contorn («x, y» per línia) i lectura (`null` si no és vàlid). */
export const pointsText = (pts: [number, number][]) => pts.map(([x, y]) => `${x}, ${y}`).join("\n")
export function parsePoints(text: string): [number, number][] | null {
  const out: [number, number][] = []
  for (const line of text.split(/[\n;]+/)) {
    const t = line.trim()
    if (!t) continue
    const m = /^(-?\d+(?:[.,]\d+)?)\s*[\s,]\s*(-?\d+(?:[.,]\d+)?)$/.exec(t.replace(/,(?=\d)/g, "."))
    if (!m) return null
    out.push([Number(m[1]), Number(m[2])])
  }
  return out.length >= 3 ? out : null
}
