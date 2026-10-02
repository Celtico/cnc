import { CompositionSchema, cabinetToComposition, normalizeComposition, parseCameraPose, repairComposition, type CameraPose, type Composition } from "../core/model"
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

/** Lectura d'una composició desada, amb el que s'ha hagut de reparar. */
export interface CompositionRead {
  composition: Composition
  /** El que s'ha tret o restaurat en llegir-la (en català). Buit si era vàlida. */
  problems: string[]
  /**
   * La composició desada no s'ha pogut llegir (ni reparant-la): `composition` és una caixa per defecte. L'Editor
   * **no ha de desar** a sobre (es perdrien les dades de debò, que potser una versió nova de l'app sap llegir).
   */
  unreadable: boolean
}

// Es llegeix moltes vegades (cerca, targetes, miniatures): la reparació (pura) es recorda per objecte desat. La
// normalització no, perquè els àlies dels materials depenen de les preferències carregades.
const repairs = new WeakMap<object, ReturnType<typeof repairComposition>>()
function repairCached(raw: unknown): ReturnType<typeof repairComposition> {
  if (typeof raw !== "object" || raw === null) return repairComposition(raw)
  const hit = repairs.get(raw)
  if (hit) return hit
  const r = repairComposition(raw)
  repairs.set(raw, r)
  if (!r.composition) console.warn("Composició il·legible; no es desarà a sobre.", r.problems)
  return r
}

/**
 * Composició d'un projecte: la desada, reparada element a element si cal (`repairComposition`), o, si no en té,
 * la del mòdul de caixa antic (`params`).
 */
export function readComposition(project: Pick<Project, "params" | "composition" | "name">): CompositionRead {
  const raw: unknown = project.composition
  const legacy = () => cabinetToComposition(safeParams(project.params), project.name)
  if (raw === undefined || raw === null) return { composition: legacy(), problems: [], unreadable: false }
  const { composition, problems } = repairCached(raw)
  if (!composition) return { composition: legacy(), problems, unreadable: true }
  // Sense cap mòdul bo (l'Editor en necessita un): el del mòdul de caixa, conservant la resta.
  const withModule = composition.modules.length > 0 ? composition : { ...composition, modules: legacy().modules }
  // Els passacables dels mòduls (versió anterior) passen a ser objectes que tallen.
  return { composition: migrateCableHoles(normalizeComposition(withModule), panelBox), problems, unreadable: false }
}

/** Composició d'un projecte, reparada si cal i migrant el mòdul de caixa antic. */
export function compositionOf(project: Pick<Project, "params" | "composition" | "name">): Composition {
  return readComposition(project).composition
}

/**
 * Desa la composició del projecte. **No desa** (torna `false`) si la composició desada és il·legible
 * (`readComposition(…).unreadable`): no s'escriu una caixa per defecte a sobre de les dades de debò.
 */
export async function updateProjectComposition(id: number, composition: Composition): Promise<boolean> {
  // Marca de «modificat»: en esborrar l'historial s'avisa que es perdrien els canvis.
  // La càmera és la desada (`saveProjectCamera`): la de l'estat de l'editor pot ser la d'obrir-lo.
  return db.transaction("rw", db.projects, async () => {
    const prev = await db.projects.get(id)
    if (prev?.composition !== undefined && prev.composition !== null && !repairCached(prev.composition).composition) {
      console.warn(`Moble ${id}: la composició desada és il·legible; no es desa a sobre.`)
      return false
    }
    const camera = parseCameraPose(prev?.composition?.camera) ?? composition.camera
    const { camera: _c, ...rest } = composition
    await db.projects.update(id, { composition: camera ? { ...rest, camera } : rest, updatedAt: Date.now(), edited: true })
    return true
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
      // Els antics només amb `params`: la composició que se'n fa en llegir-los (com `compositionOf`).
      p.composition = { ...(p.composition ?? compositionOf(p)), camera }
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
