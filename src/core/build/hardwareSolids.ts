import type { Hole, Panel, Vec3 } from "../model"
import { toWorld } from "./geometry"

/**
 * **Dibuix 3D dels ferratges de l'app** (els de sèrie, sense model importat): caixes i cilindres senzills però
 * reconeixibles, posats amb les mateixes dades que fa el motor (els forats amb la seva etiqueta, els accessoris de
 * `extras`). Pur (sense three): el visor del moble («Ferratges»), «Com va muntat» i les miniatures de Preferències ›
 * Ferratges els pinten amb `viewer/hardwareShapes.ts`, i `hardwareMount` els fa servir per enquadrar la càmera. **Només
 * es veuen**: no es fabriquen ni surten al render, l'AR ni les exportacions.
 *
 * Coordenades locals de la peça (mm): x al llarg (`length`), y a l'ample (`width`), z al gruix (cara A a z = gruix).
 *
 * - **Frontissa** (cassoleta `hinge`): la cassoleta dins del forat amb l'ala de cargols, el braç que va al lateral i la
 *   placa a la cara de dins del lateral (tot amb el front: s'obre amb ell).
 * - **System 32**: un suport de prestatge (`pins`, els forats de la filera just sota un prestatge, `shelfPins`).
 * - **Espiga** (`dowel`, al forat de cara): el cilindre de faig sencer, la resta fora de la cara (dins de la unió).
 * - **Guia de calaix** (`slide`): el cos de la guia al lateral del moble i la corredora al lateral de la caixa.
 * - **Braç d'abatible** (`flap`): la placa al front i el braç cap a dins.
 * - **Imant** (`magnet`): el catxet al cantell i la placa d'acer a la cara.
 * - **Push** (`Panel.push`): el cos del Tip-On darrere del front, a la vora que obre, amb l'empenyedor.
 * - **Barra de penjar** (`rail-…`): els dos suports dels extrems. **Tira LED** (`led-…`): el perfil d'alumini al voltant.
 */
export type HwMaterial = "nickel" | "steel" | "dark" | "plastic" | "beech" | "alu"

/** Una caixa orientada: centre, eixos (unitaris) i mida al llarg de cada eix (mm). */
export interface HwBox {
  kind: "box"
  c: Vec3
  axes: [Vec3, Vec3, Vec3]
  size: Vec3
  mat: HwMaterial
}
/** Un cilindre: centre, eix (unitari), radi i llarg (mm). */
export interface HwCylinder {
  kind: "cyl"
  c: Vec3
  axis: Vec3
  r: number
  h: number
  mat: HwMaterial
}
export type HwSolid = HwBox | HwCylinder

const FRONTS = new Set(["door", "drawerFront", "flap", "grille", "hatch"])

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Un marc local (o: origen, e: cap a un cantell, a: al llarg del cantell, n: fora de la cara) per posar caixes amb
 * mides «de ferratge»: `box([e0, e1], [a0, a1], [n0, n1])` és el tros de l'espai entre aquests valors.
 */
function frame(o: Vec3, e: Vec3, a: Vec3, n: Vec3) {
  const at = (pe: number, pa: number, pn: number): Vec3 => add(add(add(o, e, pe), a, pa), n, pn)
  return {
    at,
    box(re: [number, number], ra: [number, number], rn: [number, number], mat: HwMaterial): HwBox {
      return { kind: "box", c: at((re[0] + re[1]) / 2, (ra[0] + ra[1]) / 2, (rn[0] + rn[1]) / 2), axes: [e, a, n], size: [Math.abs(re[1] - re[0]), Math.abs(ra[1] - ra[0]), Math.abs(rn[1] - rn[0])], mat }
    },
    /** Cilindre al llarg de n, del pla n0 al n1. */
    cyl(pe: number, pa: number, rn: [number, number], r: number, mat: HwMaterial): HwCylinder {
      return { kind: "cyl", c: at(pe, pa, (rn[0] + rn[1]) / 2), axis: n, r, h: Math.abs(rn[1] - rn[0]), mat }
    },
  }
}

