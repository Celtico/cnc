import { ExtrudeGeometry, Path, Shape } from "three"
import type { Panel } from "../../core/model"

const S = 0.001

/**
 * Geometria d'una peça amb talls passants: el contorn extruït amb els forats (ranures amb
 * els extrems rodons, rectangles i cercles). Coordenades en m, origen a la cantonada.
 */
export function cutoutGeometry(p: Panel): ExtrudeGeometry {
  const L = p.length * S
  const W = p.width * S
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.lineTo(L, 0)
  shape.lineTo(L, W)
  shape.lineTo(0, W)
  shape.closePath()
  for (const c of p.cutouts ?? []) {
    const hole = new Path()
    if (c.kind === "circle") {
      hole.absarc(c.x * S, c.y * S, (c.diameter / 2) * S, 0, Math.PI * 2, true)
    } else if (c.kind === "rect") {
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      hole.moveTo(x0, y0)
      hole.lineTo(x0, y1)
      hole.lineTo(x1, y1)
      hole.lineTo(x1, y0)
      hole.closePath()
    } else {
      // Ranura: dos semicercles units per rectes.
      const rad = (Math.min(c.w, c.h) / 2) * S
      const x0 = c.x * S, y0 = c.y * S, x1 = (c.x + c.w) * S, y1 = (c.y + c.h) * S
      if (c.w >= c.h) {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI / 2, (Math.PI * 3) / 2, false)
        hole.absarc(x1 - rad, y0 + rad, rad, -Math.PI / 2, Math.PI / 2, false)
      } else {
        hole.absarc(x0 + rad, y0 + rad, rad, Math.PI, Math.PI * 2, false)
        hole.absarc(x0 + rad, y1 - rad, rad, 0, Math.PI, false)
      }
      hole.closePath()
    }
    shape.holes.push(hole)
  }
  return new ExtrudeGeometry(shape, { depth: p.thickness * S, bevelEnabled: false, curveSegments: 10 })
}
