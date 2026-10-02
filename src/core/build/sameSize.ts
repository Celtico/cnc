import { flatten, type Panel } from "../model"

/**
 * El taller casa cada peça del CSV amb el seu sòlid del STEP només per la mida (L × A × gruix).
 * Si dues peces del mateix material fan la mateixa mida però tenen mecanitzats diferents
 * (forats, ranures, talls o contorn), el taller els pot intercanviar. Les peces mirall
 * (lateral esquerre i dret) no compten: el mecanitzat és el mateix girat o capgirat.
 */

const r = (v: number) => Math.round(v * 2) / 2

/** Firma dels mecanitzats d'una peça, girada en u (fu), en v (fv) i amb les cares canviades (swap). */
function signature(p: Panel, fu: boolean, fv: boolean, swap: boolean): string {
  const L = p.length
  const W = p.width
  const x = (v: number, w = 0) => r(fu ? L - v - w : v)
  const y = (v: number, h = 0) => r(fv ? W - v - h : v)
  const face = (f: string) => (swap && f === "A" ? "B" : swap && f === "B" ? "A" : f)
  const edge = (e?: string) => (fu && e === "left" ? "right" : fu && e === "right" ? "left" : fv && e === "top" ? "bottom" : fv && e === "bottom" ? "top" : (e ?? ""))
  const items: string[] = []
  for (const h of p.holes) items.push(`h${x(h.x)},${y(h.y)},${r(h.diameter)},${r(h.depth)},${face(h.face)},${edge(h.edge)}`)
  for (const g of p.grooves) items.push(`g${x(g.x, g.w)},${y(g.y, g.h)},${r(g.w)},${r(g.h)},${r(g.depth)},${face(g.face)}`)
  for (const c of p.cutouts ?? []) {
    if (c.kind === "circle") items.push(`c${x(c.x)},${y(c.y)},${r(c.diameter)}`)
    else if (c.kind === "polygon") items.push(`p${pts(flatten(c.points), x, y)}`)
    else items.push(`${c.kind}${x(c.x, c.w)},${y(c.y, c.h)},${r(c.w)},${r(c.h)}`)
  }
  if (p.outline) items.push(`o${pts(flatten(p.outline), x, y)}`)
  return items.sort().join(";")
}

const pts = (ps: [number, number][], x: (v: number) => number, y: (v: number) => number) =>
  ps
    .map(([u, v]) => `${Math.round(x(u))}:${Math.round(y(v))}`)
    .sort()
    .join(" ")

/** Mateix mecanitzat, directe o mirall (girat en u, en v o capgirat). */
export function sameMachining(a: Panel, b: Panel): boolean {
  const ref = signature(a, false, false, false)
  for (const fu of [false, true]) for (const fv of [false, true]) for (const swap of [false, true]) if (signature(b, fu, fv, swap) === ref) return true
  return false
}

/** Parelles de peces de la mateixa mida i material amb mecanitzats diferents (una per grup de mida). */
export function sameSizeConflicts(panels: Panel[]): [Panel, Panel][] {
  const groups = new Map<string, Panel[]>()
  for (const p of panels) {
    const key = [p.material, r(p.thickness), r(Math.max(p.length, p.width)), r(Math.min(p.length, p.width))].join("|")
    const g = groups.get(key)
    if (g) g.push(p)
    else groups.set(key, [p])
  }
  const out: [Panel, Panel][] = []
  for (const g of groups.values()) {
    // Variants diferents de mecanitzat dins del grup.
    const kinds: Panel[] = []
    for (const p of g) if (!kinds.some((k) => sameMachining(k, p))) kinds.push(p)
    if (kinds.length > 1) out.push([kinds[0]!, kinds[1]!])
  }
  return out
}
