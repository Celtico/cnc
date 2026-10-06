import { z } from "zod"

/**
 * Reparació de dades desades contra un esquema zod, **camp a camp**: el que és vàlid es queda i només es
 * canvia el que no ho és. Serveix per no perdre un moble sencer (o una secció sencera de preferències) per un
 * sol valor dolent.
 */

/** Avís d'una reparació: `path` = on (`modules[0].carcass.width`), `what` = què s'ha fet (en català). */
export type RepairIssue = (path: string, what: string) => void

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

const join = (path: string, key: string | number) => (typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key)

/**
 * Repara `raw` contra `schema`:
 * - si ja és vàlid, el retorna tal com el deixa zod;
 * - objecte: cada camp es repara pel seu compte; el que no es pot reparar agafa el de `fallback` (o es treu si
 *   és opcional);
 * - llista: cada element es repara pel seu compte (sense valor per defecte) i els que no es poden reparar es
 *   treuen;
 * - la resta (unions, números, textos…): el de `fallback`.
 *
 * Retorna `undefined` si no es pot reparar i no hi ha `fallback`. Mai llança.
 */
export function repairValue<T>(schema: z.ZodType<T>, raw: unknown, fallback: T | undefined, onIssue: RepairIssue, path = ""): T | undefined {
  const whole = schema.safeParse(raw)
  if (whole.success) return whole.data
  const out = repairInner(schema as z.ZodType, raw, fallback, onIssue, path)
  if (out === undefined) return undefined
  const again = schema.safeParse(out)
  if (again.success) return again.data
  if (fallback !== undefined) onIssue(path, "invàlid: valor inicial")
  return fallback
}

function repairInner(schema: z.ZodType, raw: unknown, fallback: unknown, onIssue: RepairIssue, path: string): unknown {
  if (schema instanceof z.ZodOptional) {
    if (raw === undefined) return undefined
    const inner = repairValue(schema.unwrap() as z.ZodType, raw, fallback, onIssue, path)
    if (inner === undefined) onIssue(path, "invàlid: tret")
    return inner
  }
  if (schema instanceof z.ZodLazy) return repairValue(schema.unwrap() as z.ZodType, raw, fallback, onIssue, path)
  // `z.preprocess` (migració en llegir, p. ex. els ferratges d'abans d'un mòdul): primer la migració i després es repara
  // el resultat camp a camp contra l'esquema de sortida.
  if (schema instanceof z.ZodPipe && schema.in instanceof z.ZodTransform) {
    const pre = (schema.in as z.ZodType).safeParse(raw)
    return repairValue(schema.out as z.ZodType, pre.success ? pre.data : raw, fallback, onIssue, path)
  }
  if (schema instanceof z.ZodObject && isRecord(raw)) {
    const shape = schema.shape as Record<string, z.ZodType>
    const fb = isRecord(fallback) ? fallback : {}
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(shape)) {
      const sub = shape[key]!
      const v = repairValue(sub, raw[key], fb[key], onIssue, join(path, key))
      if (v !== undefined) out[key] = v
      else if (raw[key] !== undefined && !(sub instanceof z.ZodOptional)) onIssue(join(path, key), "invàlid")
    }
    return out
  }
  if (schema instanceof z.ZodArray && Array.isArray(raw)) {
    const element = schema.element as z.ZodType
    const out: unknown[] = []
    raw.forEach((item, i) => {
      const v = repairValue(element, item, undefined, onIssue, join(path, i))
      if (v !== undefined) out.push(v)
      else onIssue(join(path, i), "invàlid: descartat")
    })
    return out
  }
  if (fallback !== undefined && raw !== undefined) onIssue(path, "invàlid: valor inicial")
  return fallback
}
