import { moduleFrontFace, modulePlacements, moduleRot, rotXZ, type Composition, type Module } from "./composition"

/**
 * **Lateral compartit** (per decisió de l'usuari, 2026-10-21: «unir mobles»; regla general del cas 11 del model únic): un
 * mòdul sense un lateral té aquell costat aguantat si un altre mòdul de la composició hi toca (el seu lateral fa de lateral
 * dels dos). Per als fronts compta com a aguantat (`ZoneBounds.noLeft` / `noRight`). No es guarda: surt de la posició
 * dels mòduls (`Carcass.corner` es recalcula sempre), també el de la cantonada en L (el mòdul girat hi toca).
 */
export function withNeighbourSides<T extends Pick<Composition, "modules">>(comp: T): T {
  if (!comp.modules.some((m) => !m.carcass.sides.left || !m.carcass.sides.right || m.carcass.corner)) return comp
  const places = modulePlacements(comp as unknown as Composition)
  // Cada mòdul a la planta: el punt (x, z) del mòdul a la composició i la seva caixa amb un gruix de fronts al davant (sigui
  // quin sigui l'estil dels fronts, que no hi compta). Gira al voltant del centre de la petjada (`modulePlacements`).
  const frames = comp.modules.map((m, i) => {
    const p = places[i]!
    const W = m.carcass.width
    const d = moduleFrontFace(m)
    const rot = moduleRot(m)
    const toWorld = (x: number, z: number): [number, number] => {
      const [a, b] = rotXZ(x, z, rot, W / 2, d / 2)
      return [a + p.x, b + (p.z ?? 0)]
    }
    const D = m.carcass.depth
    // Amb un gruix al davant (els fronts recobrents, l'estil que sigui): el girat de la cantonada hi toca amb els fronts.
    const F = D + m.carcass.thickness
    const pts = [toWorld(0, 0), toWorld(W, 0), toWorld(0, F), toWorld(W, F)]
    const xs = pts.map((q) => q[0]), zs = pts.map((q) => q[1])
    return { W, D, toWorld, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), y0: p.y, y1: p.y + m.carcass.height }
  })
  const E = 2
  const touched = (i: number, side: "left" | "right"): boolean => {
    const f = frames[i]!
    const x = side === "left" ? 0 : f.W
    // Dos punts de la cara del lateral que falta (lluny de les cantonades): tots dos dins d'un altre mòdul.
    const a = f.toWorld(x, f.D * 0.25), b = f.toWorld(x, f.D * 0.75)
    return frames.some((g, j) => {
      if (j === i) return false
      const inside = (q: [number, number]) => q[0] >= g.x0 - E && q[0] <= g.x1 + E && q[1] >= g.z0 - E && q[1] <= g.z1 + E
      // A l'alçada: el veí cobreix almenys la meitat del costat.
      const overlap = Math.min(f.y1, g.y1) - Math.max(f.y0, g.y0)
      return inside(a) && inside(b) && overlap >= (f.y1 - f.y0) / 2
    })
  }
  let changed = false
  const modules = comp.modules.map((m: Module, i) => {
    const l = !m.carcass.sides.left && touched(i, "left")
    const r = !m.carcass.sides.right && touched(i, "right")
    const corner = l && r ? "both" : l ? "left" : r ? "right" : undefined
    if (corner === m.carcass.corner) return m
    changed = true
    const { corner: _c, ...carcass } = m.carcass
    return { ...m, carcass: corner ? { ...carcass, corner } : carcass }
  })
  return changed ? { ...comp, modules } : comp
}
