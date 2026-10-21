import { defaultModule, newId, type Composition, type RefObject } from "./composition"
import { DEFAULT_JOINERY, type FreePart } from "./freePart"
import { loftCage, type MeshCage, type ObjectBox } from "./meshShape"
import { signedArea } from "./polygon"
import { applySlices, DEFAULT_SLICES, type SliceOptions } from "./slices"
import type { Template } from "./templates"

/**
 * Les eines de la galeria **Llistons** de la pàgina Mobles (els dissenys, a `slicedGallery.ts`): sofàs, butaques,
 * cadires, tamborets, bancs, taules, taulells i murals de llistons de roure massís. Cada moble és una **forma lliure** (la secció estirada
 * al llarg d'un eix, `loftCage`) tallada amb la drecera «Tallar en llistons» (`slices.ts`): la forma queda amagada al
 * grup, i es pot editar i tornar a tallar.
 */

export type P = [number, number]

export const OAK = "Roure massís"
export const GLASS = "Vidre"

/** La secció a la posició t (0–1) del llarg: el contorn i, si és un tub, el forat de banda a banda. */
export interface Section {
  outer: P[]
  inner?: P[]
  /** Costats del contorn que queden plans (índex j = del punt j al j + 1): el terra, la paret, el sobre. */
  sharp?: number[]
  /** El contorn ja és dens (una cinta): no se suavitza. */
  dense?: boolean
}

export interface Design {
  id: string
  name: string
  use: string
  price: number
  /** Llarg de la forma (mm) i seccions al llarg. */
  length: number
  n: number
  /**
   * Secció `[z, y]` (estirada al llarg de X: de costat) o, amb `along: "y"`, `[x, z]` (estirada de baix a dalt: les
   * seccions són plantes, com una columna).
   */
  section: (t: number) => Section
  along?: "x" | "y"
  /** Alçada de la part de baix de la forma (un mural a la paret). */
  lift?: number
  opts?: Partial<SliceOptions>
  /** Passades de suavitzat de la forma (per defecte, les de la forma lliure): un relleu fi en fa una sola, perquè no s'esborri. */
  level?: number
  /** Peces que no són llistons (el vidre d'una taula), amb la caixa de la forma. */
  extra?: (box: ObjectBox) => FreePart[]
}

// --- Corbes -------------------------------------------------------------------------------------------------------

export const wave = (t: number, cycles: number, phase = 0) => Math.sin((t * cycles + phase) * Math.PI * 2)
export const bump = (t: number, at: number, width: number) => Math.exp(-(((t - at) / width) ** 2))
export const ends = (t: number, width: number) => Math.max(bump(t, 0.03, width), bump(t, 0.97, width))

/** Catmull-Rom entre p1 i p2. */
function cr(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const t2 = t * t, t3 = t2 * t
  const at = (k: 0 | 1) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
  return [at(0), at(1)]
}

/** Contorn tancat suau pels punts de control; els costats `sharp` queden rectes. Torna els costats rectes al contorn nou. */
function smoothRing(ctrl: P[], sharp: number[], per: number): { ring: P[]; sharp: number[] } {
  const k = ctrl.length
  const flat = new Set(sharp)
  const ring: P[] = []
  const at: number[] = []
  for (let i = 0; i < k; i++) {
    at.push(ring.length)
    if (flat.has(i)) {
      ring.push(ctrl[i]!)
      continue
    }
    for (let s = 0; s < per; s++) ring.push(cr(ctrl[(i - 1 + k) % k]!, ctrl[i]!, ctrl[(i + 1) % k]!, ctrl[(i + 2) % k]!, s / per))
  }
  return { ring, sharp: sharp.map((i) => at[i]!) }
}

/** Polilínia oberta suau pels punts. */
function smoothOpen(pts: P[], per: number): P[] {
  const q = [pts[0]!, ...pts, pts[pts.length - 1]!]
  const out: P[] = []
  for (let i = 1; i < q.length - 2; i++) for (let s = 0; s < per; s++) out.push(cr(q[i - 1]!, q[i]!, q[i + 1]!, q[i + 2]!, s / per))
  out.push(pts[pts.length - 1]!)
  return out
}

/** Contorn tancat amb `n` punts repartits per igual al llarg. */
function resample(ring: P[], n: number): P[] {
  const seg = ring.map((p, i) => Math.hypot(ring[(i + 1) % ring.length]![0] - p[0], ring[(i + 1) % ring.length]![1] - p[1]))
  const total = seg.reduce((a, b) => a + b, 0)
  const out: P[] = []
  let i = 0, acc = 0
  for (let k = 0; k < n; k++) {
    const d = (k * total) / n
    while (acc + seg[i]! < d && i < ring.length - 1) acc += seg[i++]!
    const s = seg[i]! ? (d - acc) / seg[i]! : 0
    const p = ring[i]!, q = ring[(i + 1) % ring.length]!
    out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s])
  }
  return out
}

