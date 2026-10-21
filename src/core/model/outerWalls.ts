import type { Carcass, Module, Zone, ZoneSide } from "./composition"
import { updateZone } from "./zoneOps"
import { zoneBoundsMap } from "./zoneSupport"

type Wall = ZoneSide

const without = (z: Zone, s: Wall): Zone => {
  const rest = (z.noWalls ?? []).filter((w) => w !== s)
  const { noWalls: _w, ...bare } = z
  return rest.length ? { ...bare, noWalls: rest } : bare
}
const withWall = (z: Zone, s: Wall): Zone => (z.noWalls?.includes(s) ? z : { ...z, noWalls: (["left", "right", "bottom", "top"] as const).filter((w) => w === s || z.noWalls?.includes(w)) })
/** Treu `s` de `noWalls` a la zona i a totes les de dins. */
const clearAll = (z: Zone, s: Wall): Zone => {
  const out = without(z, s)
  return out.split ? { ...out, split: { ...out.split, children: out.split.children.map((c) => clearAll(c, s)) } } : out
}
/** Les zones de l'Interior a la zona `id`, en ordre. */
function pathTo(z: Zone, id: string): Zone[] | undefined {
  if (z.id === id) return [z]
  for (const c of z.split?.children ?? []) {
    const p = pathTo(c, id)
    if (p) return [z, ...p]
  }
  return undefined
}

/**
 * La tapa, la base o un lateral del mòdul **a una zona** (per decisió de l'usuari, 2026-10-21: «no pots ficar una tapa que
 * surti de la seva divisió?», «tapa, base, lateral dret, lateral esquerre»). Les peces de la caixa es fan a trams
 * (`outerSpans`): cada zona que hi toca en treu el seu (`Zone.noWalls`).
 * - A l'Interior: la del mòdul (Sencera o Sense), i cap zona en treu cap tram.
 * - Treure-la: només el tram de la zona.
 * - Posar-la on no hi és: la zona (i les de dins) la tenen; si no hi era per una zona de més amunt o perquè el mòdul no en
 *   té, la resta de zones que hi toquen es queden com eren (sense): les germanes del camí en treuen el seu tram.
 */
export function setOuterWall(m: Pick<Module, "carcass" | "root">, zoneId: string, s: Wall, on: boolean): { carcass: Carcass; root: Zone } {
  const { carcass, root } = m
  const modulePiece = (c: Carcass, has: boolean): Carcass => {
    if (s === "left" || s === "right") return { ...c, sides: { ...c.sides, [s]: has } }
    if (s === "top") return { ...c, top: has ? (c.top.kind === "none" ? { kind: "full" } : c.top) : { kind: "none" } }
    if (!has) return { ...c, noBottom: true }
    const { noBottom: _n, ...rest } = c
    return { ...rest, base: rest.base.kind === "open" ? { kind: "none" } : rest.base }
  }
  if (zoneId === root.id) return { carcass: modulePiece(carcass, on), root: clearAll(root, s) }
  if (!on) return { carcass, root: updateZone(root, zoneId, (z) => withWall(z, s)) }
  const path = pathTo(root, zoneId)
  if (!path) return { carcass, root }
  const moduleHas = zoneBoundsMap({ carcass, root: { id: root.id } }).get(root.id)![s]
  // On comença el tram que falta: el mòdul sense la peça (des de l'Interior) o la primera zona del camí que el treu.
  const from = moduleHas ? path.findIndex((z) => z.noWalls?.includes(s)) : 0
  let next = updateZone(root, zoneId, (z) => clearAll(z, s))
  if (from >= 0) {
    path.slice(from, -1).forEach((p, i) => {
      const onPath = path[from + i + 1]!.id
      next = updateZone(next, p.id, (z) => {
        const bare = without(z, s)
        // Divisió vertical: totes les germanes toquen la tapa i la base (horitzontal: els laterals); es queden sense el seu tram.
        if (!bare.split || bare.split.dir !== (s === "top" || s === "bottom" ? "v" : "h")) return bare
        return { ...bare, split: { ...bare.split, children: bare.split.children.map((c) => (c.id === onPath ? c : withWall(c, s))) } }
      })
    })
  }
  return { carcass: moduleHas ? carcass : modulePiece(carcass, true), root: next }
}
