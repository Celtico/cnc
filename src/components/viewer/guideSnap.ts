import type { Axis } from "./pixelScale"

/** Una caixa en mm (coordenades de la composició): cantonada baixa i mida. */
export interface GuideBox {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

/** Una guia vermella (mm): una línia de `from` a `to`, a la coordenada on s'alineen les dues caixes. */
export interface Guide {
  from: [number, number, number]
  to: [number, number, number]
}

const AXES: Axis[] = ["x", "y", "z"]
const lo = (b: GuideBox, a: Axis) => (a === "x" ? b.x : a === "y" ? b.y : b.z)
const len = (b: GuideBox, a: Axis) => (a === "x" ? b.w : a === "y" ? b.h : b.d)
/** Les tres línies d'una caixa en un eix (com al Figma): les dues vores i el mig. */
const anchors = (b: GuideBox, a: Axis) => [lo(b, a), lo(b, a) + len(b, a) / 2, lo(b, a) + len(b, a)]
const at = (b: GuideBox, a: Axis, v: number): GuideBox => (a === "x" ? { ...b, x: v } : a === "y" ? { ...b, y: v } : { ...b, z: v })

/**
 * Guies intel·ligents com les del Figma (per decisió de l'usuari, 2026-10-22: «quan es mou un objecte podrien sortir
 * aquestes guies que surten al Figma»). En cada eix que es mou, la vora o el mig de la caixa s'enganxa (a `tol` mm) a la
 * vora o al mig d'una altra caixa (`others`) o a un pla (`planes`: terra, paret); amb `free` (Alt), sense imant. Retorna la
 * caixa ja enganxada i una guia per a cada caixa que hi queda alineada: la línia va per on s'alineen, d'una caixa a l'altra.
 */
export function snapWithGuides(box: GuideBox, axes: readonly Axis[], others: readonly GuideBox[], planes: Partial<Record<Axis, readonly number[]>>, tol: number, free = false): { box: GuideBox; snapped: Axis[]; guides: Guide[] } {
  let out = box
  const snapped: Axis[] = []
  for (const a of axes) {
    if (free) break
    const mine = anchors(box, a)
    const targets = [...others.flatMap((o) => anchors(o, a)), ...(planes[a] ?? [])]
    let best: number | null = null
    for (const t of targets) for (const m of mine) {
      const d = t - m
      if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
    if (best !== null) {
      out = at(out, a, lo(box, a) + best)
      snapped.push(a)
    }
  }
  return { box: out, snapped, guides: free ? [] : guidesFor(out, axes, others) }
}

/** Les guies d'una caixa ja col·locada: per a cada eix que es mou, una per cada vora o mig d'una altra caixa a la mateixa coordenada. */
function guidesFor(box: GuideBox, axes: readonly Axis[], others: readonly GuideBox[]): Guide[] {
  const guides: Guide[] = []
  for (const a of axes) {
    const mine = anchors(box, a)
    for (const o of others) {
      const cs = anchors(o, a).filter((t) => mine.some((m) => Math.abs(t - m) < 0.5))
      if (!cs.length) continue
      // La línia va en la direcció en què les dues caixes són més lluny l'una de l'altra, d'una punta a l'altra;
      // en la tercera, pel mig del tros que comparteixen (o pel mig de la que es mou).
      const rest = AXES.filter((k) => k !== a)
      const gap = (k: Axis) => Math.abs(lo(box, k) + len(box, k) / 2 - (lo(o, k) + len(o, k) / 2))
      const along = gap(rest[0]!) >= gap(rest[1]!) ? rest[0]! : rest[1]!
      const third = rest.find((k) => k !== along)!
      const s0 = Math.min(lo(box, along), lo(o, along)), s1 = Math.max(lo(box, along) + len(box, along), lo(o, along) + len(o, along))
      const t0 = Math.max(lo(box, third), lo(o, third)), t1 = Math.min(lo(box, third) + len(box, third), lo(o, third) + len(o, third))
      const t = t0 <= t1 ? (t0 + t1) / 2 : lo(box, third) + len(box, third) / 2
      const point = (c: number, s: number): [number, number, number] => {
        const p = { x: 0, y: 0, z: 0 }
        p[a] = c
        p[along] = s
        p[third] = t
        return [p.x, p.y, p.z]
      }
      for (const c of cs) guides.push({ from: point(c, s0), to: point(c, s1) })
    }
  }
  return guides
}
