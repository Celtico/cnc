import { mountOf, NO_EDGES, type Composition, type Island, type Panel } from "../model"
import { frontMaterialOf } from "./buildModule"
import { placement, X, Y, Z } from "./geometry"

/** Gruix per defecte dels panells de remat (el tauler habitual del taller). */
export const ISLAND_END_THICKNESS = 19

/**
 * Illes que es fan (`Composition.islands`): els dos mòduls hi són, són diferents i tots dos «Lliure al terra»; cada mòdul
 * en una sola illa (mana la primera). Les altres es conserven però no es fan (res amagat compta).
 */
export function activeIslands(comp: Pick<Composition, "islands" | "modules">): Island[] {
  const used = new Set<string>()
  const out: Island[] = []
  for (const isl of comp.islands ?? []) {
    const f = comp.modules.find((m) => m.id === isl.front)
    const b = comp.modules.find((m) => m.id === isl.back)
    if (!f || !b || f.id === b.id || used.has(f.id) || used.has(b.id)) continue
    if (mountOf(f) !== "floor" || mountOf(b) !== "floor") continue
    used.add(f.id).add(b.id)
    out.push(isl)
  }
  return out
}

interface Box {
  min: [number, number, number]
  max: [number, number, number]
}

/**
 * Panells de remat d'una illa: a l'esquerra i a la dreta de la caixa de les peces dels dos mòduls (`box`, coordenades
 * de la composició), d'una sola peça de dalt a baix i del darrere del mòdul de darrere al davant del de davant. X local =
 * alçada, Y local = fondària (davant = «top», darrere = «bottom», com els laterals); cantell als tres costats vistos
 * (davant, darrere i dalt), no a terra.
 */
export function islandEndPanels(island: Island, comp: Pick<Composition, "modules">, box: Box, moduleNumber: number): Panel[] {
  const front = comp.modules.find((m) => m.id === island.front)
  if (!front) return []
  const t = island.thickness ?? ISLAND_END_THICKNESS
  const material = island.material?.trim() || frontMaterialOf(front)
  const H = box.max[1] - box.min[1]
  const D = box.max[2] - box.min[2]
  if (!(H > 0 && D > 0)) return []
  const panel = (side: "left" | "right"): Panel => ({
    id: `island:${island.id}:${side}`,
    name: side === "left" ? "remat e" : "remat d",
    label: side === "left" ? "Remat esquerre" : "Remat dret",
    role: "side",
    length: H,
    width: D,
    thickness: t,
    material,
    grain: "x",
    edges: { ...NO_EDGES, top: true, bottom: true, right: true },
    holes: [],
    grooves: [],
    module: moduleNumber,
    placement: placement([side === "left" ? box.min[0] - t : box.max[0], box.min[1], box.min[2]], Y, Z, X, side === "left" ? [-1, 0, 0] : X),
  })
  return [...(island.left ? [panel("left")] : []), ...(island.right ? [panel("right")] : [])]
}
