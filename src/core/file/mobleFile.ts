import { z } from "zod"
import { CompositionSchema, materialRefNames, usesHardwarePlacements, usesImportedHardware, migrateFlatPack, migrateRuns, RefPresetSchema, repairComposition, repairValue, resolveMaterialAlias, type Composition, type MaterialPref, type RefPreset } from "../model"
import { NestOptionsSchema, type NestOptions } from "../nesting/nest"

/**
 * Format de fitxer `.moble`: JSON llegible i versionat amb el moble sencer (composició,
 * nesting, calibratge de la foto), les referències que fa servir i, opcionalment, la
 * foto en base64. Sense Dexie ni DOM: les conversions Blob ↔ base64 es fan a `features/`.
 */

export const MOBLE_FORMAT = "mobles-cnc"
/**
 * La versió més nova que llegeix l'app. **v2** = porta ferratges importats (`HardwareItem.imported`): una app d'abans
 * (que només llegeix la v1) els trauria en silenci i la frontissa pendent foradaria; amb la v2, la rebutja («Fitxer d'una
 * versió més nova»). Un moble sense importats es desa com a **v1** (`MOBLE_BASE_VERSION`) i el poden obrir les d'abans.
 */
export const MOBLE_VERSION = 3
export const MOBLE_BASE_VERSION = 1
/** v2: porta ferratges importats (i cap col·locat a mà). */
export const MOBLE_IMPORTED_VERSION = 2
/**
 * **v3** = porta ferratges col·locats a mà (`Composition.hardwarePlacements`, generador de mecanitzats): una app d'abans
 * els trauria en silenci (el moble sortiria sense les ranures i forats del ferratge); amb la v3, el rebutja.
 */
export const MOBLE_PLACEMENTS_VERSION = 3

/** La versió amb què es desa una composició: la més baixa que la llegeix sencera. */
export function mobleVersionFor(composition: unknown): 1 | 2 | 3 {
  if (usesHardwarePlacements(composition)) return MOBLE_PLACEMENTS_VERSION
  return usesImportedHardware(composition) ? MOBLE_IMPORTED_VERSION : MOBLE_BASE_VERSION
}

const mm = z.number().finite()
const Pt = z.tuple([mm, mm])

/** Calibratge de la foto (mateixos camps que `PhotoCalibration` de la base de dades, sense l'id de la foto). */
const MeasureSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["distance", "rect"]),
  points: z.array(Pt),
  tape: mm.nullable().optional(),
})

export const FileCalibrationSchema = z.object({
  points: z.array(Pt),
  ref: z.object({ w: mm.nullable(), h: mm.nullable() }),
  refAspect: mm.nullable().optional(),
  measures: z.array(MeasureSchema).optional(),
  floorLine: z.tuple([Pt, Pt]).optional(),
  applied: z.array(z.object({ measureId: z.string(), target: z.string(), label: z.string(), which: z.enum(["main", "second"]).optional() })).optional(),
  opacity: mm.optional(),
  layer: z.enum(["photo", "cabinet", "both"]).optional(),
  /** Aspecte del moble sobre la foto: línies (SVG) o realista (three.js). */
  render: z.enum(["lines", "realistic"]).optional(),
  /** Ombres del moble realista sobre la foto. */
  shadows: z.boolean().optional(),
  plane: z.enum(["wall", "floor"]),
  focal35: mm,
  origin: Pt.optional(),
  originMm: z.tuple([mm, mm, mm]).optional(),
  originScale: mm.optional(),
  offset: Pt,
  offsetZ: mm.optional(),
  refWallOffset: mm.optional(),
})
export type FileCalibration = z.infer<typeof FileCalibrationSchema>

export const FilePhotoSchema = z.object({
  mime: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  exifFocal35: mm.nullable(),
  /** Bytes de la imatge en base64 (sense prefix `data:`). */
  data: z.string(),
})
export type FilePhoto = z.infer<typeof FilePhotoSchema>

/** Model 3D de l'usuari (`.glb`) que fa servir el moble, perquè s'obri igual en un altre aparell. */
export const FileModelSchema = z.object({
  /** El mateix id que `ModelObject.src` ("user-…"). */
  id: z.string().min(1),
  name: z.string(),
  /** Mida real (mm: w, h, d). */
  size: z.tuple([mm, mm, mm]),
  mime: z.string().optional(),
  /** Bytes del `.glb` en base64 (sense prefix `data:`). */
  data: z.string(),
})
export type FileModel = z.infer<typeof FileModelSchema>

