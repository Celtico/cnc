import { EMPTY_AMBIENT, type Ambient } from "../../core/model"
import { uniqueName } from "../../core/file/mobleFile"
import { createAmbient, createProject, db, deleteAmbient, deleteProject, duplicateAmbient, duplicateProject, renameAmbient, renameProject, setAmbientsFolder, setProjectsFolder } from "../../db/db"
import { isObject } from "../objects/isObject"
import { blankMoble, blankObject } from "../projects/blank"
import { currentDoc, waitForDoc } from "./assistantHub"
import { appContext, fold, type AppToolHandlers } from "./appToolContext"

/** Eines de l'app per als documents: on som, buscar, obrir, crear, reanomenar, duplicar, agrupar i esborrar; anar a una pàgina. */

export const documentHandlers: AppToolHandlers<"get_app" | "list_documents" | "open_document" | "create_document" | "rename_document" | "duplicate_document" | "move_to_group" | "delete_document" | "go_to"> = {
  get_app: ({ doc }) => ({ ok: true, doc, result: appContext() }),
  list_documents: async ({ doc, input }) => {
    const { kind, query } = input
    const q = query ? fold(query) : ""
    if (kind === "ambient") {
      const rows = (await db.ambients.toArray()).filter((a) => !q || fold(a.name).includes(q)).sort((a, b) => b.updatedAt - a.updatedAt)
      return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((a) => ({ id: a.id, name: a.name, folder: a.folder ?? null, updated: new Date(a.updatedAt).toISOString().slice(0, 10) })) } }
    }
    const rows = (await db.projects.toArray()).filter((r) => !r.draft && isObject(r) === (kind === "objecte") && (!q || fold(r.name).includes(q))).sort((a, b) => b.updatedAt - a.updatedAt)
    return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((r) => ({ id: r.id, name: r.name, folder: r.folder ?? null, updated: new Date(r.updatedAt).toISOString().slice(0, 10) })) } }
  },
  open_document: async ({ doc, input, nav }) => {
    const { kind, id } = input
    if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
    if (kind === "ambient") {
      const a = await db.ambients.get(id)
      if (!a) return { ok: false, error: `No hi ha cap ambient amb l'id ${id}. Fes servir list_documents.` }
      nav.openAmbient(id)
      const d = await waitForDoc(`ambient:${id}`)
      return { ok: true, doc, result: { opened: { kind, id, name: a.name }, ready: !!d } }
    }
    const r = await db.projects.get(id)
    if (!r || isObject(r) !== (kind === "objecte")) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}. Fes servir list_documents.` }
    nav.openMoble(id)
    const d = await waitForDoc(`${kind}:${id}`)
    return { ok: true, doc, result: { opened: { kind, id, name: r.name }, ready: !!d } }
  },
  create_document: async ({ doc, input, nav }) => {
    const { kind, name: wanted } = input
    if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
    if (kind === "ambient") {
      const names = (await db.ambients.toArray()).map((a) => a.name)
      const name = uniqueName(wanted?.trim() || "Ambient nou", names)
      const data: Ambient = { ...EMPTY_AMBIENT }
      const id = await createAmbient(name, data)
      nav.openAmbient(id)
      const d = await waitForDoc(`ambient:${id}`)
      return { ok: true, doc, result: { created: { kind, id, name }, ready: !!d } }
    }
    const names = (await db.projects.toArray()).map((r) => r.name)
    const name = uniqueName(wanted?.trim() || (kind === "objecte" ? "Objecte nou" : "Moble nou"), names)
    // No és esborrany: l'ha creat l'assistent a petició de l'usuari (es queda a l'Historial).
    const id = await createProject(name, undefined, { composition: kind === "objecte" ? blankObject() : blankMoble("moble") })
    nav.openMoble(id)
    const d = await waitForDoc(`${kind}:${id}`)
    return { ok: true, doc, result: { created: { kind, id, name }, ready: !!d } }
  },
  rename_document: async ({ doc, input }) => {
    const { kind, id, name: nm } = input
    const row = kind === "ambient" ? await db.ambients.get(id) : await db.projects.get(id)
    if (!row) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
    if (kind === "ambient") await renameAmbient(id, nm.trim())
    else await renameProject(id, nm.trim())
    return { ok: true, doc, result: { kind, id, from: row.name, name: nm.trim() } }
  },
  duplicate_document: async ({ doc, input }) => {
    const { kind, id } = input
    const copy = kind === "ambient" ? await duplicateAmbient(id) : await duplicateProject(id)
    if (copy === undefined) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
    const row = kind === "ambient" ? await db.ambients.get(copy) : await db.projects.get(copy)
    return { ok: true, doc, result: { kind, copy: { id: copy, name: row?.name } } }
  },
  move_to_group: async ({ doc, input }) => {
    const { kind, ids, group } = input
    const folder = group?.trim() || undefined
    if (kind === "ambient") await setAmbientsFolder(ids, folder)
    else await setProjectsFolder(ids, folder)
    return { ok: true, doc, result: { kind, ids, group: folder ?? null } }
  },
  delete_document: async ({ doc, input, nav }) => {
    const { kind, id, confirmed } = input
    if (!confirmed) return { ok: false, error: "Abans d'esborrar, pregunta-ho a l'usuari i espera que digui que sí." }
    const row = kind === "ambient" ? await db.ambients.get(id) : await db.projects.get(id)
    if (!row) return { ok: false, error: `No hi ha cap ${kind} amb l'id ${id}.` }
    if (kind !== "ambient") {
      // Com «Esborrar» de les galeries: els que són en algun ambient es conserven.
      const used = (await db.ambients.toArray()).filter((a) => ((a.data as { items?: { kind?: string; projectId?: number }[] })?.items ?? []).some((i) => i.kind === "moble" && i.projectId === id))
      if (used.length) return { ok: false, error: `«${row.name}» és a ${used.length === 1 ? "l'ambient" : "els ambients"} ${used.map((a) => `«${a.name}»`).join(", ")}: no s'esborra (treu-lo primer de l'ambient).` }
    }
    // El document obert: primer se surt a la llista.
    const open = currentDoc()
    if (open && open.id === id && (open.kind === "ambient") === (kind === "ambient")) nav?.goTo(kind === "ambient" ? "ambients" : kind === "objecte" ? "objectes" : "mobles")
    if (kind === "ambient") await deleteAmbient(id)
    else await deleteProject(id)
    return { ok: true, doc, result: { kind, deleted: { id, name: row.name } } }
  },
  go_to: ({ doc, input, nav }) => {
    const { place } = input
    if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
    if (!nav.goTo(place)) return { ok: false, error: `No es pot anar a «${place}» ara (les pàgines editor, peces, nesting i exportar necessiten un moble obert; un objecte només té l'editor).` }
    return { ok: true, doc, result: { at: place } }
  },
}
