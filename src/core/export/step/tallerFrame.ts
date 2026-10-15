import type { EdgeSide, Panel } from "../../model"
import { add, mul, type V3 } from "./vec"

// --- Marc del taller ------------------------------------------------------------

/** Direcció del nostre 3D (Y amunt, Z cap al davant) → eixos del taller (Z amunt, Y fondària). */
const toTallerDir = (v: V3): V3 => [v[0], -v[2], v[1]]

export interface TallerFrame {
  origin: V3
  xAxis: V3
  yAxis: V3
  zAxis: V3
  point: (local: V3) => V3
  dir: (local: V3) => V3
}

/** Transformació local de la peça → coordenades del taller (rotació + translació). */
export function tallerFrame(p: Panel): TallerFrame {
  const { origin, xAxis, yAxis, zAxis } = p.placement
  const o = toTallerDir(origin)
  const ax = toTallerDir(xAxis)
  const ay = toTallerDir(yAxis)
  const az = toTallerDir(zAxis)
  const dir = (l: V3): V3 => add(add(mul(ax, l[0]), mul(ay, l[1])), mul(az, l[2]))
  return { origin: o, xAxis: ax, yAxis: ay, zAxis: az, dir, point: (l) => add(o, dir(l)) }
}

/**
 * Numeració dels cantells tal com els veurà el taller, que deriva u (costat llarg) i v
 * (curt) de la caixa de cada sòlid: 4 = u mínim · 2 = u màxim · 1 = v mínim · 3 = v màxim.
 * Així els cantells del CSV i les espigues del STEP queden al mateix lloc al seu visor.
 */
export function tallerEdgeNumbers(p: Panel): Record<EdgeSide, 1 | 2 | 3 | 4> {
  const f = tallerFrame(p)
  const axisIndex = (v: V3): number => v.findIndex((c) => Math.abs(c) > 0.5)
  const ix = axisIndex(f.xAxis)
  const iy = axisIndex(f.yAxis)
  // El parser tria u = eix del pla amb més extensió; en cas d'empat, el d'índex més baix.
  const xIsU = p.length > p.width || (p.length === p.width && ix < iy)
  const xPos = f.xAxis[ix]! > 0
  const yPos = f.yAxis[iy]! > 0
  const onU = (atMin: boolean): 2 | 4 => (atMin ? 4 : 2)
  const onV = (atMin: boolean): 1 | 3 => (atMin ? 1 : 3)
  return xIsU
    ? { left: onU(xPos), right: onU(!xPos), bottom: onV(yPos), top: onV(!yPos) }
    : { left: onV(xPos), right: onV(!xPos), bottom: onU(yPos), top: onU(!yPos) }
}
