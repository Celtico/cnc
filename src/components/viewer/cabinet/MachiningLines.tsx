import { useEffect, useMemo } from "react"
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Vector3 } from "three"
import type { Groove, Hole } from "../../../core/model"
import { holeMarkMatrices } from "../hardwareShapes"
import { S } from "./constants"

const SEG = 20

/**
 * El Filferro sol de Modelatge (com el del Taulell, cel 2026-11-08: «es veuen els forats de la fusta»): cada forat, el
 * cercle de l'entrada, el del fons i quatre generatrius; cada ranura, la seva caixa. Unes línies per peça (coordenades de
 * la peça, m).
 */
export function machiningLinePoints(holes: readonly Hole[], grooves: readonly Groove[], T: number): number[] {
  const out: number[] = []
  const v = new Vector3()
  const push = (p: Vector3) => out.push(p.x, p.y, p.z)
  // Les mateixes que les marques (`holeMarkMatrices` se salta els forats de cantell sense cantell).
  const hs = holes.filter((h) => h.face !== "edge" || !!h.edge)
  holeMarkMatrices(hs, T * S).forEach((m, i) => {
    const h = hs[i]!
    const r = h.diameter / 2
    // El disc fa radi 1 (escalat al radi): el fons, `depth` cap a dins (−z del disc).
    const d = -h.depth / r
    const at = (a: number, z: number) => v.set(Math.cos(a), Math.sin(a), z).applyMatrix4(m)
    for (let k = 0; k < SEG; k++) {
      const a0 = (k / SEG) * Math.PI * 2, a1 = ((k + 1) / SEG) * Math.PI * 2
      for (const z of [0, d]) {
        push(at(a0, z))
        push(at(a1, z))
      }
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2
      push(at(a, 0))
      push(at(a, d))
    }
  })
  for (const g of grooves) {
    const x0 = g.x * S, x1 = (g.x + g.w) * S, y0 = g.y * S, y1 = (g.y + g.h) * S
    const [z0, z1] = g.face === "A" ? [(T - g.depth) * S, T * S] : [0, g.depth * S]
    const c = [
      [x0, y0], [x1, y0], [x1, y1], [x0, y1],
    ] as const
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = c[k]!, [bx, by] = c[(k + 1) % 4]!
      out.push(ax, ay, z0, bx, by, z0, ax, ay, z1, bx, by, z1, ax, ay, z0, ax, ay, z1)
    }
  }
  return out
}

export function MachiningLines({ holes, grooves, thickness, color }: { holes: readonly Hole[]; grooves: readonly Groove[]; thickness: number; color: string }) {
  const geo = useMemo(() => {
    const pts = machiningLinePoints(holes, grooves, thickness)
    if (!pts.length) return null
    const g = new BufferGeometry()
    g.setAttribute("position", new Float32BufferAttribute(pts, 3))
    return g
  }, [holes, grooves, thickness])
  const mat = useMemo(() => new LineBasicMaterial({ color }), [color])
  useEffect(() => () => geo?.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  return geo ? <lineSegments geometry={geo} material={mat} raycast={() => null} /> : null
}
