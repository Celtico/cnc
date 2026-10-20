import type { Zone } from "./composition"

/** Hi ha calaixos tapats per les portes de tot el mòdul que encara no són interiors (`drawersBehindDoors` els passaria). */
export function hasDrawersBehindDoors(root: Zone): boolean {
  if (root.front?.kind !== "door" || !root.split) return false
  const walk = (z: Zone): boolean => (z.split ? z.split.children.some(walk) : z.front?.kind === "drawers" && !z.innerDrawers)
  return root.split.children.some(walk)
}

/**
 * Portes de tot el mòdul i calaixos (per petició de l'usuari, 2026-10-20: «quan fico portes, desapareixen els calaixos»).
 * Les portes de dalt a baix tapen els compartiments: una pila de calaixos de dins no es pot fer amb el seu front.
 * `drawersBehindDoors` la passa a **calaixos interiors** (el mateix nombre, les alçades, la guia i el joc; el front es
 * recorda a `fronts.drawers`). `drawersWithoutDoors` fa el contrari en treure les portes: sense porta, els calaixos
 * interiors no es fan i el front recordat torna. `heights`: les alçades reals de cada pila (`ModuleBuild.drawerHeights`,
 * abans de posar les portes); sense, les fixes del front i 150 mm a les «auto».
 */
export function drawersBehindDoors(root: Zone, heights?: Readonly<Record<string, readonly number[]>>, leafHeights?: Readonly<Record<string, number>>, betweenGap = 0): Zone {
  const walk = (z: Zone): Zone => {
    if (z.split) return { ...z, split: { ...z.split, children: z.split.children.map(walk) } }
    const f = z.front
    if (f?.kind !== "drawers" || z.innerDrawers) return z
    const real = heights?.[z.id]
    // Sense les alçades reals: les «auto» es reparteixen l'alçada del compartiment (`leafHeights`), o 150 mm.
    const fixed = f.heights.slice(0, f.n).reduce<number>((a, h) => a + (typeof h === "number" ? h : 0), 0)
    const autos = Array.from({ length: f.n }, (_, i) => f.heights[i] ?? "auto").filter((h) => h === "auto").length
    const slot = leafHeights?.[z.id]
    const auto = slot !== undefined && autos ? (slot - (f.n - 1) * betweenGap - fixed) / autos : 150
    const hs = Array.from({ length: f.n }, (_, i) => {
      const h = real?.[i] ?? f.heights[i]
      return Math.min(1000, Math.max(60, Math.floor(typeof h === "number" ? h : auto)))
    })
    const inner: NonNullable<Zone["innerDrawers"]> = { n: f.n, height: hs[0]!, ...(new Set(hs).size > 1 ? { heights: hs } : {}) }
    if (f.hardware) inner.hardware = f.hardware
    if (f.kit) inner.kit = f.kit
    if (f.drawerSlides) inner.drawerSlides = f.drawerSlides
    if (f.glass) inner.glass = true
    const { front: _f, ...rest } = z
    return { ...rest, fronts: { ...z.fronts, drawers: f }, innerDrawers: inner }
  }
  return root.split ? { ...root, split: { ...root.split, children: root.split.children.map(walk) } } : root
}

/** El contrari de `drawersBehindDoors`: els calaixos interiors amb un front de calaixos recordat el tornen a fer servir. */
export function drawersWithoutDoors(root: Zone): Zone {
  const walk = (z: Zone): Zone => {
    if (z.split) return { ...z, split: { ...z.split, children: z.split.children.map(walk) } }
    const f = z.fronts?.drawers
    if (z.front || !z.innerDrawers || f?.kind !== "drawers") return z
    const { innerDrawers: _i, ...rest } = z
    return { ...rest, front: { ...f, n: z.innerDrawers.n } }
  }
  return root.split ? { ...root, split: { ...root.split, children: root.split.children.map(walk) } } : root
}