/** L'entrada d'un forat (local) i la normal de la cara on entra (cap a fora). */
function entry(p: Panel, h: Pick<Hole, "x" | "y" | "face" | "edge">): { at: Vec3; n: Vec3 } {
  const T = p.thickness
  if (h.face === "A") return { at: [h.x, h.y, T], n: [0, 0, 1] }
  if (h.face === "B") return { at: [h.x, h.y, 0], n: [0, 0, -1] }
  switch (h.edge) {
    case "left":
      return { at: [0, h.y, T / 2], n: [-1, 0, 0] }
    case "right":
      return { at: [p.length, h.y, T / 2], n: [1, 0, 0] }
    case "bottom":
      return { at: [h.x, 0, T / 2], n: [0, -1, 0] }
    default:
      return { at: [h.x, p.width, T / 2], n: [0, 1, 0] }
  }
}

/** El cantell de la peça més a prop d'un punt (x, y): la direcció cap a ell (unitària, al pla) i la distància. */
function nearestEdge(p: Panel, x: number, y: number): { e: Vec3; d: number } {
  const c: { e: Vec3; d: number }[] = [
    { e: [-1, 0, 0], d: x },
    { e: [1, 0, 0], d: p.length - x },
    { e: [0, -1, 0], d: y },
    { e: [0, 1, 0], d: p.width - y },
  ]
  return c.reduce((a, b) => (b.d < a.d ? b : a))
}

/** El front porta el model d'una frontissa importada (llevat del tirador, la pota i els col·locats a mà). */
const hasImportedHinge = (p: Panel) => (p.fittings ?? []).some((f) => f.kind !== "handle" && f.kind !== "leg" && f.kind !== "item")

/** Frontissa de cassoleta de l'app: cassoleta i ala a la porta, braç i placa contra la cara de dins del lateral. */
function hingeSolids(p: Panel): HwSolid[] {
  if (!FRONTS.has(p.role) || hasImportedHinge(p)) return []
  const T = p.thickness
  const out: HwSolid[] = []
  for (const h of p.holes) {
    if (h.tag !== "hinge" || (h.face !== "A" && h.face !== "B")) continue
    const n: Vec3 = h.face === "A" ? [0, 0, 1] : [0, 0, -1]
    const { e, d } = nearestEdge(p, h.x, h.y)
    const a = cross(n, e)
    const f = frame([h.x, h.y, h.face === "A" ? T : 0], e, a, n)
    const R = h.diameter / 2
    // La cara de dins del lateral: un gruix (el del front, el del cos sol ser el mateix) cap a dins des del cantell.
    const sf = d - T
    out.push(
      // Cassoleta (dins del forat: es veu a través de la fusta translúcida) i la seva ala amb els dos cargols.
      f.cyl(0, 0, [-h.depth, 1.5], R - 0.3, "nickel"),
      f.box([-7, 7], [-(R + 11), R + 11], [0, 1.5], "nickel"),
      // Coll: de la cassoleta cap al lateral, una mica per sobre de la cara.
      f.box([sf - 20, Math.min(8, sf + 4)], [-9, 9], [0, 12], "nickel"),
      // Braç al llarg de la cara de dins del lateral, cap a dins del moble.
      f.box([sf - 20, sf - 10], [-9, 9], [2, 66], "nickel"),
      // Placa de muntatge, cargolada al lateral (a la filera de 37 mm des del davant).
      f.box([sf - 10, sf], [-21, 21], [17, 61], "dark"),
    )
  }
  return out
}

