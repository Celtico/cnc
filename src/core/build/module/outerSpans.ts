import type { Module, Zone, ZoneSide } from "../../model"
import { layoutZones, type ZoneRect } from "../layout"
import { near, wallSpans } from "./helpers"

/**
 * Els trams d'una peça de la caixa del mòdul que es fan (per decisió de l'usuari, 2026-10-21: «tapa, base, lateral dret,
 * lateral esquerre»): tota la llum menys el de les zones que hi toquen i en treuen el seu (`Zone.noWalls`). La tapa i la
 * base, en x de la llum; els laterals, en y. Damunt d'un divisor entre una zona amb la peça i una sense, la peça el cobreix
 * (l'aguanta); un tros sol entre dues zones sense, no (no aguanta res). La base d'un mòdul amb potes, sencera: s'hi
 * cargolen. L'Interior no en treu cap: la seva és la del mòdul.
 */
export function outerSpans(m: Pick<Module, "root" | "carcass">, I: ZoneRect, t: number, which: ZoneSide): [number, number][] {
  const alongX = which === "top" || which === "bottom"
  const whole: [number, number][] = [alongX ? [I.x0, I.x1] : [I.y0, I.y1]]
  if (which === "bottom" && m.carcass.base.kind === "legs") return whole
  const want = (z: Zone): boolean => (z !== m.root && !!z.noWalls?.includes(which)) || (z.split?.children.some(want) ?? false)
  if (!want(m.root)) return whole
  const layout = layoutZones(m.root, I, t)
  const touches = (R: ZoneRect) => (which === "top" ? near(R.y1, I.y1) : which === "bottom" ? near(R.y0, I.y0) : which === "left" ? near(R.x0, I.x0) : near(R.x1, I.x1))
  const removed: [number, number][] = []
  const walk = (z: Zone) => {
    const R = layout.rects.get(z.id)
    if (z !== m.root && R && z.noWalls?.includes(which) && touches(R)) removed.push(alongX ? [R.x0, R.x1] : [R.y0, R.y1])
    z.split?.children.forEach(walk)
  }
  walk(m.root)
  const [from, to] = whole[0]!
  const knot = Math.max(t, ...layout.dividers.map((x) => x.thickness)) + 1
  return wallSpans(from, to, removed).filter(([a, b]) => !(a > from + 0.5 && b < to - 0.5 && b - a <= knot))
}
