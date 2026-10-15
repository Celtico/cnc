import { db } from "../../db/db"
import type { DbTable } from "./appToolInputs"

/** Llegir i escriure la base de dades des de les eines de l'app (`db_read`, `db_write`): files, camins i resultats segurs. */

/** Treu les imatges, els fitxers i la clau de l'API d'un valor llegit de la base de dades (el model només veu dades). */
export function dbSafe(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.startsWith("data:") && v.length > 200 ? `[binari ${Math.round(v.length / 1365)} KB]` : v.length > 2000 ? `${v.slice(0, 2000)}… [${v.length} caràcters]` : v
  if (v instanceof Blob) return `[binari ${Math.round(v.size / 1024)} KB]`
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return `[binari ${Math.round((v as ArrayBuffer).byteLength / 1024)} KB]`
  if (!v || typeof v !== "object") return v
  if (depth > 40) return "[…]"
  if (Array.isArray(v)) return v.map((x) => dbSafe(x, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) if (k !== "apiKey") out[k] = dbSafe(x, depth + 1)
  return out
}

/** Una fila per id: «208» i 208 són la mateixa (els mobles i ambients tenen ids numèrics; les preferències, de text). */
export async function dbRow(table: DbTable, id: number | string): Promise<Record<string, unknown> | undefined> {
  const t = db.table(table)
  const asNum = typeof id === "string" && /^\d+$/.test(id.trim()) ? Number(id) : id
  return ((await t.get(asNum)) ?? (asNum !== id ? undefined : await t.get(String(id)))) as Record<string, unknown> | undefined
}

/** Segments d'un camí «a.b.0.#id». */
export const pathParts = (path: string) => path.split(".").filter(Boolean)

export function getAt(root: unknown, parts: string[]): { ok: true; value: unknown } | { ok: false; error: string } {
  let cur = root
  for (const [i, seg] of parts.entries()) {
    if (cur == null || typeof cur !== "object") return { ok: false, error: `«${parts.slice(0, i).join(".")}» no té «${seg}».` }
    if (seg.startsWith("#") && Array.isArray(cur)) cur = cur.find((x) => (x as { id?: unknown })?.id === seg.slice(1))
    else cur = (cur as Record<string, unknown>)[seg]
    if (cur === undefined) return { ok: false, error: `No hi ha «${parts.slice(0, i + 1).join(".")}».` }
  }
  return { ok: true, value: cur }
}

/** Còpia de `root` amb `value` a `parts` (null treu el camp; d'una llista, l'element). */
export function setAt(root: unknown, parts: string[], value: unknown): unknown {
  if (!parts.length) return value
  const [seg, ...rest] = parts as [string, ...string[]]
  if (Array.isArray(root)) {
    const i = seg.startsWith("#") ? root.findIndex((x) => (x as { id?: unknown })?.id === seg.slice(1)) : Number(seg)
    if (!Number.isInteger(i) || i < 0 || i > root.length) throw new Error(`«${seg}» no és un element de la llista.`)
    const next = [...root]
    if (!rest.length && value === null) next.splice(i, 1)
    else next[i] = setAt(root[i], rest, value)
    return next
  }
  const obj: Record<string, unknown> = root && typeof root === "object" ? { ...(root as Record<string, unknown>) } : {}
  if (!rest.length && value === null) delete obj[seg]
  else obj[seg] = setAt(obj[seg], rest, value)
  return obj
}

/** Un resultat que cap a la conversa (no més de ~40.000 caràcters). */
export function fitResult(v: unknown): unknown {
  const text = JSON.stringify(v)
  if (text.length <= 40000) return v
  if (v && typeof v === "object" && !Array.isArray(v)) return { truncated: true, keys: Object.keys(v), note: "Massa gran: demana un camí més concret (path)." }
  if (Array.isArray(v)) return { truncated: true, length: v.length, note: "Massa gran: demana un camí més concret (path), o offset/limit." }
  return `${text.slice(0, 40000)}…`
}