/** Guia de calaix: cos al lateral del moble (12 × 45) i corredora a la caixa (10 × 35), al llarg de la filera de forats. */
function slideSolids(p: Panel): HwSolid[] {
  const holes = p.holes.filter((h) => h.tag === "slide" && (h.face === "A" || h.face === "B"))
  if (!holes.length) return []
  const box = p.role === "drawerSide"
  const out: HwSolid[] = []
  // Fileres: forats amb la mateixa y (guia al llarg de x) o, si no, amb la mateixa x.
  const rows = new Map<string, Hole[]>()
  for (const h of holes) {
    const sameY = holes.filter((o) => Math.abs(o.y - h.y) < 1 && o.face === h.face).length > 1
    const k = sameY ? `y${Math.round(h.y)}${h.face}` : `x${Math.round(h.x)}${h.face}`
    rows.set(k, [...(rows.get(k) ?? []), h])
  }
  for (const [k, row] of rows) {
    const alongX = k.startsWith("y")
    const T = p.thickness
    const face = row[0]!.face
    const n: Vec3 = face === "A" ? [0, 0, 1] : [0, 0, -1]
    const e: Vec3 = alongX ? [1, 0, 0] : [0, 1, 0]
    const a = cross(n, e)
    const us = row.map((h) => (alongX ? h.x : h.y))
    const span = alongX ? p.length : p.width
    // El davant: l'extrem de la peça més a prop d'un forat de la filera (el primer forat és a ~37 del cantell de davant).
    // La guia comença 34 mm davant d'aquest forat i va cap enrere, com a mínim 250 mm o fins 40 mm passat l'últim.
    const u0 = Math.min(...us), u1 = Math.max(...us)
    const frontHigh = span - u1 < u0
    const len = Math.max(u1 - u0 + 74, 250)
    const [lo, hi] = frontHigh ? [Math.max(0, u1 + 34 - len), Math.min(span, u1 + 34)] : [Math.max(0, u0 - 34), Math.min(span, u0 - 34 + len)]
    const c = alongX ? row[0]!.y : row[0]!.x
    const o: Vec3 = alongX ? [0, c, face === "A" ? T : 0] : [c, 0, face === "A" ? T : 0]
    // Amb e = x i n = ±z, a = n × e és ±y: el «al llarg del cantell» és cap a l'altre eix del pla.
    const f = frame(o, e, a, n)
    if (box) out.push(f.box([lo, hi], [-17.5, 17.5], [0, 10], "steel"))
    else out.push(f.box([lo, hi], [-22.5, 22.5], [0, 12.5], "steel"), f.box([lo + 4, hi - 4], [-12, 12], [12.5, 13.5], "nickel"))
  }
  return out
}

/**
 * Espiga de faig de 35 mm: des del fons del forat de **cara** (la peça que continua; tota unió amb espigues en té un,
 * «mai mitja unió») i la resta fora, dins del forat de cantell de l'altra peça. Així cada espiga es dibuixa un sol cop i
 * es veu encara que l'altra peça no hi sigui (el lateral sol de «Com va muntat»).
 */
function dowelSolids(p: Panel): HwSolid[] {
  const out: HwSolid[] = []
  for (const h of p.holes) {
    if (h.tag !== "dowel" || (h.face !== "A" && h.face !== "B")) continue
    const { at, n } = entry(p, h)
    const out_ = Math.max(8, 35 - h.depth)
    out.push({ kind: "cyl", c: add(at, n, (out_ - h.depth) / 2), axis: n, r: h.diameter / 2 - 0.2, h: h.depth + out_, mat: "beech" })
  }
  return out
}

/** Suport de prestatge a un forat de la filera System 32: el passador i el tac on recolza el prestatge. */
function pinSolids(p: Panel, pins: readonly Hole[]): HwSolid[] {
  const out: HwSolid[] = []
  for (const h of pins) {
    if (h.face !== "A" && h.face !== "B") continue
    const { at, n } = entry(p, h)
    const R = h.diameter / 2
    out.push({ kind: "cyl", c: add(at, n, (12 - h.depth) / 2), axis: n, r: R - 0.2, h: h.depth + 12, mat: "nickel" })
    out.push({ kind: "cyl", c: add(at, n, 0.75), axis: n, r: R + 2.5, h: 1.5, mat: "nickel" })
  }
  return out
}

/** Braç d'abatible: la placa al front (al forat) i el braç cap a dins, inclinat cap al mig del front. */
function flapSolids(p: Panel): HwSolid[] {
  const out: HwSolid[] = []
  for (const h of p.holes) {
    if (h.tag !== "flap" || (h.face !== "A" && h.face !== "B")) continue
    const n: Vec3 = h.face === "A" ? [0, 0, 1] : [0, 0, -1]
    const { e } = nearestEdge(p, h.x, h.y)
    const a = cross(n, e)
    const f = frame([h.x, h.y, h.face === "A" ? p.thickness : 0], e, a, n)
    out.push(f.box([-14, 14], [-22, 22], [0, 4], "nickel"))
    // El braç: de la placa cap a dins del moble, inclinat 30° cap al mig del front (lluny del cantell de gir).
    const t = Math.PI / 6
    const dir = add(scale(n, Math.cos(t)), e, -Math.sin(t))
    const side = cross(a, dir)
    const L = 150
    out.push({ kind: "box", c: add(f.at(0, 0, 4), dir, L / 2), axes: [side, a, dir], size: [6, 14, L], mat: "dark" })
  }
  return out
}

