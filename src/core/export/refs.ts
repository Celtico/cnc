import type { Panel, PanelRole } from "../model"

/** Lletra de tipus per a la ref del taller: L lateral · H horitzontal · T trassera · F front. */
const ROLE_LETTER: Record<PanelRole, string> = {
  side: "L",
  divider: "L",
  drawerSide: "L",
  bottom: "H",
  top: "H",
  shelf: "H",
  fixedShelf: "H",
  drawerBottom: "H",
  back: "T",
  drawerBack: "T",
  door: "F",
  plinth: "F",
  drawerFront: "F",
  flap: "F",
  grille: "F",
  hatch: "F",
  panel: "F",
  worktop: "H",
  spacer: "H",
  facing: "F",
  part: "P",
  hardware: "H",
}

/**
 * Refs úniques `A.<mòdul>.<tipus>.<n>` (ÍNDICE_3D del taller), amb `n` consecutiu dins
 * de cada mòdul. Mateixa numeració per al CSV, el STEP i el JSON.
 */
export function pieceRefs(panels: Panel[]): Map<string, string> {
  const counters = new Map<number, number>()
  const out = new Map<string, string>()
  for (const p of panels) {
    const mod = p.module ?? 1
    const n = (counters.get(mod) ?? 0) + 1
    counters.set(mod, n)
    out.set(p.id, `A.${mod}.${ROLE_LETTER[p.role]}.${n}`)
  }
  return out
}
