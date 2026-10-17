import { arcOf, bounds, cubicAt, edgeOf, sampleProfile, type PNode, type Vec2 } from "../../../core/model"
import type { SetOptions } from "../../history/history"

/** Canvi en viu (arrossegant): el pas de desfer es fa en deixar anar. */
export const LIVE: SetOptions = { commit: false }
/** Eines de l'editor de perfil. */
export type Tool = "edit" | "pen" | "bend" | "erase"
/** Constant del cercle amb cúbiques: manegador = k · radi. */
export type Drag =
  | { kind: "node"; i: number; x: number; y: number; moved: boolean; from?: "bend" | "erase" }
  | { kind: "handle"; i: number; which: "in" | "out"; moved: boolean }
  | { kind: "edge"; i: number; x: number; y: number; moved: boolean }
  | { kind: "pen"; i: number; x: number; y: number; moved: boolean }
/** Vista quadrada del dibuix (mm). */
type View = { x0: number; y0: number; span: number }

/** Punt mig d'un costat (sobre la corba). */
export function edgeMid(nodes: PNode[], i: number): Vec2 {
  const a = nodes[i]!
  const c = nodes[(i + 1) % nodes.length]!
  const e = edgeOf(nodes, i)
  if (e.kind === "cubic") return cubicAt([a.x, a.y], e.p1, e.p2, [c.x, c.y], 0.5)
  if (e.kind === "arc") {
    const f = arcOf([a.x, a.y], [c.x, c.y], e.b)
    const t = f.start + f.sweep / 2
    return [f.cx + f.r * Math.cos(t), f.cy + f.r * Math.sin(t)]
  }
  return [(a.x + c.x) / 2, (a.y + c.y) / 2]
}

/** Traç obert (mentre es dibuixa amb la ploma): cada costat com a cúbica o recta, sense tancar. */
export function openPath(nodes: PNode[]): string {
  let d = `M ${nodes[0]!.x} ${-nodes[0]!.y}`
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i]!
    const c = nodes[i + 1]!
    const e = edgeOf(nodes, i)
    d += e.kind === "cubic" ? ` C ${e.p1[0]} ${-e.p1[1]} ${e.p2[0]} ${-e.p2[1]} ${c.x} ${-c.y}` : ` L ${c.x} ${-c.y}`
    void a
  }
  return d
}

/** Vista quadrada que conté el perfil (amb les corbes) amb marge. */
export function viewOf(nodes: PNode[]): View {
  const pts = nodes.length >= 2 ? sampleProfile(nodes) : nodes.map((n) => [n.x, n.y] as Vec2)
  const b = bounds(pts.length ? pts : [[0, 0]])
  const w = b.x1 - b.x0
  const h = b.y1 - b.y0
  const span = Math.max(w, h, 100) * 1.3
  return { x0: b.x0 + w / 2 - span / 2, y0: b.y0 + h / 2 - span / 2, span }
}

/** Línies de la quadrícula de la vista (cada `minor` mm; les de cada `major`, més gruixudes). */
export function gridLinesOf(view: View, minor: number, major: number): { x1: number; y1: number; x2: number; y2: number; major: boolean }[] {
  const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
  const { x0, y0, span } = view
  const s0x = Math.floor(x0 / minor) * minor
  const s0y = Math.floor(y0 / minor) * minor
  for (let x = s0x; x <= x0 + span; x += minor) out.push({ x1: x, y1: -y0, x2: x, y2: -(y0 + span), major: Math.abs(x % major) < 1e-6 })
  for (let y = s0y; y <= y0 + span; y += minor) out.push({ x1: x0, y1: -y, x2: x0 + span, y2: -y, major: Math.abs(y % major) < 1e-6 })
  return out
}
