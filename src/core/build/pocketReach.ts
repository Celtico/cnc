import { isFlatPocket, pocketBounds, type Panel } from "../model"
import type { Machine } from "../model/machine"
import type { CompositionWarning } from "./buildComposition"
import { routerReach } from "../machine/tools"
import { fmtNum } from "../../lib/format"

/**
 * Buidats que cap fresa de la màquina per defecte no fa (per decisió de l'usuari, 2026-10-17: «el tall no l'agafa la vista
 * CAM»): més fons que la fondària útil de la fresa més llarga. El build no llegeix Preferències (la màquina): es comprova
 * a part, a l'Editor, com els materials. Un avís per peça.
 */
export function pocketReachIssues(panels: readonly Panel[], machine: Machine | undefined): CompositionWarning[] {
  if (!machine) return []
  const reach = routerReach(machine)
  if (reach <= 0) return []
  const out: CompositionWarning[] = []
  for (const p of panels) {
    const deep = (p.pockets ?? []).filter((k) => k.depth > reach + 1e-6)
    if (!deep.length) continue
    const k = deep.reduce((a, b) => (b.depth > a.depth ? b : a))
    const b = pocketBounds(k)
    out.push({
      code: "pocket-reach",
      panelId: p.id,
      message: `${p.label}: el ${isFlatPocket(k) ? "buidat" : "relleu"} de ${fmtNum(b.x1 - b.x0, 1)} × ${fmtNum(b.y1 - b.y0, 1)} fa ${fmtNum(k.depth, 1)} mm de fons i la fresa més llarga de «${machine.name}» n'arriba a ${fmtNum(reach, 1)}: no surt al programa (ni a la Vista CAM).`,
      options: [
        { text: `Pujar l'objecte que talla ${fmtNum(k.depth - reach, 1)} mm (o fer-lo menys fons).` },
        { text: "Afegir una fresa més llarga a Preferències › Màquines › Eines (amb la seva fondària útil)." },
      ],
    })
  }
  return out
}
