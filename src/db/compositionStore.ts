import { CompositionSchema, cabinetToComposition, normalizeComposition, type Composition } from "../core/model"
import { db, safeParams, type Project } from "./db"

/**
 * Persistència de la composició (Fase 5) sense tocar l'esquema de Dexie: és un camp
 * no indexat del projecte. Els projectes antics només tenen `params`; es migren en
 * llegir-los amb `compositionOf` i es desen la primera vegada que s'editen.
 */
declare module "./db" {
  interface Project {
    /** Composició de mòduls. Si falta, es deriva de `params` (mòdul de caixa antic). */
    composition?: Composition
  }
}

/** Composició d'un projecte, migrant el mòdul de caixa antic si cal. */
export function compositionOf(project: Pick<Project, "params" | "composition" | "name">): Composition {
  if (project.composition) {
    const res = CompositionSchema.safeParse(project.composition)
    if (res.success && res.data.modules.length > 0) return normalizeComposition(res.data)
  }
  return cabinetToComposition(safeParams(project.params), project.name)
}

export async function updateProjectComposition(id: number, composition: Composition): Promise<void> {
  await db.projects.update(id, { composition, updatedAt: Date.now() })
}

// --- Plantilles de l'usuari (JSON a localStorage) -----------------------------------

export interface UserTemplate {
  id: string
  name: string
  composition: Composition
  createdAt: number
}

const TEMPLATES_KEY = "mobles:templates"

export function loadUserTemplates(): UserTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t): t is UserTemplate => {
      if (typeof t !== "object" || t === null) return false
      const o = t as Record<string, unknown>
      return typeof o.id === "string" && typeof o.name === "string" && CompositionSchema.safeParse(o.composition).success
    })
  } catch {
    return []
  }
}

export function saveUserTemplate(name: string, composition: Composition): UserTemplate[] {
  const list = loadUserTemplates()
  const t: UserTemplate = { id: `t${Date.now().toString(36)}`, name: name.trim() || "Plantilla", composition, createdAt: Date.now() }
  const next = [t, ...list]
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    /* sense localStorage */
  }
  return next
}

export function deleteUserTemplate(id: string): UserTemplate[] {
  const next = loadUserTemplates().filter((t) => t.id !== id)
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next))
  } catch {
    /* sense localStorage */
  }
  return next
}

function writeTemplates(list: UserTemplate[]): UserTemplate[] {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list))
  } catch {
    /* sense localStorage */
  }
  return list
}

export function renameUserTemplate(id: string, name: string): UserTemplate[] {
  const n = name.trim()
  if (!n) return loadUserTemplates()
  return writeTemplates(loadUserTemplates().map((t) => (t.id === id ? { ...t, name: n } : t)))
}

export function duplicateUserTemplate(id: string): UserTemplate[] {
  const list = loadUserTemplates()
  const src = list.find((t) => t.id === id)
  if (!src) return list
  const copy: UserTemplate = { ...structuredClone(src), id: `t${Date.now().toString(36)}`, name: `${src.name} (còpia)`, createdAt: Date.now() }
  return writeTemplates([copy, ...list])
}
