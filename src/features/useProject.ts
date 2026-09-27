import { useMemo } from "react"
import { buildCabinet } from "../core/build/buildCabinet"
import { buildComposition, type CompositionBuild } from "../core/build/buildComposition"
import type { CabinetParams, Composition, Panel } from "../core/model"
import { compositionOf } from "../db/compositionStore"
import { nest, type Nesting, type NestOptions } from "../core/nesting/nest"
import { db, safeNestOptions, safeParams, type Project } from "../db/db"
import { useLiveQuery } from "../db/useLiveQuery"

export function useProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [])
}

/** Projecte amb `params` i `nesting` sempre complets (defectes aplicats). */
export type LoadedProject = Project & { nesting: NestOptions }

export function useProject(id: number | null): LoadedProject | undefined {
  const project = useLiveQuery(() => (id === null ? undefined : db.projects.get(id)), [id])
  return useMemo(
    () =>
      project
        ? { ...project, params: safeParams(project.params), nesting: safeNestOptions(project.nesting) }
        : undefined,
    [project],
  )
}

export function useCabinet(params: CabinetParams | undefined): Panel[] {
  return useMemo(() => (params ? buildCabinet(params) : []), [params])
}

export function useNesting(panels: Panel[], options: NestOptions | undefined): Nesting | undefined {
  return useMemo(() => (options && panels.length ? nest(panels, options) : undefined), [panels, options])
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

const EMPTY: Panel[] = []
