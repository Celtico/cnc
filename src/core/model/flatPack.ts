import { defaultModule, newId, type Composition } from "./composition"
import { partSize, type FreePart, type PartOrient } from "./freePart"
import type { PNode } from "./polygon"

/**
 * Peces lliures noves i plantilles flat-pack (mobles d'encaix: pestanyes passants, mitja
 * fusta, dits). Les peces es col·loquen perquè el build hi faci els encaixos sols.
 */

const WOOD = "Roure massís / xapat"
const T = 19

/** El·lipse de w × h amb quatre cúbiques. */
function ellipse(w: number, h: number): PNode[] {
  const K = 0.5522847498
  const a = w / 2, b = h / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: h, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

/** Pota amb un arc a baix (el que fa que el tamboret recolzi en quatre punts). */
function archLeg(w: number, h: number, arch: number): PNode[] {
  const m = w * 0.22
  return [
    { x: 0, y: 0 },
    { x: m, y: 0, b: -((2 * arch) / (w - 2 * m)) },
    { x: w - m, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ]
}

const part = (p: Omit<FreePart, "id" | "material" | "thickness"> & Partial<Pick<FreePart, "material" | "thickness">>): FreePart => ({
  id: newId("p"),
  material: WOOD,
  thickness: T,
  ...p,
})

/** Composició flat-pack: un mòdul guardat (no es fa) i les peces lliures. */
function flatPack(parts: FreePart[]): Composition {
  return { kind: "lliure", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [], parts, joinery: { clearance: 0.2, tool: 6, tabWidth: 50 } }
}

/**
 * Prestatgeria d'encaix: dos laterals, prestatges que els travessen amb pestanyes passants
 * i un travesser al darrere; el prestatge de dalt fa dits a les cantonades.
 */
export function flatPackShelf(): Composition {
  const W = 800, H = 900, D = 300
  const sides = [0, W - T].map((x, i) => part({ name: i ? "Lateral dret" : "Lateral esquerre", orient: "side", w: D, h: H, x, y: 0, z: 0 }))
  const shelves = [60, 330, 600, H - T].map((y, i) => part({ name: `Prestatge ${i + 1}`, orient: "flat", w: W, h: D, x: 0, y, z: 0 }))
  const rail = part({ name: "Travesser", orient: "front", w: W, h: 100, x: 0, y: 700, z: 20 })
  return flatPack([...sides, ...shelves, rail])
}

/** Tamboret: dues potes encreuades a mitja fusta i seient rodó amb pestanyes passants. */
export function flatPackStool(): Composition {
  const W = 400, H = 468, S = 380
  const c = W / 2 - T / 2
  const legA = part({ name: "Pota davant", orient: "front", w: W, h: H, x: 0, y: 0, z: c, shape: archLeg(W, H, 70) })
  const legB = part({ name: "Pota costat", orient: "side", w: W, h: H, x: c, y: 0, z: 0, shape: archLeg(W, H, 70) })
  const o = (W - S) / 2
  const seat = part({ name: "Seient", orient: "flat", w: S, h: S, x: o, y: H - T, z: o, shape: ellipse(S, S) })
  return flatPack([legA, legB, seat])
}

/** Peça nova per a «Afegir peça», davant del moble i fàcil de trobar. */
export function newFreePart(orient: PartOrient, at: { x: number; y: number; z: number }, material = WOOD, thickness = T): FreePart {
  const dims = { front: { w: 600, h: 400 }, side: { w: 300, h: 600 }, flat: { w: 600, h: 300 } }[orient]
  const names = { front: "Tauler de cara", side: "Tauler de costat", flat: "Tauler estirat" }
  const p = part({ name: names[orient], orient, ...dims, ...at, material, thickness })
  const s = partSize(p)
  return { ...p, x: Math.round(at.x - s[0] / 2) }
}
