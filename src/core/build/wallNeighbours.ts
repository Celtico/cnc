import type { Zone, ZoneSide } from "../model"
import type { Layout } from "./layout"

const OPPOSITE: Record<ZoneSide, ZoneSide> = { left: "right", right: "left", bottom: "top", top: "bottom" }

/**
 * Les zones de l'altre costat del divisor d'una zona que en treuen el tram (`Zone.noWalls`), i si entre totes el treuen
 * tot al llarg de la zona (per petició de l'usuari, 2026-10-21, la lletra E: «no em deixa posar la part de sota»: el
 * divisor el va treure la cel·la del costat, i a aquesta encara li sortia sencer). El divisor és la mateixa peça per a
 * totes dues zones: el que en treu una, l'altra també ho veu i ho pot tornar a posar.
 */
export function wallRemovers(layout: Pick<Layout, "rects" | "dividers">, root: Zone, zoneId: string, side: ZoneSide): { ids: string[]; full: boolean } {
  const R = layout.rects.get(zoneId)
  if (!R) return { ids: [], full: false }
  const gap = Math.max(19, ...layout.dividers.map((d) => d.thickness)) + 0.5
  const v = side === "left" || side === "right"
  const across = OPPOSITE[side]
  const ids: string[] = []
  const spans: [number, number][] = []
  const walk = (z: Zone) => {
    const Q = layout.rects.get(z.id)
    if (Q && z.id !== zoneId && z.noWalls?.includes(across)) {
      const d = side === "left" ? R.x0 - Q.x1 : side === "right" ? Q.x0 - R.x1 : side === "bottom" ? R.y0 - Q.y1 : Q.y0 - R.y1
      const a = Math.max(v ? R.y0 : R.x0, v ? Q.y0 : Q.x0)
      const b = Math.min(v ? R.y1 : R.x1, v ? Q.y1 : Q.x1)
      if (d > 0.5 && d <= gap && b - a > 0.5) {
        ids.push(z.id)
        spans.push([a, b])
      }
    }
    z.split?.children.forEach(walk)
  }
  walk(root)
  // Tot el tram de la zona cobert pels trams trets.
  const [from, to] = v ? [R.y0, R.y1] : [R.x0, R.x1]
  let at = from
  for (const [a, b] of spans.sort((p, q) => p[0] - q[0])) if (a <= at + 0.5) at = Math.max(at, b)
  return { ids, full: ids.length > 0 && at >= to - 0.5 }
}