/**
 * Cinta: una corba (els punts del mig) amb gruix (`th`, mm, segons la posició 0–1 al llarg): la secció d'una cadira en S o
 * d'un tamboret en Z. Els dos extrems són tallats rectes.
 */
export function ribbon(center: P[], th: (u: number) => number, per = 6): Section {
  const c = smoothOpen(center, per)
  const left: P[] = [], right: P[] = []
  // A la banda de dins d'un revolt, el desplaçament tornaria enrere (un nus): el punt es queda just davant de l'anterior.
  const push = (side: P[], q: P, tx: number, ty: number) => {
    const o = side[side.length - 1]
    const l = Math.hypot(tx, ty) || 1
    side.push(!o || (q[0] - o[0]) * tx + (q[1] - o[1]) * ty > 0 ? q : [o[0] + tx / l, o[1] + ty / l])
  }
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)]!, b = c[Math.min(c.length - 1, i + 1)]!
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    const h = th(i / (c.length - 1)) / 2
    push(left, [p[0] - (ty / l) * h, p[1] + (tx / l) * h], tx, ty)
    push(right, [p[0] + (ty / l) * h, p[1] - (tx / l) * h], tx, ty)
  })
  return { outer: [...left, ...right.reverse()], sharp: [left.length - 1, 2 * left.length - 1], dense: true }
}

/** Gira l'anell al voltant de (cz, cy) i l'escala. */
export const turn = (ring: P[], a: number, c: P, s: P = [1, 1]): P[] =>
  ring.map(([z, y]) => {
    const dz = (z - c[0]) * s[0], dy = (y - c[1]) * s[1]
    return [c[0] + dz * Math.cos(a) - dy * Math.sin(a), c[1] + dz * Math.sin(a) + dy * Math.cos(a)]
  })

/** El·lipse de `n` punts (a, b semieixos) al voltant de c. */
export const ellipse = (c: P, a: number, b: number, n = 8): P[] => Array.from({ length: n }, (_, i) => [c[0] + a * Math.cos((i / n) * Math.PI * 2), c[1] + b * Math.sin((i / n) * Math.PI * 2)])

// --- La forma i el moble --------------------------------------------------------------------------------------------

/** La forma lliure del disseny, a la composició. */
function designShape(d: Design): RefObject {
  const ts = Array.from({ length: d.n }, (_, i) => i / (d.n - 1))
  const secs = ts.map(d.section)
  const outs = secs.map((s) => (s.dense ? { ring: s.outer, sharp: s.sharp ?? [] } : smoothRing(s.outer, s.sharp ?? [], 3)))
  const k = outs[0]!.ring.length
  const inners = secs[0]!.inner
    ? secs.map((s, i) => {
        let r = resample(smoothRing(s.inner!, [], 3).ring, k)
        if (Math.sign(signedArea(r)) !== Math.sign(signedArea(outs[i]!.ring))) r = r.reverse()
        // Que comenci pel punt més a prop del primer de fora (si no, el tub es retorça).
        const o = outs[i]!.ring[0]!
        const j = r.reduce((best, p, m) => (Math.hypot(p[0] - o[0], p[1] - o[1]) < Math.hypot(r[best]![0] - o[0], r[best]![1] - o[1]) ? m : best), 0)
        return [...r.slice(j), ...r.slice(0, j)]
      })
    : undefined
  const loft = loftCage(
    outs.map((o) => o.ring),
    ts.map((t) => t * d.length),
    outs[0]!.sharp,
    inners,
    true,
  )
  let cage: MeshCage = d.level ? { ...loft.cage, level: d.level } : loft.cage
  let box = loft.box
  if (d.along === "y") {
    // Estirada de baix a dalt: (llarg, y, z) de la secció → (x, y, z) = (z, llarg, y). Una rotació: les cares no es giren.
    cage = { ...cage, v: cage.v.map(([a, b, c]) => [c, a, b]) }
    box = { x: box.z, y: box.x, z: box.y, w: box.d, h: box.w, d: box.h }
  }
  return { id: newId("r"), name: d.name, shape: "mesh", mesh: cage, ...box, y: box.y + (d.lift ?? 0) }
}

function designComposition(d: Design): Composition {
  const shape = designShape(d)
  const comp: Composition = { kind: "lliure", modules: [defaultModule(newId("m"), "Mòdul 1")], references: [shape], parts: [], joinery: { ...DEFAULT_JOINERY } }
  const out = applySlices(comp, shape.id, { ...DEFAULT_SLICES, material: OAK, ...d.opts }).comp
  return d.extra ? { ...out, parts: [...(out.parts ?? []), ...d.extra(shape)] } : out
}

