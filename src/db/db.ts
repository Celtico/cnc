import Dexie, { type EntityTable } from "dexie"
import { DEFAULT_CABINET, parseCabinetParams, type CabinetParams } from "../core/model"

export interface Project {
  id: number
  name: string
  params: CabinetParams
  createdAt: number
  updatedAt: number
}

export type NewProject = Omit<Project, "id">

class MoblesDB extends Dexie {
  projects!: EntityTable<Project, "id">

  constructor() {
    super("mobles-cnc")
    this.version(1).stores({
      projects: "++id, name, updatedAt",
    })
  }
}

export const db = new MoblesDB()

export async function createProject(name?: string, params?: CabinetParams): Promise<number> {
  const count = await db.projects.count()
  const now = Date.now()
  const id = await db.projects.add({
    name: name ?? `Mòdul ${count + 1}`,
    params: params ?? DEFAULT_CABINET,
    createdAt: now,
    updatedAt: now,
  } as Project)
  return id
}

export async function duplicateProject(id: number): Promise<number | undefined> {
  const src = await db.projects.get(id)
  if (!src) return undefined
  return createProject(`${src.name} (còpia)`, src.params)
}

export async function deleteProject(id: number): Promise<void> {
  await db.projects.delete(id)
}

export async function updateProjectParams(id: number, params: CabinetParams): Promise<void> {
  await db.projects.update(id, { params, updatedAt: Date.now() })
}

export async function renameProject(id: number, name: string): Promise<void> {
  await db.projects.update(id, { name: name.trim() || "Sense nom", updatedAt: Date.now() })
}

/** Els paràmetres guardats poden ser d'una versió antiga: completa'ls amb els defectes. */
export function safeParams(p: unknown): CabinetParams {
  try {
    return parseCabinetParams(p)
  } catch {
    return DEFAULT_CABINET
  }
}
