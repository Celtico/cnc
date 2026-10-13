import { z } from "zod"
import { EMPTY_AMBIENT, type Ambient } from "../../core/model"
import { uniqueName } from "../../core/file/mobleFile"
import { parseToolInput, toolDefs, toolFailure, type AssistantToolSet, type ToolInputs, type ToolRun } from "../../core/assistant/toolset"
import { createAmbient, createProject, db } from "../../db/db"
import { isObject } from "../objects/isObject"
import { blankMoble, blankObject } from "../projects/blank"
import { currentDoc, currentNav, waitForDoc } from "./assistantHub"

/**
 * Eines de l'**app** de l'assistent personal (`assistantHub.ts`): on som, buscar, obrir i crear mobles, objectes i
 * ambients, i anar a una pàgina. No toquen el document obert (en tornen el mateix): el canvi és de pàgina. Les del document
 * obert (moble, objecte, ambient) s'hi afegeixen (`withAppTools`).
 */

const KIND = z.enum(["moble", "objecte", "ambient"]).describe("moble = moble per fabricar; objecte = decoratiu per als ambients; ambient = habitació")

const INPUTS = {
  get_app: z.object({}).describe("On és l'usuari: l'apartat, la pàgina, el document obert (tipus, id i nom) i què hi té seleccionat. Crida-la al començament si no ho saps."),
  list_documents: z
    .object({ kind: KIND, query: z.string().optional().describe("Text per buscar al nom (sense accents ni majúscules)") })
    .describe("Llista els mobles, objectes o ambients desats (id, nom, grup i data), els més recents primer, com a molt 40."),
  open_document: z.object({ kind: KIND, id: z.number().int() }).describe("Obre un moble, objecte o ambient (com tocar-ne la targeta). Les seves eines ja es poden fer servir a la volta següent."),
  create_document: z
    .object({ kind: KIND, name: z.string().optional().describe("Nom (si ja n'hi ha un d'igual, s'hi afegeix un número)") })
    .describe("Crea un moble, objecte o ambient en blanc (com «+ Nou moble») i l'obre."),
  go_to: z
    .object({ place: z.enum(["mobles", "ambients", "objectes", "preferencies", "editor", "peces", "nesting", "exportar"]) })
    .describe("Va a un apartat (mobles, ambients, objectes, preferencies) o a una pàgina del moble obert (editor, peces, nesting, exportar)."),
} satisfies ToolInputs

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca")

/** On som (per a `get_app` i per al context de cada missatge). */
export function appContext(): Record<string, unknown> {
  const nav = currentNav()
  const doc = currentDoc()
  return {
    ...(nav ? nav.where() : {}),
    document: doc ? { kind: doc.kind, id: doc.id, name: doc.name } : null,
    selection: doc?.selection() ?? null,
  }
}

/** El context en una línia per posar davant del missatge de l'usuari. */
export function contextLine(): string {
  const c = appContext()
  const doc = c.document as { kind: string; id: number; name: string } | null
  const parts = [`apartat ${c.section ?? "?"}, pàgina ${c.page ?? "?"}`, doc ? `${doc.kind} obert «${doc.name}» (id ${doc.id})` : "cap document obert", c.selection ? `seleccionat: ${c.selection}` : "res seleccionat"]
  return `[Context de l'app: ${parts.join("; ")}]`
}

