import { useMemo } from "react"
import { buildCabinet } from "../core/build/buildCabinet"
import { buildComposition, type CompositionBuild } from "../core/build/buildComposition"
import type { CabinetParams, Composition, Panel } from "../core/model"
import { compositionOf } from "../db/compositionStore"
import { nest, type Nesting, type NestOptions } from "../core/nesting/nest"
import { db, safeNestOptions, safeParams, type Project } from "../db/db"
import { useLiveQuery } from "../db/useLiveQuery"
import { defaultMachine, type Settings } from "../core/model"
import { nestPlan } from "../core/nesting/machineNest"
import { useSettings } from "./settings/SettingsContext"

export function useProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [])
}

/** Projecte amb `params` i `nesting` sempre complets (defectes aplicats). */
export type LoadedProject = Project & { nesting: NestOptions }

/** Opcions de nesting per a un projecte que encara no en té: de les preferències. */
export function nestOptionsFromSettings(s: Settings): NestOptions {
  const general = s.boards.sheets.find((x) => x.material === "") ?? s.boards.sheets[0]!
  const byMaterial: Record<string, { w: number; h: number }> = {}
  for (const x of s.boards.sheets) if (x.material) byMaterial[x.material] = { w: x.w, h: x.h }
  return {
    sheet: { w: general.w, h: general.h },
    kerf: s.boards.kerf,
    margin: s.boards.margin,
    ...(Object.keys(byMaterial).length ? { sheetsByMaterial: byMaterial } : {}),
    ...(s.boards.ignoreGrain ? { ignoreGrain: true } : {}),
  }
}

export function useProject(id: number | null): LoadedProject | undefined {
  const project = useLiveQuery(() => (id === null ? undefined : db.projects.get(id)), [id])
  const { settings } = useSettings()
  return useMemo(
    () =>
      project
        ? { ...project, params: safeParams(project.params), nesting: safeNestOptions(project.nesting, nestOptionsFromSettings(settings)) }
        : undefined,
    [project, settings],
  )
}

export function useCabinet(params: CabinetParams | undefined): Panel[] {
  return useMemo(() => (params ? buildCabinet(params) : []), [params])
}

/**
 * Nesting del projecte. Amb una màquina a Preferències › Màquines CNC, amb la separació i el marge dels seus programes per
 * tauler (`nestPlan`): la pantalla Nesting, el CSV de TopSolid i els .xcs fan el mateix nesting. Sense, els del projecte.
 */
export function useNesting(panels: Panel[], options: NestOptions | undefined): Nesting | undefined {
  const { settings } = useSettings()
  const machine = defaultMachine(settings.machines)
  return useMemo(() => (options && panels.length ? nest(panels, nestPlan(panels, options, machine).options) : undefined), [panels, options, machine])
}

/** Composició del projecte (migrada del mòdul de caixa si cal). */
export function useComposition(project: Pick<Project, "params" | "composition" | "name"> | undefined): Composition | undefined {
  return useMemo(() => (project ? compositionOf(project) : undefined), [project])
}

export function useCompositionBuild(comp: Composition | undefined): CompositionBuild | undefined {
  return useMemo(() => (comp ? buildComposition(comp) : undefined), [comp])
}

/** Peces de tota la composició del projecte: el que fan servir peces, nesting i exports. */
export function useCompositionPanels(project: Pick<Project, "params" | "composition" | "name"> | undefined): Panel[] {
  const comp = useComposition(project)
  const build = useCompositionBuild(comp)
  return build?.panels ?? EMPTY
}

/** Elements sense nesting (peces lliures de ferro, pedra, vidre…): només llista i 3D. */
export function useCompositionExtras(project: Pick<Project, "params" | "composition" | "name"> | undefined): Panel[] {
  const comp = useComposition(project)
  const build = useCompositionBuild(comp)
  return build?.extras ?? EMPTY
}

const EMPTY: Panel[] = []
