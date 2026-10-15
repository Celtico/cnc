import { anchorRef, freeX, modulePlacements, rowOf, type Composition, type RefObject } from "./composition"

/** Tolerància (mm): tocar-se cara a cara no és xocar (com `refTouchesBox`). */
const TOL = 0.5

type RowBox = { i: number; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }

/** Els mòduls de cada fila (a terra i penjats; sense les illes), d'esquerra a dreta, amb la seva caixa. */
function rowBoxes(comp: Composition): Record<"floor" | "wall", RowBox[]> {
  const places = modulePlacements(comp)
  const out: Record<"floor" | "wall", RowBox[]> = { floor: [], wall: [] }
  comp.modules.forEach((m, i) => {
    if (freeX(m)) return
    const p = places[i]!
    const c = m.carcass
    out[rowOf(m)].push({ i, x0: p.x, x1: p.x + c.width, y0: p.y, y1: p.y + c.height, z0: p.z ?? 0, z1: (p.z ?? 0) + c.depth })
  })
  return out
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 - TOL && b0 < a1 - TOL

/** Les files on és l'objecte (en alçada i en fondària, sigui on sigui de costat). */
function rowsOf(comp: Composition, r: RefObject): RowBox[][] {
  const rows = rowBoxes(comp)
  return [rows.floor, rows.wall].filter((row) => row.some((b) => overlaps(r.y, r.y + r.h, b.y0, b.y1) && overlaps(r.z, r.z + r.d, b.z0, b.z1)))
}

/**
 * L'objecte (un obstacle, no un que talla) xoca amb algun mòdul d'una fila: llavors se li pot fer lloc
 * (`makeRoomForRef`).
 */
export function refBlocksRow(comp: Composition, id: string): boolean {
  const r = comp.references.find((x) => x.id === id)
  if (!r || r.effect === "cut") return false
  return rowsOf(comp, r).some((row) => row.some((b) => overlaps(r.x, r.x + r.w, b.x0, b.x1) && overlaps(r.y, r.y + r.h, b.y0, b.y1) && overlaps(r.z, r.z + r.d, b.z0, b.z1)))
}

/**
 * **Fer lloc** a un objecte de referència entre els mòduls (per decisió: un rentaplats o una nevera entre dos baixos).
 * A cada fila on és (en alçada i fondària), els mòduls que tenen el centre a l'esquerra del de l'objecte es queden i
 * l'objecte s'hi posa just a continuació (si en trepitjava l'últim); el primer dels de la dreta (i amb ell, tots els
 * següents de la fila) es desplaça el que calgui perquè l'objecte hi càpiga. Si el forat ja és prou ample, només es
 * mou l'objecte, dins del forat. Les illes no compten. Un pas: després, els mòduls i l'objecte són independents.
 */
export function makeRoomForRef(comp: Composition, id: string): Composition {
  const r = comp.references.find((x) => x.id === id)
  if (!r || r.effect === "cut") return comp
  const rows = rowsOf(comp, r)
  if (!rows.length) return comp
  const c = r.x + r.w / 2
  // A cada fila: el primer mòdul de la dreta (`k`), on acaba el de l'esquerra i on comença el de la dreta.
  const cuts = rows.map((row) => {
    const k = row.filter((b) => (b.x0 + b.x1) / 2 < c).length
    return { next: row[k], left: k > 0 ? row[k - 1]!.x1 : -Infinity, right: row[k]?.x0 ?? Infinity }
  })
  const left = Math.max(...cuts.map((x) => x.left))
  let x = Math.max(r.x, left)
  // Si el forat ja hi és, l'objecte s'hi encabeix sense moure cap mòdul.
  for (const cut of cuts) if (cut.right - left >= r.w - TOL) x = Math.min(x, cut.right - r.w)
  const push = new Map<number, number>()
  for (const cut of cuts) {
    const d = x + r.w - cut.right
    if (cut.next && d > TOL) push.set(cut.next.i, d)
  }
  return {
    ...comp,
    modules: comp.modules.map((m, i) => (push.has(i) ? { ...m, gapBefore: m.gapBefore + push.get(i)! } : m)),
    references: comp.references.map((o) => (o.id === id ? anchorRef({ ...o, x }) : o)),
  }
}
