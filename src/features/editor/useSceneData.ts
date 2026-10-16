import { useMemo } from "react"
import { panelBox } from "../../core/build/geometry"
import type { ViewerModule } from "../../components/viewer/CabinetViewer"
import { movingGroups, openingCollisions } from "../../components/viewer/opening"
import { legPoints } from "../../core/build/columnWalls"
import { moduleWorldX, type CompositionBuild, type CompositionWarning } from "../../core/build/buildComposition"
import type { ModuleBuild } from "../../core/build/buildModule"
import { materialIssues } from "../../core/build/materialIssues"
import { isEmptyComposition, mountOf, partCutters, resolveParts, viewerSize, type Composition, type HardwareItem, type Module, type Panel, type Settings } from "../../core/model"
import type { Selection } from "../composition/StructureTree"
import type { ViewerState } from "./ViewerControls"

/** Llista buida estable (mentre no hi ha moble construït). */
const NO_PANELS: Panel[] = []
export const NO_WARNINGS: CompositionWarning[] = []

/** Mida (mm) de l'escena d'un document buit: el que ocuparia un moble mitjà, per enquadrar la càmera i el terra. */
const EMPTY_STAGE = { width: 1200, height: 900, depth: 600 }

/** El que es dibuixa i s'avisa a partir del moble construït: peces, mòduls, fantasmes, avisos, obertura i ressaltats. */
export function useSceneData({
  comp,
  build,
  materials,
  selectionKind,
  selectedZone,
  module,
  moduleIndex,
  moduleBuild,
  viewer,
}: {
  comp: Composition
  build: CompositionBuild | undefined
  materials: Settings["materials"]
  selectionKind: Selection["kind"]
  selectedZone: string | null
  module: Module | undefined
  moduleIndex: number
  moduleBuild: ModuleBuild | undefined
  viewer: Pick<ViewerState, "opening" | "openOnlySelected">
}) {
  const panels = build?.panels ?? NO_PANELS

  const size = useMemo(() => viewerSize(comp), [comp])
  // Document buit (un moble o un objecte nou): res a enquadrar; el visor mostra el terra d'una escena de mida normal i
  // s'hi pot orbitar. En afegir-hi el primer element, el visor no es mou (editar no mou la càmera).
  const empty = isEmptyComposition(comp)
  const frameSize = empty ? EMPTY_STAGE : size

  const viewerModules: ViewerModule[] = useMemo(
    () =>
      (build?.modules ?? []).map((m) => {
        const c = comp.modules[m.index - 1]!.carcass
        const mod = comp.modules[m.index - 1]!
        return { id: m.id, index: m.index, x: m.x, y: m.y, z: m.z, width: c.width, height: c.height, depth: c.depth + c.thickness, wall: c.base.kind === "wall", free: mountOf(mod) === "floor", ...(c.base.kind === "legs" ? { legs: legsView(c.base, c.depth, m.build.panels, build?.panels.find((p) => p.id === `${m.id}:bottom`)) } : {}) }
      }),
    [build, comp],
  )

  const absParts = useMemo(() => resolveParts(comp), [comp])
  // Les peces que tallen es veuen com els objectes que tallen (fantasma violeta, amb el gizmo).
  const solidParts = useMemo(() => absParts.filter((p) => p.effect !== "cut" && !p.hidden), [absParts])
  const cutPartIds = useMemo(() => new Set(absParts.filter((p) => p.effect === "cut").map((p) => p.id)), [absParts])
  const ghosts = useMemo(() => {
    const hiddenParts = new Set((comp.parts ?? []).filter((q) => q.hidden).map((q) => `part:${q.id}`))
    return [...comp.references, ...(cutPartIds.size ? partCutters(comp) : [])].filter((g) => !g.hidden && !hiddenParts.has(g.id))
  }, [comp, cutPartIds])

  // Els de fusteria i, com que el build no llegeix Preferències, els de materials (no hi és, gruix que no té).
  const warnings = useMemo(() => {
    if (!build) return NO_WARNINGS
    const own = materialIssues(build, comp, materials)
    return own.length ? [...build.warnings, ...own] : build.warnings
  }, [build, comp, materials])
  // Al 3D també els elements sense nesting (ferro, pedra, vidre…).
  const viewerPanels = useMemo(() => (build?.extras.length ? [...panels, ...build.extras] : panels), [build, panels])
  // L'ull de l'arbre: el que s'amaga no es dibuixa a l'editor (es fabrica igual i surt a Peces, Nesting i Exportar).
  const shownPanels = useMemo(() => {
    const mods = comp.modules.filter((m) => m.hidden).map((m) => `${m.id}:`)
    const parts = (comp.parts ?? []).filter((q) => q.hidden).map((q) => `part:${q.id}`)
    if (!mods.length && !parts.length) return viewerPanels
    return viewerPanels.filter((p) => !mods.some((k) => p.id.startsWith(k)) && !parts.some((k) => p.id === k || p.id.startsWith(`${k}-`)))
  }, [viewerPanels, comp])

  // Obertura: grups mòbils, els del compartiment seleccionat i les col·lisions.
  const groups = useMemo(() => movingGroups(panels), [panels])
  const zoneRect = selectedZone ? moduleBuild?.layout.rects.get(selectedZone) : undefined
  // Caixa del compartiment seleccionat per ressaltar-lo al 3D (fins al front del mòdul).
  const highlightZone = useMemo(() => {
    if (!build) return null
    const mod = build.modules[moduleIndex]
    if (!mod || !module) return null
    const c = module.carcass
    // Mòdul seleccionat: només el contorn, sense vel i sòlid (translúcid només amb un compartiment).
    if (selectionKind === "module")
      return { x0: mod.x, x1: mod.x + c.width, y0: mod.y, y1: mod.y + c.height, z0: mod.z, z1: mod.z + c.depth + c.thickness, veil: false }
    if (selectionKind !== "zone" || !zoneRect) return null
    const [x0, x1] = [moduleWorldX(mod, zoneRect.x0), moduleWorldX(mod, zoneRect.x1)].sort((a, b) => a - b) as [number, number]
    return { x0, x1, y0: mod.y + zoneRect.y0, y1: mod.y + zoneRect.y1, z0: mod.z, z1: mod.z + c.depth + c.thickness }
  }, [selectionKind, zoneRect, build, moduleIndex, module])
  const openOnly = useMemo(() => {
    if (!viewer.openOnlySelected || !zoneRect || !build) return null
    const mod = build.modules[moduleIndex]
    if (!mod) return null
    const [x0, x1] = [moduleWorldX(mod, zoneRect.x0), moduleWorldX(mod, zoneRect.x1)].sort((a, b) => a - b) as [number, number]
    const y0 = mod.y + zoneRect.y0
    const y1 = mod.y + zoneRect.y1
    const ids = new Set<string>()
    for (const g of groups) {
      const p = panels.find((x) => x.id === g.panelIds[0])
      if (!p) continue
      const b = panelBox(p)
      if (b.max[0] > x0 + 1 && b.min[0] < x1 - 1 && b.max[1] > y0 + 1 && b.min[1] < y1 - 1) ids.add(g.id)
    }
    return ids
  }, [viewer.openOnlySelected, zoneRect, build, moduleIndex, groups, panels])
  const collisions = useMemo(() => openingCollisions(panels, groups, viewer.opening, comp.references, openOnly ?? undefined), [panels, groups, viewer.opening, comp.references, openOnly])

  const collidingRefs = useMemo(() => new Set(warnings.flatMap((w) => (w.refId ? [w.refId] : []))), [warnings])
  // Els que tallen i toquen alguna peça (verd); els altres que tallen, en vermell.
  const cuttingRefs = useMemo(() => new Set(build?.cutting ?? []), [build])

  return { panels, size, empty, frameSize, viewerModules, absParts, solidParts, cutPartIds, ghosts, warnings, viewerPanels, shownPanels, groups, zoneRect, highlightZone, openOnly, collisions, collidingRefs, cuttingRefs }
}

export type SceneData = ReturnType<typeof useSceneData>

/**
 * Les potes d'un mòdul al visor: on van (`inset` de la pota triada, si n'hi ha) i si ja es dibuixen amb el model de la
 * pota importada (la base en porta els `fittings`): aleshores no es dibuixen les genèriques.
 */
function legsView(base: { height: number; hardware?: HardwareItem }, depth: number, panels: Panel[], bottom?: Panel): { height: number; depth: number; inset?: number; fitted?: boolean; points?: [number, number][] } {
  const inset = base.hardware?.engine === "leg" ? base.hardware.params.inset : undefined
  const fitted = panels.some((p) => p.fittings?.some((f) => f.kind === "leg"))
  // Base retallada per una columna: les potes a les cantonades que queden (no a l'osca).
  const points = bottom ? legPoints(bottom, inset ?? 50) : undefined
  return { height: base.height, depth, ...(inset !== undefined ? { inset } : {}), ...(fitted ? { fitted } : {}), ...(points ? { points } : {}) }
}
