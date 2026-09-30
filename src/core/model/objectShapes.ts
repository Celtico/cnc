import { DEFAULT_JOINERY, tidyPart, type FreePart } from "./freePart"
import { defaultModule, newId, type Composition } from "./composition"
import { ellipseNodes, type PNode } from "./polygon"

/**
 * Formes i ajudes per fer objectes (peces lliures sense nesting) per als ambients: el·lipses,
 * rectangles arrodonits (coixins), fulles, ones (cortines). Tot és un perfil extrudit.
 */
const K = 0.5522847498

/** El·lipse de w × h (peces rodones). */
export const ellipse = ellipseNodes

/** Rectangle de w × h amb les cantonades arrodonides de radi r (coixins, matalassos, taulers). */
export function roundRect(w: number, h: number, r: number): PNode[] {
  const q = Math.max(1, Math.min(r, w / 2 - 1, h / 2 - 1))
  const k = K * q
  return [
    { x: w, y: q, in: [0, -k] },
    { x: w, y: h - q, out: [0, k] },
    { x: w - q, y: h, in: [k, 0] },
    { x: q, y: h, out: [-k, 0] },
    { x: 0, y: h - q, in: [0, k] },
    { x: 0, y: q, out: [0, -k] },
    { x: q, y: 0, in: [-k, 0] },
    { x: w - q, y: 0, out: [k, 0] },
  ]
}

/** Fulla (punxeguda a dalt i a baix), de w × h. */
export function leaf(w: number, h: number): PNode[] {
  return [
    { x: w / 2, y: 0, t: "corner" },
    { x: w, y: h * 0.45, in: [0, -h * 0.3], out: [0, h * 0.3], t: "smooth" },
    { x: w / 2, y: h, t: "corner" },
    { x: 0, y: h * 0.45, in: [0, h * 0.3], out: [0, -h * 0.3], t: "smooth" },
  ]
}

/** Banda ondulada (cortina vista de dalt): `folds` plecs al llarg de w, fondària d, gruix t. */
export function wave(w: number, d: number, folds: number, t = 18): PNode[] {
  const n = Math.max(1, Math.round(folds)) * 2
  const p = w / n
  const A = Math.max(1, (d - t) / 2)
  const hk = p * 0.36
  const top: PNode[] = Array.from({ length: n + 1 }, (_, i) => ({ x: i * p, y: i % 2 ? 2 * A : 0, ...(i > 0 ? { in: [-hk, 0] as [number, number] } : {}), ...(i < n ? { out: [hk, 0] as [number, number] } : {}), t: "smooth" as const }))
  const bottom: PNode[] = top
    .slice()
    .reverse()
    .map((q, j) => {
      const i = n - j
      return { x: q.x, y: q.y + t, ...(i < n ? { in: [hk, 0] as [number, number] } : {}), ...(i > 0 ? { out: [-hk, 0] as [number, number] } : {}), t: "smooth" as const }
    })
  return [...top, ...bottom]
}

type Q = Omit<FreePart, "id" | "nest" | "joints">
type Shape = PNode[] | undefined

/** Composició d'objecte amb aquestes peces (sense nesting ni encaixos). */
export const objectComposition = (parts: Q[]): Composition => ({
  kind: "objecte",
  modules: [defaultModule(newId("m"), "Mòdul 1")],
  references: [],
  // Mides al mm (les formes calculades donen decimals llargs).
  parts: parts.map((q) => ({ id: newId("p"), nest: false, joints: false, ...tidyPart(q) })),
  joinery: { ...DEFAULT_JOINERY },
})

/** Peça plana (pla X·Z): w de costat, d de fons, t d'alçada; (x, y, z) la cantonada. */
export const flat = (name: string, material: string, x: number, y: number, z: number, w: number, d: number, t: number, shape?: Shape): Q => ({ name, orient: "flat", material, x, y, z, w, h: d, thickness: t, ...(shape ? { shape } : {}) })
/** Peça de cara (pla X·Y): w de costat, h d'alçada, t de fons. */
export const front = (name: string, material: string, x: number, y: number, z: number, w: number, h: number, t: number, shape?: Shape): Q => ({ name, orient: "front", material, x, y, z, w, h, thickness: t, ...(shape ? { shape } : {}) })
/** Peça de costat (pla Z·Y): d de fons, h d'alçada, t de costat (X). */
export const side = (name: string, material: string, x: number, y: number, z: number, d: number, h: number, t: number, shape?: Shape): Q => ({ name, orient: "side", material, x, y, z, w: d, h, thickness: t, ...(shape ? { shape } : {}) })
/** Cilindre vertical de diàmetre dia centrat a (cx, cz). */
export const cyl = (name: string, material: string, cx: number, y: number, cz: number, dia: number, h: number): Q => flat(name, material, cx - dia / 2, y, cz - dia / 2, dia, dia, h, ellipse(dia, dia))
/** El·lipsoide aproximat amb `n` discs (capçades, pufs, arbustos): com més discs, més rodó. */
export const blob = (name: string, material: string, cx: number, y: number, cz: number, w: number, d: number, h: number, n = 7): Q[] =>
  Array.from({ length: n }, (_, k) => {
    const mid = (k + 0.5) / n
    const f = Math.max(0.3, Math.sqrt(1 - (2 * mid - 1) ** 2))
    const ww = w * f, dd = d * f
    return flat(name, material, cx - ww / 2, y + (h * k) / n, cz - dd / 2, ww, dd, h / n, ellipse(ww, dd))
  })
