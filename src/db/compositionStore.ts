import { CompositionSchema, cabinetToComposition, normalizeComposition, type CameraPose, type Composition } from "../core/model"
import { panelBox } from "../core/build/buildComposition"
import { migrateCableHoles } from "../core/build/refCuts"
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
    // Els passacables dels mòduls (versió anterior) passen a ser objectes que tallen.
    if (res.success && res.data.modules.length > 0) return migrateCableHoles(normalizeComposition(res.data), panelBox)
  }
  return cabinetToComposition(safeParams(project.params), project.name)
}

export async function updateProjectComposition(id: number, composition: Composition): Promise<void> {
  // Marca de «modificat»: en esborrar l'historial s'avisa que es perdrien els canvis.
  // La càmera és la desada (`saveProjectCamera`): la de l'estat de l'editor pot ser la d'obrir-lo.
  await db.transaction("rw", db.projects, async () => {
    const camera = (await db.projects.get(id))?.composition?.camera ?? composition.camera
    const { camera: _c, ...rest } = composition
    await db.projects.update(id, { composition: camera ? { ...rest, camera } : rest, updatedAt: Date.now(), edited: true })
  })
}

/**
 * Desa la càmera del visor 3D a la composició **sense tocar `updatedAt` ni `edited`**: moure la càmera no és
 * modificar el moble (no puja a l'historial, no surt «Modificat» ni es refà la miniatura).
 */
export async function saveProjectCamera(id: number, camera: CameraPose): Promise<void> {
  await db.projects
    .where("id")
    .equals(id)
    .modify((p) => {
      if (p.composition) p.composition = { ...p.composition, camera }
    })
}

// --- Plantilles de l'usuari (antigues) ------------------------------------------------

const TEMPLATES_KEY = "mobles:templates"

/**
 * Les «teves plantilles» ja no existeixen (Historial i Projectes les substitueixen): les que hi
 * havia a localStorage es converteixen en mobles del grup «Les meves plantilles» (Projectes) i
 * s'esborren de localStorage. Es fa un sol cop, en obrir l'app. Torna quantes n'ha passat.
 */
export async function migrateUserTemplates(): Promise<number> {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(TEMPLATES_KEY)
  } catch {
    return 0
  }
  if (!raw) return 0
  // Es treu abans de crear els mobles: si s'executa dues vegades seguides (React en mode estricte
  // munta l'App dos cops), la segona ja no troba res i no es dupliquen.
  try {
    localStorage.removeItem(TEMPLATES_KEY)
  } catch {
    /* sense localStorage */
  }
  let list: unknown = []
  try {
    list = JSON.parse(raw)
  } catch {
    list = []
  }
  let n = 0
  for (const t of Array.isArray(list) ? list : []) {
    const o = t as { name?: unknown; composition?: unknown; createdAt?: unknown }
    const comp = CompositionSchema.safeParse(o.composition)
    if (!comp.success || typeof o.name !== "string") continue
    const now = Date.now()
    await db.projects.add({ name: o.name, params: safeParams(undefined), composition: comp.data, folder: "Les meves plantilles", createdAt: typeof o.createdAt === "number" ? o.createdAt : now, updatedAt: now } as Project)
    n++
  }
  return n
}
