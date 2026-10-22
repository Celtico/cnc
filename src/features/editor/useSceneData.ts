import { pocketReachIssues } from "../../core/build/pocketReach"
import type { Machine } from "../../core/model/machine"
import { useMemo } from "react"
import { panelBox } from "../../core/build/geometry"
import type { ViewerModule } from "../../components/viewer/CabinetViewer"
import { movingGroups, openingCollisions } from "../../components/viewer/opening"
import { legPoints } from "../../core/build/columnWalls"
import { moduleBoxToWorld, type CompositionBuild, type CompositionWarning } from "../../core/build/buildComposition"
import type { ModuleBuild } from "../../core/build/buildModule"
import { materialIssues } from "../../core/build/materialIssues"
import { isEmptyComposition, mountOf, wallSides, partCutters, resolveParts, viewerSize, type Composition, type HardwareItem, type Module, type Panel, type Settings } from "../../core/model"
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
  machine,
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
  /** La màquina per defecte: els buidats que cap fresa no fa (`pocketReachIssues`). */
  machine?: Machine
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

  const viewerModules: ViewerModule[] = useMemo(() => {
      // Primer la posició: d'esquena a la paret d'un costat, es mou al llarg d'aquella paret (`wallSides`).
      const sides = wallSides(comp)
      return (build?.modules ?? []).map((m) => {
        const c = comp.modules[m.index - 1]!.carcass
        const mod = comp.modules[m.index - 1]!
        // Girat 90° o 270°: el contorn, la maneta i les potes genèriques van a la seva petjada a la planta.
        const quarter = m.turn?.rot === 90 || m.turn?.rot === 270
        const w = quarter ? moduleBoxToWorld(m, { x0: 0, x1: c.width, y0: 0, y1: c.height, z0: 0, z1: c.depth + c.thickness }) : undefined
        const place = w ? { x: w.x0, z: w.z0, width: w.x1 - w.x0, depth: w.z1 - w.z0 } : { x: m.x, z: m.z, width: c.width, depth: c.depth + c.thickness }
        // La base unida amb la del veí (`joinInLinePanels`) no és la d'aquest mòdul: les potes, a les seves cantonades.
        const bottom = build?.panels.find((p) => p.id === `${m.id}:bottom`)
        const own = m.build.panels.find((p) => p.id === "bottom")
        const sameBottom = bottom && own && Math.abs(bottom.length * bottom.width - own.length * own.width) < 1
        const legs = c.base.kind === "legs" ? legsView(c.base, w ? place.depth : c.depth, m.build.panels, sameBottom ? bottom : undefined) : undefined
        const side = sides[m.index - 1]
        const along = side === "left" || side === "right" ? { side, along: mountOf(mod) === "floor" ? (mod.wallGap ?? 0) : (mod.sideAlong ?? 0) } : {}
        return { id: m.id, index: m.index, ...place, y: m.y, height: c.height, wall: c.base.kind === "wall", free: mountOf(mod) === "floor", ...along, ...(legs ? { legs } : {}) }
      })
    }, [build, comp])

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
    const own = [...materialIssues(build, comp, materials), ...pocketReachIssues(build.panels, machine)]
    return own.length ? [...build.warnings, ...own] : build.warnings
  }, [build, comp, materials, machine])
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
    // Coordenades del mòdul a la composició (també si està girat: `moduleBoxToWorld`).
    if (selectionKind === "module") return { ...moduleBoxToWorld(mod, { x0: 0, x1: c.width, y0: 0, y1: c.height, z0: 0, z1: c.depth + c.thickness }), veil: false }
    if (selectionKind !== "zone" || !zoneRect) return null
    return moduleBoxToWorld(mod, { x0: zoneRect.x0, x1: zoneRect.x1, y0: zoneRect.y0, y1: zoneRect.y1, z0: 0, z1: c.depth + c.thickness })
  }, [selectionKind, zoneRect, build, moduleIndex, module])
  const openOnly = useMemo(() => {
    if (!viewer.openOnlySelected || !zoneRect || !build) return null
    const mod = build.modules[moduleIndex]
    if (!mod) return null
    const m = comp.modules[moduleIndex]
    const { x0, x1, y0, y1, z0, z1 } = moduleBoxToWorld(mod, { x0: zoneRect.x0, x1: zoneRect.x1, y0: zoneRect.y0, y1: zoneRect.y1, z0: 0, z1: m ? m.carcass.depth + m.carcass.thickness : 0 })
    const ids = new Set<string>()
    for (const g of groups) {
      const p = panels.find((x) => x.id === g.panelIds[0])
      if (!p) continue
      const b = panelBox(p)
      // Un mòdul girat 90° té els compartiments en Z.
      const quarter = mod.turn?.rot === 90 || mod.turn?.rot === 270
      const across = quarter ? b.max[2] > z0 + 1 && b.min[2] < z1 - 1 : b.max[0] > x0 + 1 && b.min[0] < x1 - 1
      if (across && b.max[1] > y0 + 1 && b.min[1] < y1 - 1) ids.add(g.id)
    }
    return ids
  }, [viewer.openOnlySelected, zoneRect, build, moduleIndex, groups, panels, comp.modules])
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