async function run(doc: unknown, name: string, raw: unknown): Promise<ToolRun<unknown>> {
  const p = parseToolInput(INPUTS, name, raw)
  if (!p.ok) return p
  const nav = currentNav()
  try {
    switch (name) {
      case "get_app":
        return { ok: true, doc, result: appContext() }
      case "list_documents": {
        const { kind, query } = p.data as z.infer<typeof INPUTS.list_documents>
        const q = query ? fold(query) : ""
        if (kind === "ambient") {
          const rows = (await db.ambients.toArray()).filter((a) => !q || fold(a.name).includes(q)).sort((a, b) => b.updatedAt - a.updatedAt)
          return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((a) => ({ id: a.id, name: a.name, folder: a.folder ?? null, updated: new Date(a.updatedAt).toISOString().slice(0, 10) })) } }
        }
        const rows = (await db.projects.toArray()).filter((r) => !r.draft && isObject(r) === (kind === "objecte") && (!q || fold(r.name).includes(q))).sort((a, b) => b.updatedAt - a.updatedAt)
        return { ok: true, doc, result: { kind, count: rows.length, items: rows.slice(0, 40).map((r) => ({ id: r.id, name: r.name, folder: r.folder ?? null, updated: new Date(r.updatedAt).toISOString().slice(0, 10) })) } }
      }
      case "open_document": {
        const { kind, id } = p.data as z.infer<typeof INPUTS.open_document>
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
      }
      case "create_document": {
        const { kind, name: wanted } = p.data as z.infer<typeof INPUTS.create_document>
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
      }
      case "go_to": {
        const { place } = p.data as z.infer<typeof INPUTS.go_to>
        if (!nav) return { ok: false, error: "L'app encara no és a punt per navegar." }
        if (!nav.goTo(place)) return { ok: false, error: `No es pot anar a «${place}» ara (les pàgines editor, peces, nesting i exportar necessiten un moble obert; un objecte només té l'editor).` }
        return { ok: true, doc, result: { at: place } }
      }
    }
    return { ok: false, error: `Eina desconeguda «${name}».` }
  } catch (e) {
    return toolFailure(name, e)
  }
}

export const APP_SYSTEM = `Ets l'assistent personal de Mobles CNC, una app per dissenyar mobles paramètrics i fabricar-los a la CNC del taller (també objectes decoratius i ambients). Respon sempre en català, curt i clar.
Pots fer el que faria l'usuari amb la UI: saber on és i què té seleccionat (get_app; cada missatge també porta una línia «[Context de l'app: …]»), buscar, obrir i crear mobles, objectes i ambients (list_documents, open_document, create_document) i anar a una pàgina (go_to). Quan hi ha un document obert, també tens les eines d'aquell document per canviar-lo; si n'obres un altre, a la volta següent ja tens les seves eines.
Quan l'usuari parli de «això», «el seleccionat» o similar, fes servir la selecció del context. No inventis ids: busca'ls amb les eines. Abans d'esborrar o canviar molt, explica què faràs. Els canvis d'un torn es desfan amb un sol «Desfer» de l'editor.`

/** Les eines de l'app soles (cap document obert). */
export const appToolSet: AssistantToolSet<unknown> = {
  system: APP_SYSTEM,
  tools: toolDefs(INPUTS),
  run,
  payload: (_n, _b, outcome) => outcome.result,
  describe: (n, result) => {
    if (n === "open_document") return `Obert: ${(result.opened as { name: string }).name}`
    if (n === "create_document") return `Creat: ${(result.created as { name: string }).name}`
    if (n === "go_to") return `Anat a ${String(result.at)}`
    if (n === "list_documents") return `${String(result.count)} ${String(result.kind)}${Number(result.count) === 1 ? "" : "s"}`
    return "On ets"
  },
}

const APP_NAMES = new Set(Object.keys(INPUTS))

/** Les eines de l'app més les del document obert (si n'hi ha): un sol joc per al torn. */
export function withAppTools(docSet: AssistantToolSet<unknown> | undefined): AssistantToolSet<unknown> {
  if (!docSet) return appToolSet
  return {
    system: `${APP_SYSTEM}\n\n--- Document obert ---\n${docSet.system}`,
    tools: [...appToolSet.tools, ...docSet.tools.filter((t) => !APP_NAMES.has(t.name))],
    run: (doc, name, input) => (APP_NAMES.has(name) ? appToolSet.run(doc, name, input) : docSet.run(doc, name, input)),
    payload: (name, before, outcome) => (APP_NAMES.has(name) ? appToolSet.payload(name, before, outcome) : docSet.payload(name, before, outcome)),
    describe: (name, result, payload) => (APP_NAMES.has(name) ? appToolSet.describe(name, result, payload) : docSet.describe(name, result, payload)),
  }
}
