import { useMemo } from "react"
import { buildCabinet } from "../core/build/buildCabinet"
import type { CabinetParams, Panel } from "../core/model"
import { db, safeParams, type Project } from "../db/db"
import { useLiveQuery } from "../db/useLiveQuery"

export function useProjects(): Project[] | undefined {
  return useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), [])
}

export function useProject(id: number | null): Project | undefined {
  const project = useLiveQuery(() => (id === null ? undefined : db.projects.get(id)), [id])
  return useMemo(
    () => (project ? { ...project, params: safeParams(project.params) } : undefined),
    [project],
  )
}

export function useCabinet(params: CabinetParams | undefined): Panel[] {
  return useMemo(() => (params ? buildCabinet(params) : []), [params])
}
