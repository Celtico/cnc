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
