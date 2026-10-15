import { AmbientSchema, CompositionSchema, SettingsSchema, type Ambient, type Composition, type Settings } from "../../core/model"
import { db, renameAmbient, renameProject, updateAmbient } from "../../db/db"
import { updateProjectComposition } from "../../db/compositionStore"
import { saveSettings } from "../../db/settingsStore"
import { currentDoc } from "./assistantHub"
import { DB_TABLES, type DbTable } from "./appToolInputs"
import { setAppSettings, type AppToolHandlers } from "./appToolContext"
import { dbRow, dbSafe, fitResult, getAt, pathParts, setAt } from "./dbPaths"

/** Eines de l'app per a la base de dades directament (el que cap altra eina no fa): taules, llegir i escriure. */

export const dbHandlers: AppToolHandlers<"db_tables" | "db_read" | "db_write"> = {
  db_tables: async ({ doc }) => {
    const tables = await Promise.all(
      DB_TABLES.map(async (t) => {
        const table = db.table(t)
        const first = await table.limit(1).first()
        return { table: t, rows: await table.count(), fields: first ? Object.keys(first) : [], writable: t === "projects" || t === "ambients" || t === "settings" }
      }),
    )
    return { ok: true, doc, result: { tables } }
  },
  db_read: async ({ doc, input }) => {
    const i = input
    const table = db.table(i.table as DbTable)
    if (i.id === undefined) {
      const rows = await table.offset(i.offset ?? 0).limit(i.limit ?? 30).toArray()
      const brief = rows.map((r: Record<string, unknown>) => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(r)) out[k] = v && typeof v === "object" ? (Array.isArray(v) ? `[llista de ${v.length}]` : "{…}") : dbSafe(v)
        return out
      })
      return { ok: true, doc, result: { table: i.table, total: await table.count(), rows: brief } }
    }
    const row = await dbRow(i.table as DbTable, i.id)
    if (!row) return { ok: false, error: `A «${i.table}» no hi ha la fila ${String(i.id)}.` }
    const got = getAt(row, pathParts(i.path ?? ""))
    if (!got.ok) return { ok: false, error: got.error }
    return { ok: true, doc, result: { table: i.table, id: i.id, path: i.path ?? "", value: fitResult(dbSafe(got.value)) } }
  },
  db_write: async ({ doc, input }) => {
    const i = input
    const parts = pathParts(i.path)
    const root = parts[0]
    const allowed = i.table === "projects" ? ["name", "composition"] : i.table === "ambients" ? ["name", "data"] : ["data"]
    if (!root || !allowed.includes(root)) return { ok: false, error: `A «${i.table}» només es pot canviar ${allowed.map((a) => `«${a}…»`).join(" o ")}.` }
    if (parts.includes("apiKey")) return { ok: false, error: "La clau de l'API només es canvia a Preferències › Assistent IA." }
    const row = await dbRow(i.table, i.id)
    if (!row) return { ok: false, error: `A «${i.table}» no hi ha la fila ${String(i.id)}.` }
    const before = getAt(row, parts)
    let next: Record<string, unknown>
    try {
      next = setAt(row, parts, i.value) as Record<string, unknown>
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    const open = currentDoc()
    const rowId = row.id as number | string
    const isOpen = !!open && ((i.table === "projects" && open.kind !== "ambient" && open.id === rowId) || (i.table === "ambients" && open.kind === "ambient" && open.id === rowId))
    // Validat amb l'esquema de l'app abans de res.
    if (root === "composition") {
      const ok = CompositionSchema.safeParse(next.composition)
      if (!ok.success) return { ok: false, error: `No és vàlid: ${ok.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}` }
      next.composition = ok.data
    } else if (root === "data" && i.table === "ambients") {
      const ok = AmbientSchema.safeParse(next.data)
      if (!ok.success) return { ok: false, error: `No és vàlid: ${ok.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}` }
      next.data = ok.data
    } else if (root === "data") {
      const ok = SettingsSchema.safeParse(next.data)
      if (!ok.success) return { ok: false, error: `No és vàlid: ${ok.error.issues.slice(0, 3).map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}` }
      next.data = ok.data
    } else if (typeof i.value !== "string" || !i.value.trim()) return { ok: false, error: "El nom ha de ser un text." }
    const preview = { table: i.table, id: i.id, path: i.path, before: before.ok ? fitResult(dbSafe(before.value)) : "(no hi era)", after: fitResult(dbSafe(i.value)), undoable: isOpen && root !== "name" }
    // Al document obert, com un canvi de l'editor (es desfà amb ⌘Z): no cal confirmació.
    if (isOpen && root !== "name") return { ok: true, doc: (root === "composition" ? next.composition : next.data) as never, result: { ...preview, written: true } }
    if (!i.confirmed) return { ok: false, error: `Encara no s'ha desat: no es pot desfer. Ensenya-ho a l'usuari i torna-ho a cridar amb confirmed: true quan ho accepti. ${JSON.stringify(preview).slice(0, 4000)}` }
    if (root === "name") await (i.table === "projects" ? renameProject(Number(rowId), String(i.value)) : renameAmbient(Number(rowId), String(i.value)))
    else if (root === "composition") {
      if (!(await updateProjectComposition(Number(rowId), next.composition as Composition))) return { ok: false, error: "No s'ha pogut desar." }
    } else if (i.table === "ambients") await updateAmbient(Number(rowId), { data: next.data as Ambient })
    else {
      if (!(await saveSettings(next.data as Settings))) return { ok: false, error: "Les preferències són d'una versió més nova de l'app: només es poden llegir." }
      setAppSettings(next.data as Settings)
    }
    return { ok: true, doc, result: { ...preview, written: true } }
  },
}
