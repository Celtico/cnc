import Dexie, { type EntityTable } from "dexie"
import { DEFAULT_CABINET, parseCabinetParams, type CabinetParams } from "../core/model"
import { DEFAULT_NEST_OPTIONS, NestOptionsSchema, type NestOptions } from "../core/nesting/nest"
import type { Pt } from "../core/photo/homography"
import type { ReferencePlane } from "../core/photo/camera"
import type { Measure } from "../core/photo/measure"

/** Una mesura de la foto aplicada a un paràmetre del moble: es recorda per avisar si és estimada. */
export interface AppliedMeasure {
  measureId: string
  /** `module:<id>:width|height|depth` o `ref:<id>:w|h|d`. */
  target: string
  label: string
}

/** Calibració de la foto d'un projecte. Les mides reals les entra l'usuari. */
export interface PhotoCalibration {
  photoId: number
  /** 4 punts (px de la imatge): baix-esquerra, baix-dreta, dalt-dreta, dalt-esquerra. */
  points: Pt[]
  /** Mides conegudes del rectangle de referència (mm); null si no se saben (només relatiu). */
  ref: { w: number | null; h: number | null }
  /** Forma coneguda (amplada/alçada) quan les mides no se saben (p. ex. un A4). */
  refAspect?: number | null
  /** Mesures sobre la foto (distàncies i rectangles), amb la mida amb cinta si n'hi ha. */
  measures?: Measure[]
  /** Línia del terra: 2 punts on la paret toca el terra. */
  floorLine?: [Pt, Pt]
  applied?: AppliedMeasure[]
  /** Opacitat del moble superposat (0..1) i capes visibles. */
  opacity?: number
  layer?: "photo" | "cabinet" | "both"
  /** Com es dibuixa el moble: línies (ràpid, per encaixar) o render realista. */
  render?: "lines" | "realistic"
  /** Ombres del render realista sobre el terra i la paret. Per defecte sí. */
  shadows?: boolean
  plane: ReferencePlane
  /** Focal equivalent a 35 mm (de l'EXIF o ajustada a mà). */
  focal35: number
  /**
   * Origen (0,0) triat per l'usuari (px de la imatge), p. ex. el racó de la paret a
   * terra. Si no n'hi ha, l'origen és la cantonada baix-esquerra de la referència.
   */
  origin?: Pt
  /**
   * Origen en 3D (mm): x, y sobre la paret (coordenades de la referència) i z =
   * distància a la paret. Té prioritat sobre `origin`; es mou amb els eixos.
   */
  originMm?: [number, number, number]
  /** Posició del moble respecte a l'origen (mm): X i Y (alçada o distància al terra). */
  offset: Pt
  /** Separació del darrere del moble respecte a la paret (mm). Per defecte 0. */
  offsetZ?: number
  /** Distància de la referència a la paret (mm), si no hi toca (p. ex. una tele). Per defecte 0. */
  refWallOffset?: number
}

export interface Photo {
  id: number
  projectId: number
  blob: Blob
  width: number
  height: number
  /** Focal 35 mm llegida de l'EXIF, si n'hi havia. */
  exifFocal35: number | null
  createdAt: number
}

export interface Project {
  id: number
  name: string
  params: CabinetParams
  /** Opcions de nesting (tauler, kerf, marge). Opcional: projectes antics no en tenen. */
  nesting?: NestOptions
  /** Foto del racó i calibració. Opcional. */
  photo?: PhotoCalibration
  /** Grup (carpeta) de l'historial, per ordenar-los. */
  folder?: string
  /** S'ha modificat després de crear-lo (a l'editor o a l'ambient): esborrar-lo perdria els canvis. */
  edited?: boolean
  createdAt: number
  updatedAt: number
}

export type NewProject = Omit<Project, "id">

/** Ambient: plànol de la casa amb mobles col·locats (`core/model/ambient.ts`). */
export interface AmbientRow {
  id: number
  name: string
  /** Contingut (`Ambient`); es valida amb `parseAmbient` en llegir-lo. */
  data: unknown
  /** Grup (carpeta) de l'historial. */
  folder?: string
  createdAt: number
  updatedAt: number
}

/** Fila única de preferències (id = "user"). El contingut es valida amb zod en llegir-lo. */
export interface SettingsRow {
  id: string
  data: unknown
  updatedAt: number
}

class MoblesDB extends Dexie {
  projects!: EntityTable<Project, "id">
  photos!: EntityTable<Photo, "id">
  settings!: EntityTable<SettingsRow, "id">
  ambients!: EntityTable<AmbientRow, "id">

  constructor() {
    super("mobles-cnc")
    this.version(1).stores({
      projects: "++id, name, updatedAt",
    })
    this.version(2).stores({
      projects: "++id, name, updatedAt",
      photos: "++id, projectId",
    })
    this.version(3).stores({
      projects: "++id, name, updatedAt",
      photos: "++id, projectId",
      settings: "id",
    })
    this.version(4).stores({
      projects: "++id, name, updatedAt",
      photos: "++id, projectId",
      settings: "id",
      ambients: "++id, name, updatedAt",
    })
  }
}

export const db = new MoblesDB()