/** Imant: el catxet (cos fosc i tapa niquelada) al forat de cantell; la placa d'acer al forat de cara. */
function magnetSolids(p: Panel): HwSolid[] {
  const out: HwSolid[] = []
  for (const h of p.holes) {
    if (h.tag !== "magnet") continue
    const { at, n } = entry(p, h)
    const R = h.diameter / 2 - 0.2
    if (h.face === "A" || h.face === "B") out.push({ kind: "cyl", c: add(at, n, (0.8 - h.depth) / 2), axis: n, r: R, h: h.depth + 0.8, mat: "steel" })
    else {
      out.push({ kind: "cyl", c: add(at, n, (1 - h.depth) / 2), axis: n, r: R, h: h.depth + 1 - 1.5, mat: "dark" })
      out.push({ kind: "cyl", c: add(at, n, 1 - 0.75), axis: n, r: R, h: 1.5, mat: "nickel" })
    }
  }
  return out
}

/** Push (Tip-On): el cos darrere del front, a la vora que obre (la contrària de les frontisses) o al mig, i l'empenyedor. */
function pushSolids(p: Panel): HwSolid[] {
  if (!p.push || !FRONTS.has(p.role)) return []
  const T = p.thickness
  const cups = p.holes.filter((h) => h.tag === "hinge" && (h.face === "A" || h.face === "B"))
  const face = cups[0]?.face ?? "A"
  const n: Vec3 = face === "A" ? [0, 0, 1] : [0, 0, -1]
  const z = face === "A" ? T : 0
  if (cups.length) {
    // La vora que obre: la contrària de la de les frontisses, a mitja alçada, darrere del lateral d'aquell costat.
    const { e: he } = nearestEdge(p, cups[0]!.x, cups[0]!.y)
    const e = scale(he, -1)
    const a = cross(n, e)
    const mid: Vec3 = [p.length / 2, p.width / 2, z]
    const half = Math.abs(e[0]) ? p.length / 2 : p.width / 2
    const f = frame(add(mid, e, half), e, a, n)
    return [f.box([-T - 17, -T], [-38, 38], [2, 22], "plastic"), f.cyl(-T - 8.5, 0, [0, 2], 4, "dark")]
  }
  // Calaix o abatible: al mig, darrere del front.
  const f = frame([p.length / 2, p.width / 2, z], [0, 1, 0], cross(n, [0, 1, 0]), n)
  return [f.box([-8.5, 8.5], [-38, 38], [2, 22], "plastic"), f.cyl(0, 0, [0, 2], 4, "dark")]
}

/** Barra de penjar (`rail-…`, el tub al llarg del gruix local): els suports dels dos extrems. */
function railSolids(p: Panel): HwSolid[] {
  if (!p.id.startsWith("rail-")) return []
  const R = p.length / 2
  const c: Vec3 = [p.length / 2, p.width / 2, 0]
  const z: Vec3 = [0, 0, 1]
  return [
    { kind: "cyl", c: add(c, z, 1.5), axis: z, r: R + 9, h: 3, mat: "nickel" },
    { kind: "cyl", c: add(c, z, 9), axis: z, r: R + 2.5, h: 12, mat: "nickel" },
    { kind: "cyl", c: add(c, z, p.thickness - 1.5), axis: z, r: R + 9, h: 3, mat: "nickel" },
    { kind: "cyl", c: add(c, z, p.thickness - 9), axis: z, r: R + 2.5, h: 12, mat: "nickel" },
  ]
}

