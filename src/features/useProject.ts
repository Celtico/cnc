import { useMemo } from "react"
import { buildCabinet } from "../core/build/buildCabinet"
import type { CabinetParams, Panel } from "../core/model"
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
