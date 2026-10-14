import { CylinderGeometry, Group, Mesh, MeshStandardMaterial } from "three"
import { legPoints } from "../../core/build/columnWalls"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { Composition } from "../../core/model"

const S = 0.001
const DARK = new MeshStandardMaterial({ color: "#2f3033", metalness: 0.4, roughness: 0.5 })
DARK.userData.shared = true
const TUBE = new CylinderGeometry(14 * S, 14 * S, 1, 16)
const FOOT = new CylinderGeometry(22 * S, 24 * S, 8 * S, 20)
TUBE.userData.sharedModel = true
FOOT.userData.sharedModel = true

/**
 * Les potes genèriques (base «Potes» sense pota de la biblioteca dibuixada) d'un moble, com `ModuleLegs` del visor, en
 * metres i coordenades de la composició: perquè els ambients i el seu render les ensenyin (per decisió de l'usuari, «la
 * foto ha de ser hiperrealista, ha de sortir tot»). Amb la base retallada per una columna, a les cantonades que queden.
 */
export function genericLegsGroup(comp: Composition, build: CompositionBuild): Group | null {
  const g = new Group()
  g.name = "potes"
  for (const m of build.modules) {
    const mod = comp.modules.find((x) => x.id === m.id)
    const base = mod?.carcass.base
    if (!mod || base?.kind !== "legs") continue
    const bottom = build.panels.find((p) => p.id === `${m.id}:bottom`)
    // La pota dibuixada per l'app o importada ja es veu (`Panel.fittings`).
    if (build.panels.some((p) => p.module === m.index && p.fittings?.some((f) => f.kind === "leg"))) continue
    const inset = base.hardware?.engine === "leg" ? (base.hardware.params.inset ?? 50) : 50
    const c = mod.carcass
    const W = c.width, D = c.depth + c.thickness
    const pts = (bottom && legPoints(bottom, inset)) ?? [
      [m.x + inset, m.z + inset],
      [m.x + W - inset, m.z + inset],
      [m.x + inset, m.z + D - inset],
      [m.x + W - inset, m.z + D - inset],
    ]
    const H = base.height
    for (const [px, pz] of pts) {
      const tube = new Mesh(TUBE, DARK)
      tube.scale.set(1, H * S, 1)
      tube.position.set(px * S, (H / 2) * S, pz * S)
      const foot = new Mesh(FOOT, DARK)
      foot.position.set(px * S, 4 * S, pz * S)
      for (const x of [tube, foot]) {
        x.castShadow = true
        x.userData.sharedModel = true
        g.add(x)
      }
    }
  }
  return g.children.length ? g : null
}
