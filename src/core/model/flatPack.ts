import { defaultModule, newId, type Composition } from "./composition"
import { partSize, type FreePart, type PartOrient } from "./freePart"
import { ellipseNodes as ellipse, type PNode } from "./polygon"

/**
 * Peces lliures noves i plantilles flat-pack (mobles d'encaix: pestanyes passants, mitja
 * fusta, dits). Les peces es col·loquen perquè el build hi faci els encaixos sols.
 */

const WOOD = "Roure massís / xapat"
const T = 19

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

/**
 * Escriptori flat-pack: laterals amb arc i cantonada arrodonida que travessen el tauler
 * (pestanyes passants vistes), travesser del darrere i prestatge de sota amb pestanyes.
 */
export function flatPackDesk(): Composition {
  const W = 1200, H = 740, D = 600
  const sideShape: PNode[] = [
    { x: 0, y: 0 },
    { x: 90, y: 0, b: -0.55 },
    { x: D - 90, y: 0 },
    { x: D, y: 0 },
    { x: D, y: H - 60, out: [0, 33] },
    { x: D - 60, y: H, in: [33, 0] },
    { x: 0, y: H },
  ]
  const sides = [0, W - T].map((x, i) => part({ name: i ? "Lateral dret" : "Lateral esquerre", orient: "side", w: D, h: H, x, y: 0, z: 0, shape: sideShape }))
  // El tauler sobresurt 40 mm pels costats: els laterals el travessen i les pestanyes es veuen a sobre.
  const top = part({ name: "Tauler", orient: "flat", w: W + 80, h: D, x: -40, y: H - T, z: 0 })
  const rail = part({ name: "Travesser", orient: "front", w: W, h: 160, x: 0, y: 480, z: 40 })
  const shelf = part({ name: "Prestatge de sota", orient: "flat", w: W, h: 320, x: 0, y: 160, z: 40 })
  return flatPack([...sides, top, rail, shelf])
}
