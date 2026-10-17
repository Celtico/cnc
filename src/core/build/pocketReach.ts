import { isFlatPocket, pocketBounds, type Panel } from "../model"
import type { Machine } from "../model/machine"
import type { CompositionWarning } from "./buildComposition"

const num = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",")

/**
 * Buidats que cap fresa de la màquina per defecte no fa (per decisió de l'usuari, 2026-10-17: «el tall no l'agafa la vista
 * CAM»): més fons que la fondària útil de la fresa més llarga. El build no llegeix Preferències (la màquina): es comprova
 * a part, a l'Editor, com els materials. Un avís per peça.
 */
export function pocketReachIssues(panels: readonly Panel[], machine: Machine | undefined): CompositionWarning[] {
  if (!machine) return []
  const routers = machine.tools.filter((t) => t.kind === "router" && t.mounted && t.auto && t.diameter > 0)
  if (!routers.length) return []
  const reach = Math.max(...routers.map((t) => (t.maxDepth > 0 ? t.maxDepth : Infinity)))
  const out: CompositionWarning[] = []
  for (const p of panels) {
    const deep = (p.pockets ?? []).filter((k) => k.depth > reach + 1e-6)
    if (!deep.length) continue
    const k = deep.reduce((a, b) => (b.depth > a.depth ? b : a))
    const b = pocketBounds(k)
    out.push({
      code: "ref-cut",
      panelId: p.id,
      message: `${p.label}: el ${isFlatPocket(k) ? "buidat" : "relleu"} de ${num(b.x1 - b.x0)} × ${num(b.y1 - b.y0)} fa ${num(k.depth)} mm de fons i la fresa més llarga de «${machine.name}» n'arriba a ${num(reach)}: no surt al programa (ni a la Vista CAM).`,
      options: [
        { text: `Pujar l'objecte que talla ${num(k.depth - reach)} mm (o fer-lo menys fons).` },
        { text: "Afegir una fresa més llarga a Preferències › Màquines › Eines (amb la seva fondària útil)." },
      ],
    })
  }
  return out
}
