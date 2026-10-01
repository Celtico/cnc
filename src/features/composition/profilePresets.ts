import { bendEdge, filletNode, type PNode } from "../../core/model"

const KAPPA = 0.5522847498

const rect = (w: number, h: number): PNode[] => [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }]

/** Formes de partida (mm), amb la cantonada mínima a (0, 0). */
export const PRESETS: { id: string; label: string; make: (w: number, h: number) => PNode[] }[] = [
  { id: "rect", label: "Rectangle", make: rect },
  {
    id: "round",
    label: "Arrodonit",
    make: (w, h) => {
      let p = rect(w, h)
      const r = Math.round(Math.min(w, h) / 6)
      for (const i of [3, 2, 1, 0]) p = filletNode(p, i, r) ?? p
      return p
    },
  },
  {
    id: "ellipse",
    label: "El·lipse",
    make: (w, h) => {
      const a = w / 2, b = h / 2
      return [
        { x: w, y: b, in: [0, -KAPPA * b], out: [0, KAPPA * b], t: "smooth" },
        { x: a, y: h, in: [KAPPA * a, 0], out: [-KAPPA * a, 0], t: "smooth" },
        { x: 0, y: b, in: [0, KAPPA * b], out: [0, -KAPPA * b], t: "smooth" },
        { x: a, y: 0, in: [-KAPPA * a, 0], out: [KAPPA * a, 0], t: "smooth" },
      ]
    },
  },
  { id: "arch", label: "Arc", make: (w, h) => bendEdge([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h * 0.6 }, { x: 0, y: h * 0.6 }], 2, [w / 2, h]) },
  {
    id: "l",
    label: "L",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 3)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: t }, { x: t, y: t }, { x: t, y: h }, { x: 0, y: h }]
    },
  },
  {
    id: "u",
    label: "U",
    make: (w, h) => {
      const t = Math.round(Math.min(w, h) / 4)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: w - t, y: h }, { x: w - t, y: t }, { x: t, y: t }, { x: t, y: h }, { x: 0, y: h }]
    },
  },
  {
    id: "chamfer",
    label: "Bisell",
    make: (w, h) => {
      const c = Math.round(Math.min(w, h) / 4)
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h - c }, { x: w - c, y: h }, { x: 0, y: h }]
    },
  },
]

const near = (a: number | undefined, b: number | undefined, tol: number) => Math.abs((a ?? 0) - (b ?? 0)) <= tol

/**
 * Quina forma de partida és `shape` (refeta a la mida dels seus nodes, perquè la forma es desa a
 * la mida que tenia en triar-la), o `undefined` si s'ha editat a mà.
 */
export function matchPreset(shape: PNode[]): string | undefined {
  if (shape.length === 0) return undefined
  const xs = shape.map((n) => n.x)
  const ys = shape.map((n) => n.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0
  const tol = Math.max(0.5, Math.max(w, h) * 1e-4)
  return PRESETS.find((p) => {
    const ref = p.make(w, h)
    return (
      ref.length === shape.length &&
      ref.every((r, i) => {
        const n = shape[i]!
        return (
          near(n.x - x0, r.x, tol) &&
          near(n.y - y0, r.y, tol) &&
          near(n.b, r.b, 1e-3) &&
          near(n.in?.[0], r.in?.[0], tol) &&
          near(n.in?.[1], r.in?.[1], tol) &&
          near(n.out?.[0], r.out?.[0], tol) &&
          near(n.out?.[1], r.out?.[1], tol)
        )
      })
    )
  })?.id
}
