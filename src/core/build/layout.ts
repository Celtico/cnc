import type { Zone } from "../model"
import { fmtNum, roundTo } from "../../lib/format"

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


/** Reparteix `total` entre `sizes` (mm o "auto") descomptant `n−1` gruixos. */
export function resolveSizes(total: number, sizes: (number | "auto")[], thickness: number): number[] {
  const n = sizes.length
  const fixed = sizes.reduce<number>((s, v) => (typeof v === "number" ? s + v : s), 0)
  const autos = sizes.filter((v) => v === "auto").length
  const remaining = total - (n - 1) * thickness - fixed
  const auto = roundTo(autos > 0 ? remaining / autos : 0, 2)
  // L'últim auto es queda el que sobra: la suma dona just el total (sense 981,99 per 982).
  const last = sizes.lastIndexOf("auto")
  return sizes.map((v, i) => (v !== "auto" ? roundTo(v, 2) : i === last ? roundTo(remaining - (autos - 1) * auto, 2) : auto))
}


/**
 * Com `resolveSizes`, però el resultat sempre cap just a `total`: sense cap «auto», si les mides fixes (més els gruixos)
 * no sumen el total (±0,5 mm), l'última s'ajusta al que queda; si encara no hi cap (mides negatives), es retallen
 * des del final. `mismatch` diu quant sumaven (null si quadrava o hi havia «auto»).
 */
export function fitSizes(total: number, sizes: (number | "auto")[], thickness: number): { sizes: number[]; mismatch: number | null } {
  const out = resolveSizes(total, sizes, thickness)
  const n = out.length
  if (!n) return { sizes: out, mismatch: null }
  const sum = () => out.reduce((s, v) => s + v, 0) + (n - 1) * thickness
  const given = sum()
  const hasAuto = sizes.includes("auto")
  let mismatch: number | null = null
  if (!hasAuto && Math.abs(given - total) > 0.5) {
    mismatch = roundTo(given, 2)
    out[n - 1] = roundTo(out[n - 1]! + total - given, 2)
  }
  // Res fora: cap mida negativa i, si encara se'n surt, es retalla des del final.
  for (let i = 0; i < n; i++) if (out[i]! < 0) out[i] = 0
  for (let i = n - 1; i >= 0 && sum() > total + 0.005; i--) out[i] = roundTo(Math.max(0, out[i]! - (sum() - total)), 2)
  return { sizes: out, mismatch }
}

/** Avís (en català) de mides fixes que no quadren amb el total. */
export function mismatchMessage(what: string, given: number, total: number, last: number): string {
  return `${what}: les mides fixes sumen ${fmtNum(given, 1)} mm però n'hi ha ${fmtNum(total, 1)} mm. L'última s'ajusta a ${fmtNum(last, 1)} mm (posa'n una a «auto» perquè agafi el que sobra).`
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
    const { sizes: resolved, mismatch } = fitSizes(total, sizes, thickness)
    if (mismatch !== null) problems.push(mismatchMessage(`Les ${dir === "v" ? "amplades" : "alçades"} de la divisió de la zona ${zone.id}`, mismatch, roundTo(total, 2), resolved.at(-1)!))
    if (resolved.some((v) => v <= 0)) problems.push(`La zona ${zone.id} no té prou espai per a les seves divisions.`)

    let cursor = dir === "v" ? rect.x0 : rect.y0
    children.forEach((child, i) => {
      const size = resolved[i]!
      const childRect: ZoneRect =
        dir === "v"
          ? { x0: roundTo(cursor, 2), y0: rect.y0, x1: roundTo(cursor + size, 2), y1: rect.y1 }
          : { x0: rect.x0, y0: roundTo(cursor, 2), x1: rect.x1, y1: roundTo(cursor + size, 2) }
      visit(child, childRect)
      cursor += size
      if (i < children.length - 1) {
        dividers.push({
          parentId: zone.id,
          dir,
          at: roundTo(cursor, 2),
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

/**
 * Les mides reals (mm de llum) dels fills d'una zona dividida, en ordre, tal com les construeix `layoutZones` (després
 * dels gruixos dels divisors i de `fitSizes`): l'amplada amb una divisió vertical i l'alçada amb una d'horitzontal. Les
 * fa servir la «Divisió» de l'editor (les «Auto» i l'última, el que sobra). Sense divisió o sense els rectangles, cap.
 */
export function splitChildSizes(layout: Pick<Layout, "rects">, zone: Zone): number[] | undefined {
  if (!zone.split) return undefined
  const out: number[] = []
  for (const c of zone.split.children) {
    const rect = layout.rects.get(c.id)
    if (!rect) return undefined
    out.push(roundTo(zone.split.dir === "v" ? rect.x1 - rect.x0 : rect.y1 - rect.y0, 2))
  }
  return out
}

/** Si falten mides, les completa amb "auto"; si en sobren, les talla. */
function padSizes(sizes: (number | "auto")[], n: number): (number | "auto")[] {
  const out = sizes.slice(0, n)
  while (out.length < n) out.push("auto")
  return out
}
