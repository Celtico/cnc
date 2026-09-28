import { z } from "zod"
import { CompositionSchema, RefPresetSchema, type Composition, type RefPreset } from "../model"
import { NestOptionsSchema, type NestOptions } from "../nesting/nest"

/**
 * Format de fitxer `.moble`: JSON llegible i versionat amb el moble sencer (composició,
 * nesting, calibratge de la foto), les referències que fa servir i, opcionalment, la
 * foto en base64. Sense Dexie ni DOM: les conversions Blob ↔ base64 es fan a `features/`.
 */

export const MOBLE_FORMAT = "mobles-cnc"
export const MOBLE_VERSION = 1

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
  applied: z.array(z.object({ measureId: z.string(), target: z.string(), label: z.string() })).optional(),
  opacity: mm.optional(),
  layer: z.enum(["photo", "cabinet", "both"]).optional(),
  plane: z.enum(["wall", "floor"]),
  focal35: mm,
  origin: Pt.optional(),
  originMm: z.tuple([mm, mm, mm]).optional(),
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

export const MobleFileSchema = z.object({
  format: z.literal(MOBLE_FORMAT),
  version: z.literal(MOBLE_VERSION),
  exportedAt: z.string(),
  project: z.object({
    name: z.string(),
    composition: CompositionSchema,
    nesting: NestOptionsSchema.optional(),
    photo: FileCalibrationSchema.optional(),
  }),
  references: z.array(RefPresetSchema),
  photo: FilePhotoSchema.optional(),
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
  exportedAt?: string
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

export function buildMobleFile(input: MobleInput): MobleFile {
  return {
    format: MOBLE_FORMAT,
    version: MOBLE_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    project: {
      name: input.name,
      composition: input.composition,
      ...(input.nesting ? { nesting: input.nesting } : {}),
      ...(input.calibration ? { photo: input.calibration } : {}),
    },
    references: usedReferences(input),
    ...(input.photo ? { photo: input.photo } : {}),
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

/** Migracions per versió: cada pas puja una versió. (Encara no n'hi ha cap: v1 és l'actual.) */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {}

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
  for (let i = 2; ; i++) {
    const candidate = `${name} (${i})`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

/** Referències del fitxer que l'usuari no té (per afegir-les sense duplicar). */
export function missingReferences(file: MobleFile, mine: RefPreset[]): RefPreset[] {
  return file.references.filter((r) => !mine.some((m) => sameReference(m, r)))
}
