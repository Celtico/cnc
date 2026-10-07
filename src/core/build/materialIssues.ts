import { materialCategory, type Composition, type MaterialPref, type Panel } from "../model"
import type { CompositionWarning } from "./buildComposition"

/**
 * Materials del moble que no lliguen amb Preferències (el build no les llegeix: es comprova a part, a l'Editor i a
 * Exportar):
 * - `unknown-material`: una peça (o un objecte de referència) d'un material que no és a Preferències: es veu amb un color
 *   per defecte i al taller surt amb aquest nom. Els components dels jocs (rol `hardware`) no compten.
 * - `thickness-not-listed`: una peça de CNC d'un gruix que no és dels del seu material (p. ex. 18 en un de 16 · 19).
 * Un avís per material (i per gruix), en l'ordre de les peces.
 */
export function materialIssues(
  build: { panels: readonly Panel[]; extras?: readonly Panel[] },
  comp: Pick<Composition, "references">,
  materials: readonly MaterialPref[],
): CompositionWarning[] {
  const byName = new Map(materials.map((m) => [m.name, m]))
  const out: CompositionWarning[] = []
  const unknown = new Set<string>()
  const thick = new Set<string>()
  const checkName = (name: string | undefined) => {
    const n = name?.trim()
    if (!n || byName.has(n) || unknown.has(n)) return
    unknown.add(n)
    out.push({ code: "unknown-material", message: `El material «${n}» no és a Preferències: es veu amb un color per defecte i al taller sortirà amb aquest nom.` })
  }
  for (const p of build.panels) {
    checkName(p.material)
    const m = byName.get(p.material)
    const key = `${p.material}\u0000${p.thickness}`
    // Els de simulació no tenen gruixos a triar (no es tallen): no s'avisa.
    if (!m || materialCategory(m) === "sim" || m.thicknesses.includes(p.thickness) || thick.has(key)) continue
    thick.add(key)
    out.push({ code: "thickness-not-listed", message: `El gruix ${fmt(p.thickness)} mm no és dels gruixos de «${m.name}» (${m.thicknesses.map(fmt).join(" · ")} mm).` })
  }
  // Els components dels jocs de ferratges (rol `hardware`) no són cap tria del moble: el 3D els pinta pel nom
  // («Acer fosc», «Blanc seda», `resolveFinish`) i no van al taller com a peces.
  for (const p of build.extras ?? []) if (p.role !== "hardware") checkName(p.material)
  for (const r of comp.references) checkName(r.material)
  return out
}

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",")
