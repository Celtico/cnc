import { z } from "zod"
import { AmbientSchema, linkedProjectIds, parseAmbient, remapMobleItems, type Ambient, type MaterialPref, type RefPreset } from "../model"
import { FileModelSchema, MOBLE_FORMAT, MobleFileSchema, NEWER_VERSION_ERROR, missingMaterials, parseMobleData, sameReference, type FileModel, type MobleFile } from "./mobleFile"

/**
 * Format de fitxer `.ambient`: JSON llegible i versionat amb l'ambient sencer (parets, elements, grups, plànol de fons,
 * materials, càmera, render a punt) i **una còpia de cada moble i objecte enllaçat**, cadascun com el seu `.moble`
 * (`MobleFile`: composició, nesting, calibratge, foto opcional i referències). Els models 3D de l'usuari van un sol cop a
 * dalt de tot (`models`), no a cada moble. En obrir-lo es crea un ambient nou amb còpies noves dels mobles
 * (`features/file/ambientIo.ts`). Sense Dexie ni DOM, com `mobleFile.ts`.
 */

export const AMBIENT_FORMAT = "mobles-cnc-ambient"
/** La versió més nova que llegeix l'app. Cada moble de dins porta la seva (`MobleFile.version`). */
export const AMBIENT_VERSION = 1

/** Un moble o objecte de l'ambient: `key` = el `projectId` dels elements dins del fitxer. */
export const FileFurnitureSchema = z.object({
  key: z.number().int(),
  moble: MobleFileSchema,
})
export type FileFurniture = z.infer<typeof FileFurnitureSchema>

export const AmbientFileSchema = z.object({
  format: z.literal(AMBIENT_FORMAT),
  version: z.literal(AMBIENT_VERSION),
  exportedAt: z.string(),
  ambient: z.object({ name: z.string(), data: AmbientSchema }),
  furniture: z.array(FileFurnitureSchema),
  /** Models 3D de l'usuari que fan servir els mobles (sense repetir). */
  models: z.array(FileModelSchema).optional(),
  /** Configuració del Render desada per a l'ambient (`SavedRender`, `localStorage`); tolerant (`mergeSaved` filtra). */
  render: z.record(z.string(), z.unknown()).optional(),
})
export type AmbientFile = z.infer<typeof AmbientFileSchema>

export interface AmbientInput {
  name: string
  ambient: Ambient
  /** El `.moble` de cada moble enllaçat, pel seu `projectId` local (`projectToMoble`). Els que no hi són es treuen. */
  furniture: ReadonlyMap<number, MobleFile>
  render?: Record<string, unknown>
  exportedAt?: string
}

export interface AmbientBuild {
  file: AmbientFile
  /** Elements de l'ambient que no van al fitxer (el seu moble no és a `furniture`: esborrat o il·legible). */
  dropped: number
}

/**
 * Fa el fitxer: els elements de moble apunten a `key` (0, 1, 2… per moble, en l'ordre en què surten; dos elements del
 * mateix moble comparteixen `key`), els mobles sense còpia es treuen (`dropped`) i els models es treuen de cada moble i
 * van un sol cop a dalt.
 */
export function buildAmbientFile(input: AmbientInput): AmbientBuild {
  const keys = new Map<number, number>()
  for (const id of linkedProjectIds(input.ambient)) if (input.furniture.has(id)) keys.set(id, keys.size)
  const data = remapMobleItems(input.ambient, keys)
  const models = new Map<string, FileModel>()
  const furniture: FileFurniture[] = [...keys].map(([id, key]) => {
    const { models: own, ...moble } = input.furniture.get(id)!
    for (const m of own ?? []) if (!models.has(m.id)) models.set(m.id, m)
    return { key, moble }
  })
  return {
    file: {
      format: AMBIENT_FORMAT,
      version: AMBIENT_VERSION,
      exportedAt: input.exportedAt ?? new Date().toISOString(),
      ambient: { name: input.name, data },
      furniture,
      ...(models.size ? { models: [...models.values()] } : {}),
      ...(input.render && Object.keys(input.render).length ? { render: input.render } : {}),
    },
    dropped: input.ambient.items.length - data.items.length,
  }
}

export function ambientToJson(file: AmbientFile): string {
  return JSON.stringify(file, null, 2)
}

/** Nom de fitxer segur: `<nom de l'ambient>.ambient` (la mateixa neteja que `mobleFileName`). */
export function ambientFileName(name: string): string {
  const safe = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
  return `${safe || "ambient"}.ambient`
}

export type AmbientParse = { ok: true; file: AmbientFile; warnings: string[] } | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/** Quin fitxer de l'app és (pel `format`): `.moble`, `.ambient` o cap. */
export function fileKind(raw: unknown): "moble" | "ambient" | null {
  if (!isRecord(raw)) return null
  return raw.format === MOBLE_FORMAT ? "moble" : raw.format === AMBIENT_FORMAT ? "ambient" : null
}

/** Migracions per versió (cada pas puja una versió). Encara cap. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

/** Llegeix un `.ambient`. Errors en català. */
export function parseAmbientFile(text: string): AmbientParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "Aquest fitxer no és un ambient (no és un JSON vàlid)." }
  }
  return parseAmbientData(raw)
}

/**
 * Valida i migra un `.ambient` ja llegit, **part a part** com el `.moble`: un model 3D, la configuració del render o un
 * moble malmesos es treuen amb un avís (i els elements d'un moble que no s'ha pogut llegir, també); l'ambient es repara
 * com en llegir-lo de la base de dades (`parseAmbient`). Cada moble passa per `parseMobleData` (la mateixa reparació, i
 * un moble d'una versió més nova fa rebutjar el fitxer sencer).
 */