/** Tira LED (`led-…`: el difusor que fa llum, cara de baix a z = 0): el perfil d'alumini als costats i als extrems. */
function ledSolids(p: Panel): HwSolid[] {
  if (!p.id.startsWith("led-")) return []
  const L = p.length, W = p.width, H = p.thickness
  const f = frame([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1])
  return [
    f.box([0, L], [-1.2, 0], [-0.6, H], "alu"),
    f.box([0, L], [W, W + 1.2], [-0.6, H], "alu"),
    f.box([-2, 0], [-1.2, W + 1.2], [-0.6, H], "alu"),
    f.box([L, L + 2], [-1.2, W + 1.2], [-0.6, H], "alu"),
  ]
}

/**
 * Els ferratges de sèrie d'una peça, en coordenades locals (mm). `pins`: els forats de la filera System 32 on hi ha un
 * suport de prestatge (`shelfPins`).
 */
export function builtinSolids(p: Panel, pins: readonly Hole[] = []): HwSolid[] {
  return [...hingeSolids(p), ...slideSolids(p), ...dowelSolids(p), ...pinSolids(p, pins), ...flapSolids(p), ...magnetSolids(p), ...pushSolids(p), ...railSolids(p), ...ledSolids(p)]
}

/** Els vuit vèrtexs (o la caixa que conté el cilindre) d'un sòlid, en coordenades locals. */
export function solidCorners(s: HwSolid): Vec3[] {
  const [u, v, w] = s.kind === "box" ? s.axes : basisFor(s.axis)
  const [hx, hy, hz] = s.kind === "box" ? scale(s.size, 0.5) : [s.r, s.r, s.h / 2]
  const out: Vec3[] = []
  for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) out.push(add(add(add(s.c, u, i * hx), v, j * hy), w, k * hz))
  return out
}

/** Una base ortonormal (u, v, w = eix) per a un eix qualsevol. */
export function basisFor(axis: Vec3): [Vec3, Vec3, Vec3] {
  const ref: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = cross(ref, axis)
  const l = Math.hypot(u[0], u[1], u[2]) || 1
  const un: Vec3 = [u[0] / l, u[1] / l, u[2] / l]
  return [un, cross(axis, un), axis]
}

/** La caixa d'un sòlid al moble (mm del mòdul). */
export function solidBox(p: Panel, s: HwSolid): { min: Vec3; max: Vec3 } {
  const cs = solidCorners(s).map((c) => toWorld(p, c))
  return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
}

/**
 * Els forats de la filera System 32 on va un suport de prestatge: a cada peça, per a cada prestatge que hi recolza (la
 * cara de sota a menys de 32 mm per sobre del forat, tocant la cara de la peça i dins de la seva fondària), el forat més
 * alt de cada filera. Per peça (id) → forats.
 */
export function shelfPins(panels: readonly Panel[]): Map<string, Hole[]> {
  const out = new Map<string, Hole[]>()
  const shelves = panels.filter((p) => p.role === "shelf").map((p) => {
    const cs = [0, p.length].flatMap((x) => [0, p.width].flatMap((y) => [0, p.thickness].map((z) => toWorld(p, [x, y, z]))))
    return { min: [0, 1, 2].map((k) => Math.min(...cs.map((c) => c[k]!))) as Vec3, max: [0, 1, 2].map((k) => Math.max(...cs.map((c) => c[k]!))) as Vec3 }
  })
  if (!shelves.length) return out
  for (const p of panels) {
    const holes = p.holes.filter((h) => h.tag === "system32" && (h.face === "A" || h.face === "B"))
    if (!holes.length) continue
    const best = new Map<string, { h: Hole; y: number }>()
    for (const h of holes) {
      const { at } = entry(p, h)
      const E = toWorld(p, at)
      for (const [si, s] of shelves.entries()) {
        const gap = s.min[1] - E[1]
        if (gap <= h.diameter / 2 || gap > 32) continue
        if (Math.min(Math.abs(E[0] - s.min[0]), Math.abs(E[0] - s.max[0])) > 3) continue
        if (E[2] < s.min[2] - 0.5 || E[2] > s.max[2] + 0.5) continue
        const k = `${si}|${Math.round(E[2])}|${Math.round(E[0])}`
        const cur = best.get(k)
        if (!cur || E[1] > cur.y) best.set(k, { h, y: E[1] })
      }
    }
    if (best.size) out.set(p.id, [...new Set([...best.values()].map((b) => b.h))])
  }
  return out
}
