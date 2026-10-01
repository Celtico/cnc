import type { Zone } from "../model"

/** Rectangle interior (llum) en coordenades del mòdul: X amplada, Y alçada. */
export interface ZoneRect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface DividerSpec {
  /** Zona pare que genera el divisor. */
  parentId: string
  dir: "v" | "h"
  /** Coordenada d'inici del gruix (x per a "v", y per a "h"). */
  at: number
  /** Extensió del divisor en l'altre eix. */
  from: number
  to: number
  /** Índex del divisor dins la divisió (0..n−2). */
  index: number
}

export interface Layout {
  /** Rectangle de cada zona (fulles i nodes), per id. */
  rects: Map<string, ZoneRect>
  /** Zones fulla en pre-ordre. */
  leaves: Zone[]
  dividers: DividerSpec[]
  /** Problemes de mides (llums negatives). */
  problems: string[]
}

const r = (v: number): number => Math.round(v * 100) / 100

/** Reparteix `total` entre `sizes` (mm o "auto") descomptant `n−1` gruixos. */
export function resolveSizes(total: number, sizes: (number | "auto")[], thickness: number): number[] {
  const n = sizes.length
  const fixed = sizes.reduce<number>((s, v) => (typeof v === "number" ? s + v : s), 0)
  const autos = sizes.filter((v) => v === "auto").length
  const remaining = total - (n - 1) * thickness - fixed
  const auto = r(autos > 0 ? remaining / autos : 0)
  // L'últim auto es queda el que sobra: la suma dona just el total (sense 981,99 per 982).
  const last = sizes.lastIndexOf("auto")
  return sizes.map((v, i) => (v !== "auto" ? r(v) : i === last ? r(remaining - (autos - 1) * auto) : auto))
}

/** Calcula els rectangles de totes les zones a partir de la llum interior del mòdul. */
export function layoutZones(root: Zone, interior: ZoneRect, thickness: number): Layout {
  const rects = new Map<string, ZoneRect>()
  const leaves: Zone[] = []
  const dividers: DividerSpec[] = []
  const problems: string[] = []

  const visit = (zone: Zone, rect: ZoneRect): void => {
    rects.set(zone.id, rect)
    if (!zone.split) {
      leaves.push(zone)
      return
    }
    const { dir, children } = zone.split
    const sizes = padSizes(zone.split.sizes, children.length)
    const total = dir === "v" ? rect.x1 - rect.x0 : rect.y1 - rect.y0
    const resolved = resolveSizes(total, sizes, thickness)
    if (resolved.some((v) => v <= 0)) problems.push(`La zona ${zone.id} no té prou espai per a les seves divisions.`)

    let cursor = dir === "v" ? rect.x0 : rect.y0
    children.forEach((child, i) => {
      const size = resolved[i]!
      const childRect: ZoneRect =
        dir === "v"
          ? { x0: r(cursor), y0: rect.y0, x1: r(cursor + size), y1: rect.y1 }
          : { x0: rect.x0, y0: r(cursor), x1: rect.x1, y1: r(cursor + size) }
      visit(child, childRect)
      cursor += size
      if (i < children.length - 1) {
        dividers.push({
          parentId: zone.id,
          dir,
          at: r(cursor),
          from: dir === "v" ? rect.y0 : rect.x0,
          to: dir === "v" ? rect.y1 : rect.x1,
          index: i,
        })
        cursor += thickness
      }
    })
  }

  visit(root, interior)
  return { rects, leaves, dividers, problems }
}

/** Si falten mides, les completa amb "auto"; si en sobren, les talla. */
function padSizes(sizes: (number | "auto")[], n: number): (number | "auto")[] {
  const out = sizes.slice(0, n)
  while (out.length < n) out.push("auto")
  return out
}