export function parseAmbientData(raw: unknown): AmbientParse {
  if (fileKind(raw) === "moble") return { ok: false, error: "Aquest fitxer és un moble, no un ambient." }
  if (!isRecord(raw) || raw.format !== AMBIENT_FORMAT) return { ok: false, error: "Aquest fitxer no és un ambient." }
  let version = typeof raw.version === "number" ? raw.version : 0
  if (version > AMBIENT_VERSION) return { ok: false, error: NEWER_VERSION_ERROR }
  let obj: Record<string, unknown> = raw
  while (version < AMBIENT_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return { ok: false, error: `No es pot migrar un ambient de la versió ${version}.` }
    obj = step(obj)
    version += 1
  }

  const warnings: string[] = []
  // L'ambient: sense, el fitxer no serveix; amb dades malmeses, es repara (parets, obertures, elements) amb un avís.
  if (!isRecord(obj.ambient) || obj.ambient.data === undefined) return { ok: false, error: "Aquest fitxer no és un ambient vàlid (falta l'ambient)." }
  const name = typeof obj.ambient.name === "string" ? obj.ambient.name : "Ambient"
  if (!AmbientSchema.safeParse(obj.ambient.data).success) warnings.push("S'han tret dades malmeses de l'ambient.")
  let data = parseAmbient(obj.ambient.data)

  // Mobles: cadascun és un `.moble`; el que no es pot llegir es treu (i els seus elements de l'ambient).
  const furniture: FileFurniture[] = []
  const list = Array.isArray(obj.furniture) ? obj.furniture : []
  if (!Array.isArray(obj.furniture)) warnings.push("La llista de mobles del fitxer està malmesa.")
  for (const f of list) {
    const key = isRecord(f) && Number.isInteger(f.key) ? (f.key as number) : null
    const label = isRecord(f) && isRecord(f.moble) && isRecord(f.moble.project) && typeof f.moble.project.name === "string" ? `«${f.moble.project.name}»` : "Un moble"
    if (key === null || furniture.some((x) => x.key === key)) {
      warnings.push(`${label} del fitxer està malmès; no s'ha obert.`)
      continue
    }
    const res = parseMobleData(isRecord(f) ? f.moble : undefined)
    if (!res.ok) {
      if (res.error === NEWER_VERSION_ERROR) return res
      warnings.push(`${label} del fitxer està malmès; no s'ha obert (${res.error})`)
      continue
    }
    // Els models van a dalt; si un moble en porta (fitxer fet a mà), es fan servir igual.
    furniture.push({ key, moble: res.file })
    for (const w of res.warnings) warnings.push(`${label}: ${w}`)
  }
  const keys = new Map(furniture.map((f) => [f.key, f.key]))
  const before = data.items.length
  data = remapMobleItems(data, keys)
  const lost = before - data.items.length
  if (lost) warnings.push(lost === 1 ? "Un element de l'ambient no tenia el seu moble al fitxer; s'ha tret." : `${lost} elements de l'ambient no tenien el seu moble al fitxer; s'han tret.`)

  // Models 3D: el que estigui malmès es treu (el moble s'obre igualment, sense aquell model).
  let models: FileModel[] | undefined
  if (obj.models !== undefined) {
    const all = Array.isArray(obj.models) ? obj.models : []
    models = all.flatMap((m) => {
      const r = FileModelSchema.safeParse(m)
      return r.success ? [r.data] : []
    })
    if (models.length < all.length || !Array.isArray(obj.models)) warnings.push("Algun model 3D del fitxer està malmès; no es veurà.")
  }
  for (const f of furniture) for (const m of f.moble.models ?? []) if (!(models ??= []).some((x) => x.id === m.id)) models.push(m)

  const render = obj.render === undefined || isRecord(obj.render) ? (obj.render as Record<string, unknown> | undefined) : undefined
  if (obj.render !== undefined && !render) warnings.push("La configuració del render del fitxer està malmesa; es fa servir la de sempre.")

  const res = AmbientFileSchema.safeParse({
    format: AMBIENT_FORMAT,
    version: AMBIENT_VERSION,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "",
    ambient: { name, data },
    furniture,
    ...(models?.length ? { models } : {}),
    ...(render ? { render } : {}),
  })
  if (!res.success) {
    const issue = res.error.issues[0]
    const where = issue ? issue.path.map(String).join(" › ") : ""
    return { ok: false, error: `Aquest fitxer no és un ambient vàlid${where ? ` (${where})` : ""}.` }
  }
  return { ok: true, file: res.data, warnings }
}

/**
 * Materials de l'ambient (terra, parets, sostre, terra de fora, obertures, blocs) i dels seus mobles que no són a les
 * preferències de qui l'obre (amb els àlies), com `missingMaterials` del `.moble`.
 */
export function missingAmbientMaterials(file: AmbientFile, mine: readonly Pick<MaterialPref, "name">[]): string[] {
  return missingMaterials([file.ambient.data, ...file.furniture.map((f) => f.moble.project.composition)], mine)
}

/** Referències dels mobles del fitxer que l'usuari no té, sense repetir (per afegir-les un sol cop). */
export function missingAmbientReferences(file: AmbientFile, mine: readonly RefPreset[]): RefPreset[] {
  const out: RefPreset[] = []
  for (const f of file.furniture) for (const r of f.moble.references) if (!mine.some((m) => sameReference(m, r)) && !out.some((m) => sameReference(m, r))) out.push(r)
  return out
}