export const MobleFileSchema = z.object({
  format: z.literal(MOBLE_FORMAT),
  version: z.union([z.literal(MOBLE_BASE_VERSION), z.literal(MOBLE_IMPORTED_VERSION), z.literal(MOBLE_PLACEMENTS_VERSION)]),
  exportedAt: z.string(),
  /** "plantilla" si s'ha exportat des de les plantilles; en obrir-lo es proposa afegir-lo com a plantilla. */
  kind: z.enum(["moble", "plantilla"]).optional(),
  project: z.object({
    name: z.string(),
    composition: CompositionSchema,
    nesting: NestOptionsSchema.optional(),
    photo: FileCalibrationSchema.optional(),
  }),
  references: z.array(RefPresetSchema),
  photo: FilePhotoSchema.optional(),
  /** Opcional (fitxers antics no en porten): els models 3D de l'usuari que fa servir. */
  models: z.array(FileModelSchema).optional(),
})
export type MobleFile = z.infer<typeof MobleFileSchema>

export interface MobleInput {
  name: string
  composition: Composition
  nesting?: NestOptions
  calibration?: FileCalibration
  /** Totes les referències de l'usuari: només s'inclouen les que el moble fa servir. */
  references: RefPreset[]
  photo?: FilePhoto
  /** Models 3D de l'usuari: només s'inclouen els que la composició fa servir. */
  models?: FileModel[]
  exportedAt?: string
  kind?: "moble" | "plantilla"
}

/** Una referència "és la mateixa" si coincideixen nom i mides. */
export function sameReference(a: Pick<RefPreset, "name" | "w" | "h" | "d">, b: Pick<RefPreset, "name" | "w" | "h" | "d">): boolean {
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && a.w === b.w && a.h === b.h && (a.d ?? null) === (b.d ?? null)
}

/** Referències que el moble fa servir: objectes fantasma amb mides iguals i la referència del calibratge. */
export function usedReferences(input: Pick<MobleInput, "composition" | "calibration" | "references">): RefPreset[] {
  const out: RefPreset[] = []
  for (const r of input.references) {
    const asGhost = input.composition.references.some((g) => g.w === r.w && g.h === r.h && g.d === r.d)
    const asCalibration = !!input.calibration && input.calibration.ref.w === r.w && input.calibration.ref.h === r.h
    if ((asGhost || asCalibration) && !out.some((x) => sameReference(x, r))) out.push({ ...r, builtin: undefined, hidden: undefined })
  }
  return out
}

/** Ids dels models de l'usuari ("user-…") que fa servir la composició. */
export function usedUserModelIds(composition: Pick<Composition, "models">): string[] {
  return [...new Set((composition.models ?? []).map((m) => m.src).filter((src) => src.startsWith("user-")))]
}

export function buildMobleFile(input: MobleInput): MobleFile {
  const used = new Set(usedUserModelIds(input.composition))
  const models = (input.models ?? []).filter((m) => used.has(m.id))
  return {
    format: MOBLE_FORMAT,
    // Només els que porten ferratges importats (v2) o col·locats a mà (v3) pugen de versió (les apps d'abans no els han d'obrir).
    version: mobleVersionFor(input.composition),
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    ...(input.kind === "plantilla" ? { kind: "plantilla" as const } : {}),
    project: {
      name: input.name,
      composition: input.composition,
      ...(input.nesting ? { nesting: input.nesting } : {}),
      ...(input.calibration ? { photo: input.calibration } : {}),
    },
    references: usedReferences(input),
    ...(input.photo ? { photo: input.photo } : {}),
    ...(models.length ? { models } : {}),
  }
}

export function mobleToJson(file: MobleFile): string {
  return JSON.stringify(file, null, 2)
}

/** Nom de fitxer segur: `<nom del moble>.moble`. */
export function mobleFileName(name: string): string {
  const safe = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
  return `${safe || "moble"}.moble`
}

export type MobleParse =
  | { ok: true; file: MobleFile; warnings: string[] }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Migracions per versió: cada pas puja una versió. v1 → v2 (ferratges importats) i v2 → v3 (ferratges col·locats a mà)
 * són additius: res a fer.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = { 1: (raw) => raw, 2: (raw) => raw }