export async function createProject(name?: string, params?: CabinetParams, extra: Partial<Project> = {}): Promise<number> {
  const count = await db.projects.count()
  const now = Date.now()
  const id = await db.projects.add({
    ...extra,
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
  const { id: _id, name: _name, params: _params, createdAt: _c, updatedAt: _u, photo: _photo, ...rest } = src
  return createProject(`${src.name} (còpia)`, src.params, rest)
}

export async function deleteProject(id: number): Promise<void> {
  await db.transaction("rw", db.projects, db.photos, async () => {
    await db.photos.where("projectId").equals(id).delete()
    await db.projects.delete(id)
  })
}

export async function addPhoto(photo: Omit<Photo, "id">): Promise<number> {
  return db.photos.add(photo as Photo)
}

export async function updateProjectPhoto(id: number, photo: PhotoCalibration | undefined): Promise<void> {
  await db.projects.update(id, { photo, updatedAt: Date.now() })
}

/** Esborra la foto i la calibració del projecte. */
export async function removeProjectPhoto(id: number): Promise<void> {
  await db.transaction("rw", db.projects, db.photos, async () => {
    await db.photos.where("projectId").equals(id).delete()
    await db.projects.update(id, { photo: undefined, updatedAt: Date.now() })
  })
}

export async function updateProjectNesting(id: number, nesting: NestOptions): Promise<void> {
  await db.projects.update(id, { nesting, updatedAt: Date.now() })
}

/** Opcions de nesting guardades, completades amb els defectes si falten o són antigues. */
export function safeNestOptions(n: unknown, fallback: NestOptions = DEFAULT_NEST_OPTIONS): NestOptions {
  const res = NestOptionsSchema.safeParse(n)
  return res.success ? res.data : fallback
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

// --- Ambients ------------------------------------------------------------------------------

export async function createAmbient(name: string, data: unknown): Promise<number> {
  const now = Date.now()
  return db.ambients.add({ name, data, createdAt: now, updatedAt: now } as AmbientRow)
}

export async function updateAmbient(id: number, patch: Partial<Pick<AmbientRow, "name" | "data">>): Promise<void> {
  await db.ambients.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteAmbient(id: number): Promise<void> {
  await db.ambients.delete(id)
}

/** Modificat després de crear-lo (els antics, sense la marca: si s'han desat més tard). */
export function isEdited(p: Pick<Project, "edited" | "createdAt" | "updatedAt">): boolean {
  return p.edited ?? p.updatedAt - p.createdAt > 5000
}

/**
 * Còpia d'un ambient **amb els seus mobles i objectes propis**: cada moble enllaçat es duplica i la
 * còpia apunta als nous (així canviar-ne un a la còpia no toca l'original, p. ex. dos clients amb la
 * mateixa escena). Amb `client`, la còpia es diu «nom · client» i tot va al grup del client.
 */
export async function duplicateAmbient(id: number, client?: string): Promise<number | undefined> {
  const src = await db.ambients.get(id)
  if (!src) return undefined
  const who = client?.trim() || undefined
  const names = (await db.ambients.toArray()).map((a) => a.name)
  const base = who ? `${src.name.replace(/ · .*$/, "")} · ${who}` : `${src.name} (còpia)`
  let name = base
  for (let n = 2; names.includes(name); n++) name = `${base} (${n})`
  const folder = who
  const data = structuredClone(src.data) as { items?: { kind?: string; projectId?: number }[] }
  const map = new Map<number, number>()
  for (const it of data.items ?? []) {
    if (it.kind !== "moble" || typeof it.projectId !== "number") continue
    if (!map.has(it.projectId)) {
      const p = await db.projects.get(it.projectId)
      if (!p) continue
      const { id: _id, createdAt: _c, updatedAt: _u, photo: _photo, folder: _f, ...rest } = p
      void _id, void _c, void _u, void _photo, void _f
      const projectNames = (await db.projects.toArray()).map((x) => x.name)
      const pBase = who ? `${p.name.replace(/ · .*$/, "").replace(/ \(\d+\)$/, "")} · ${who}` : `${p.name} (còpia)`
      let pName = pBase
      for (let n = 2; projectNames.includes(pName); n++) pName = `${pBase} (${n})`
      map.set(it.projectId, await createProject(pName, p.params, { ...rest, name: pName, ...(folder ? { folder } : {}) }))
    }
    it.projectId = map.get(it.projectId)
  }
  const copy = await createAmbient(name, data)
  const ambientFolder = who ?? src.folder
  if (ambientFolder) await db.ambients.update(copy, { folder: ambientFolder })
  return copy
}

/** Posa (o treu, amb `undefined`) mobles/objectes d'un grup de l'historial. No canvia la data. */
export async function setProjectsFolder(ids: number[], folder: string | undefined): Promise<void> {
  await db.projects.bulkUpdate(ids.map((id) => ({ key: id, changes: { folder } })))
}

export async function setAmbientsFolder(ids: number[], folder: string | undefined): Promise<void> {
  await db.ambients.bulkUpdate(ids.map((id) => ({ key: id, changes: { folder } })))
}

export async function renameAmbient(id: number, name: string): Promise<void> {
  await db.ambients.update(id, { name: name.trim() || "Sense nom", updatedAt: Date.now() })
}
