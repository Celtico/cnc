import { footprintBox, wallCorners, type Ambient, type PlanPt, type Wall } from "../../core/model"
import type { ItemGeometry } from "./ambientData"

/** Vista del plànol: pantalla = món (mm) × s + (tx, ty). */
export interface View {
  tx: number
  ty: number
  s: number
}

export type Tool = "select" | "wall" | "room" | "window" | "door" | "calibrate"
/** Selecció: un element, una paret o un grup d'elements (`id` = nom del grup). */
export type Selection = { kind: "item" | "wall" | "group"; id: string } | null

export const GRID = 10

export const snapGrid = (v: number, g = GRID) => Math.round(v / g) * g

/** Caixa de tot el que hi ha al plànol (parets, elements i imatge). */
export function ambientBox(a: Ambient, geos: Map<string, ItemGeometry | null>): { x0: number; y0: number; x1: number; y1: number } | null {
  const xs: number[] = [], ys: number[] = []
  for (const w of a.walls)
    for (const p of wallCorners(w)) {
      xs.push(p[0])
      ys.push(p[1])
    }
  for (const it of a.items) {
    const g = geos.get(it.id)
    if (!g) continue
    const b = footprintBox(it.x, it.y, g.w, g.d, it.rot)
    xs.push(b.x0, b.x1)
    ys.push(b.y0, b.y1)
  }
  if (a.plan) {
    xs.push(a.plan.x, a.plan.x + a.plan.pxW * a.plan.mmPerPx)
    ys.push(a.plan.y, a.plan.y + a.plan.pxH * a.plan.mmPerPx)
  }
  if (!xs.length) return null
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }
}

/** Vista que encabeix la caixa (o un pis de 8 × 6 m si no hi ha res) en un requadre de W × H px. */
export function fitView(box: { x0: number; y0: number; x1: number; y1: number } | null, W: number, H: number): View {
  const b = box ?? { x0: -1000, y0: -1000, x1: 7000, y1: 5000 }
  const pad = 48
  const bw = Math.max(1000, b.x1 - b.x0), bh = Math.max(1000, b.y1 - b.y0)
  const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh)
  return { s, tx: W / 2 - ((b.x0 + b.x1) / 2) * s, ty: H / 2 - ((b.y0 + b.y1) / 2) * s }
}

/** Punt amb l'angle ajustat a múltiples de 15° respecte a `from` i la llargada a 10 mm. */
export function snapAngle(from: PlanPt, to: PlanPt, step = 15): PlanPt {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const L = snapGrid(Math.hypot(dx, dy))
  const a = Math.round(Math.atan2(dy, dx) / ((step * Math.PI) / 180)) * ((step * Math.PI) / 180)
  return [Math.round(from[0] + L * Math.cos(a)), Math.round(from[1] + L * Math.sin(a))]
}

/** Extrem de paret més proper a `p` (a menys de `tol` mm), si n'hi ha; `skip`: la paret que s'arrossega. */
export function nearestEndpoint(walls: Wall[], p: PlanPt, tol: number, skip?: (w: Wall, end: "a" | "b") => boolean): PlanPt | null {
  let best: PlanPt | null = null
  let bd = tol
  for (const w of walls)
    for (const end of ["a", "b"] as const) {
      if (skip?.(w, end)) continue
      const q = w[end]
      const d = Math.hypot(q[0] - p[0], q[1] - p[1])
      if (d < bd) {
        bd = d
        best = q
      }
    }
  return best
}

export const samePt = (a: PlanPt, b: PlanPt) => Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5

/** Text de mida (mm o cm segons la unitat de pantalla). */
export const fmtLen = (mm: number, unit: "mm" | "cm") => (unit === "cm" ? `${Math.round(mm / 10)} cm` : `${Math.round(mm)} mm`)

/** Vista recordada de l'editor d'ambients (Plànol · 3D). */
export const AMBIENT_TAB_KEY = "mobles:ambient-tab"

/**
 * Càmera d'interior (m): a l'alçada del pit (1,35 m) i anivellada, a prop de la paret de davant (y gran) i mirant la del
 * fons (y petita), al mig de l'habitació. `null` si no hi ha parets.
 */
export function eyePose(a: Ambient): { pos: [number, number, number]; target: [number, number, number] } | null {
  if (!a.walls.length) return null
  const xs = a.walls.flatMap((w) => [w.a[0], w.b[0]]), ys = a.walls.flatMap((w) => [w.a[1], w.b[1]])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2000
  const back = Math.min(200, (y1 - y0) * 0.1)
  // Càmera anivellada (verticals rectes, com la fotografia d'interiors) a 1,35 m.
  return { pos: [cx, 1.35, (y1 - back) / 1000], target: [cx, 1.35, y0 / 1000] }
}