/** Llegeix un `.moble`: valida, migra si és d'una versió anterior. Errors en català. */
export function parseMobleFile(text: string): MobleParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: "Aquest fitxer no és un moble (no és un JSON vàlid)." }
  }
  if (!isRecord(raw) || raw.format !== MOBLE_FORMAT) return { ok: false, error: "Aquest fitxer no és un moble." }
  let version = typeof raw.version === "number" ? raw.version : 0
  if (version > MOBLE_VERSION) return { ok: false, error: "Fitxer d'una versió més nova de l'app: actualitza-la." }
  let obj: Record<string, unknown> = raw
  while (version < MOBLE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) return { ok: false, error: `No es pot migrar un moble de la versió ${version}.` }
    obj = step(obj)
    version += 1
  }
  obj = { ...obj, version: MOBLE_VERSION }

  const warnings: string[] = []
  // La foto pot estar malmesa sense que el moble ho estigui: es llegeix a part.
  const photoRes = obj.photo === undefined ? undefined : FilePhotoSchema.safeParse(obj.photo)
  if (photoRes && !photoRes.success) {
    warnings.push("La foto del fitxer està malmesa; s'ha obert sense foto.")
    obj = { ...obj, photo: undefined }
  }
  // Igual amb els models 3D: el que estigui malmès es treu i el moble s'obre igualment.
  if (obj.models !== undefined) {
    const list = Array.isArray(obj.models) ? obj.models : []
    const good = list.filter((m) => FileModelSchema.safeParse(m).success)
    if (good.length < list.length || !Array.isArray(obj.models)) warnings.push("Algun model 3D del fitxer està malmès; no es veurà.")
    obj = { ...obj, models: good.length ? good : undefined }
  }
  // Extres opcionals del projecte i referències: el que estigui malmès es treu amb un avís (no tot el fitxer).
  if (isRecord(obj.project)) {
    let project: Record<string, unknown> = obj.project
    if (project.nesting !== undefined && !NestOptionsSchema.safeParse(project.nesting).success) {
      warnings.push("Les opcions de nesting del fitxer estan malmeses; es fan servir les de les preferències.")
      project = { ...project, nesting: undefined }
    }
    if (project.photo !== undefined && !FileCalibrationSchema.safeParse(project.photo).success) {
      const fixed = repairValue(FileCalibrationSchema, project.photo, undefined, () => {})
      warnings.push(fixed ? "El calibratge de la foto tenia valors malmesos; s'han tret." : "El calibratge de la foto està malmès; s'ha obert sense calibratge.")
      project = { ...project, photo: fixed }
    }
    // La composició, element a element (com en llegir-la de la base de dades).
    if (project.composition !== undefined) {
      const rep = repairComposition(project.composition)
      if (!rep.composition) return { ok: false, error: `Aquest fitxer no és un moble vàlid (composició: ${rep.problems.at(-1) ?? "invàlida"}).` }
      if (rep.problems.length) warnings.push(`S'han tret dades malmeses del moble: ${rep.problems.join(" ")}`)
      // Migracions que no depenen de les preferències (Flat-pack com a opció de les peces, taulell i sòcol a tot arreu).
      project = { ...project, composition: migrateRuns(migrateFlatPack(rep.composition)) }
    }
    obj = { ...obj, project }
  }
  if (Array.isArray(obj.references)) {
    const good = obj.references.filter((r) => RefPresetSchema.safeParse(r).success)
    if (good.length < obj.references.length) warnings.push("Algun objecte de referència del fitxer està malmès; no s'ha afegit.")
    obj = { ...obj, references: good }
  }
  const res = MobleFileSchema.safeParse(obj)
  if (!res.success) {
    const issue = res.error.issues[0]
    const where = issue ? issue.path.map(String).join(" › ") : ""
    return { ok: false, error: `Aquest fitxer no és un moble vàlid${where ? ` (${where})` : ""}.` }
  }
  return { ok: true, file: res.data, warnings }
}

/** Nom únic entre els existents: "Nom", "Nom (2)", "Nom (3)"... */
export function uniqueName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  if (!taken.has(name.trim().toLowerCase())) return name
  // «Moble (3)» que es torna a obrir → «Moble (4)», no «Moble (3) (2)».
  const m = /^(.*\S) \((\d+)\)$/.exec(name.trim())
  const base = m ? m[1]! : name.trim()
  for (let i = m ? Number(m[2]) + 1 : 2; ; i++) {
    const candidate = `${base} (${i})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** Referències del fitxer que l'usuari no té (per afegir-les sense duplicar). */
export function missingReferences(file: MobleFile, mine: RefPreset[]): RefPreset[] {
  return file.references.filter((r) => !mine.some((m) => sameReference(m, r)))
}

/**
 * Materials que fa servir la composició d'un `.moble` (cos, fronts, fons, peces lliures, taulell i sòcol, objectes de
 * referència i terra/paret de l'escena) i que no són a les preferències de qui l'obre (amb els àlies resolts amb els
 * seus materials, `resolveMaterialAlias`). El `.moble` no porta preferències: els forats, ferratges, l'aspecte dels
 * materials i la màquina són de qui l'obre; un material que no hi és es veu amb un color per defecte i al taller surt amb
 * aquest nom.
 */
export function missingMaterials(composition: Composition, mine: readonly Pick<MaterialPref, "name">[]): string[] {
  const names = new Set(mine.map((m) => m.name))
  const out = new Set<string>()
  for (const n of materialRefNames(composition)) {
    const r = resolveMaterialAlias(n, names)
    if (!names.has(r)) out.add(r)
  }
  return [...out]
}

/** Avís (en català) dels materials que falten en obrir un `.moble` (`missingMaterials`); `undefined` si no en falta cap. */
export function missingMaterialsWarning(names: readonly string[]): string | undefined {
  if (!names.length) return undefined
  return `Materials que no tens a Preferències: ${names.join(", ")}; es veuran amb un color per defecte i al taller sortiran amb aquest nom. Afegeix-los a Preferències › Materials.`
}