// --- Ajudes dels murals i el vidre -------------------------------------------------------------------------------------

/** El·lipse amb quatre cúbiques (el sobre de vidre). */
export function ovalNodes(w: number, h: number): NonNullable<FreePart["shape"]> {
  const K = 0.5522847498, a = w / 2, b = h / 2
  return [
    { x: w, y: b, in: [0, -K * b], out: [0, K * b], t: "smooth" },
    { x: a, y: h, in: [K * a, 0], out: [-K * a, 0], t: "smooth" },
    { x: 0, y: b, in: [0, K * b], out: [0, -K * b], t: "smooth" },
    { x: a, y: 0, in: [-K * a, 0], out: [K * a, 0], t: "smooth" },
  ]
}

/** Mural: el relleu cap endavant (z) segons l'alçada, a cada posició; el darrere pla contra la paret. */
export const relief = (H: number, n: number, z: (y: number) => number): Section => {
  const ys = Array.from({ length: n }, (_, i) => (i * H) / (n - 1))
  return { outer: [[0, 0], ...ys.map((y): P => [z(y), y]), [0, H]], sharp: [n + 1] }
}

/** Mural de relleu fi (un rostre): el relleu en molts punts, ja dens; el terra, el sostre i la paret plans. */
export const fineRelief = (H: number, n: number, z: (y: number) => number): Section => {
  const ys = Array.from({ length: n }, (_, i) => (i * H) / (n - 1))
  return { outer: [[0, 0], ...ys.map((y): P => [z(y), y]), [0, H]], sharp: [0, n, n + 1], dense: true }
}

const g2 = (u: number, v: number, cu: number, cv: number, su: number, sv: number) => Math.exp(-(((u - cu) / su) ** 2) - ((v - cv) / sv) ** 2)

/**
 * Un rostre de cara (relleu, mm) a (u, v): u d'una galta a l'altra (−1 a 1), v de la barbeta (−1) al front (1). El cap és
 * un ou; el nas, els llavis, la barbeta, els pòmuls i les celles en sobresurten i les conques dels ulls s'enfonsen. `turn`
 * gira la cara cap a un costat (−1 a 1): els trets es desplacen i el nas surt més.
 */
export function face(u: number, v: number, turn = 0): number {
  const head = 1 - (u / 0.8) ** 2 - (v / 1.1) ** 2
  if (head <= 0) return 0
  const w = u - 0.25 * turn * Math.sqrt(head)
  const eye = (side: number) => -55 * g2(w, v, side * 0.3, 0.18, 0.13, 0.08) + 25 * g2(w, v, side * 0.3, 0.33, 0.2, 0.05) + 22 * g2(w, v, side * 0.42, -0.12, 0.13, 0.13)
  return (
    170 * head ** 0.7 +
    eye(-1) +
    eye(1) +
    (80 + 30 * Math.abs(turn)) * g2(w, v, 0, -0.08, 0.08, 0.3) +
    35 * g2(w, v, 0, -0.36, 0.11, 0.07) -
    20 * g2(w, v, 0, -0.47, 0.14, 0.03) +
    32 * g2(w, v, 0, -0.56, 0.2, 0.045) -
    18 * g2(w, v, 0, -0.64, 0.2, 0.02) +
    26 * g2(w, v, 0, -0.72, 0.17, 0.045) +
    30 * g2(w, v, 0, -0.95, 0.2, 0.1)
  )
}

/** Llavis: l'alçada de cada boca segons la posició i el relleu de cada llavi. */
export const lips = (scale: number) => (t: number): Section => {
  const f = Math.max(0.1, Math.sin(t * Math.PI) ** 0.7)
  const top = 230 * scale * f * (1 - 0.25 * bump(t, 0.5, 0.08))
  const bottom = -200 * scale * f
  const d = scale
  return { outer: [[0, bottom], [25 * d, bottom], [95 * d, bottom * 0.55], [45 * d, 0], [105 * d, top * 0.5], [25 * d, top], [0, top]], sharp: [6] }
}

// --- La galeria --------------------------------------------------------------------------------------------------------

export interface SlicedCategory {
  id: string
  name: string
  items: Template[]
}

export const category = (id: string, name: string, designs: Design[]): SlicedCategory => ({
  id,
  name,
  items: designs.map((d) => {
    const o = { ...DEFAULT_SLICES, material: OAK, ...d.opts }
    return {
      id: `llistons-${d.id}`,
      kind: "lliure" as const,
      name: d.name,
      description: `Roure massís · llistons de ${o.thickness} mm${o.gap ? ` cada ${o.thickness + o.gap} mm` : " encolats"}. ${d.use}.`,
      price: d.price,
      make: () => designComposition(d),
    }
  }),
})
