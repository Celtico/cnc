import type { Settings } from "../../core/model"
import { parseToolInput, toolDefs, toolFailure, type AssistantToolSet, type ToolRun } from "../../core/assistant/toolset"
import { currentDoc, currentNav } from "./assistantHub"
import { INPUTS, type AppToolName } from "./appToolInputs"
import { appContext, type AppToolCall, type AppToolHandlers } from "./appToolContext"
import { documentHandlers } from "./appToolsDocuments"
import { workshopHandlers } from "./appToolsWorkshop"
import { settingsHandlers } from "./appToolsSettings"
import { hardwareHandlers } from "./appToolsHardware"
import { dbHandlers } from "./appToolsDb"

export { dbSafe, getAt, setAt } from "./dbPaths"
export { setAppSettings } from "./appToolContext"

/**
 * Eines de l'**app** de l'assistent personal (`assistantHub.ts`): on som, buscar, obrir i crear mobles, objectes i
 * ambients, i anar a una pàgina. No toquen el document obert (en tornen el mateix): el canvi és de pàgina. Les del document
 * obert (moble, objecte, ambient) s'hi afegeixen (`withAppTools`).
 */

/** El context en una línia per posar davant del missatge de l'usuari. */
export function contextLine(): string {
  const c = appContext()
  const doc = c.document as { kind: string; id: number; name: string } | null
  const parts = [`apartat ${c.section ?? "?"}, pàgina ${c.page ?? "?"}`, doc ? `${doc.kind} obert «${doc.name}» (id ${doc.id})` : "cap document obert", c.selection ? `seleccionat: ${c.selection}` : "res seleccionat"]
  return `[Context de l'app: ${parts.join("; ")}]`
}

/** Què fa cada eina de l'app (un gestor per eina). */
const HANDLERS: AppToolHandlers<AppToolName> = { ...documentHandlers, ...workshopHandlers, ...settingsHandlers, ...hardwareHandlers, ...dbHandlers }

async function run(doc: unknown, name: string, raw: unknown): Promise<ToolRun<unknown>> {
  const p = parseToolInput(INPUTS, name, raw)
  if (!p.ok) return p
  const nav = currentNav()
  try {
    const handler = (HANDLERS as Partial<Record<string, (call: AppToolCall<AppToolName>) => ToolRun<unknown> | Promise<ToolRun<unknown>>>>)[name]
    if (handler) return await handler({ doc, input: p.data as AppToolCall<AppToolName>["input"], nav })
    return { ok: false, error: `Eina desconeguda «${name}».` }
  } catch (e) {
    return toolFailure(name, e)
  }
}

const APP_SYSTEM = `Ets l'assistent personal de Mobles CNC, una app per dissenyar mobles paramètrics i fabricar-los a la CNC del taller (també objectes decoratius i ambients). Respon sempre en català, curt i clar.
Pots fer el que faria l'usuari amb la UI: saber on és i què té seleccionat (get_app; cada missatge també porta una línia «[Context de l'app: …]»), buscar, obrir i crear mobles, objectes i ambients (list_documents, open_document, create_document) anar a una pàgina (go_to), gestionar documents (rename_document, duplicate_document, move_to_group, delete_document), llegir les peces i el nesting del moble obert i canviar-ne el tauler (get_cutlist, get_nesting, set_sheet), baixar els fitxers del taller (export_files) i els ferratges (list_hardware, get_hardware, edit_hardware, set_hardware_default, set_front_hardware: frontissa, guia o joc de calaix, braç, imant, tirador, barra, LED i marc d'un compartiment del moble obert), llegir i canviar les preferències (get_settings, set_pref_material, set_pref_defaults, set_pref_gaps, set_default_machine) i, per al que cap altra eina no fa, la base de dades directament (db_tables, db_read, db_write: validat amb els esquemes de l'app; fora del document obert no es pot desfer, així que ensenya el canvi i demana-ho abans de confirmed: true). També tens les eines de cada tipus de document (moble, objecte, ambient), però només serveixen amb un document d'aquell tipus obert: si cal, obre'l primer amb open_document.
Per esborrar un document, pregunta-ho sempre abans i espera un sí explícit (delete_document amb confirmed: true només llavors).
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
    if (n === "get_cutlist") return `${String(result.pieces)} peces`
    if (n === "get_nesting") return `${(result.boards as unknown[]).length} taulers · ${String(result.total_efficiency)}`
    if (n === "set_sheet") return `Tauler ${String(result.sheet)}${result.material ? ` per a ${String(result.material)}` : ""}`
    if (n === "get_settings") return "Preferències"
    if (n === "set_pref_material") return `Material «${String(result.material)}»${result.created ? " creat" : " canviat"}`
    if (n === "set_pref_defaults") return "Per defecte canviats"
    if (n === "set_pref_gaps") return "Folgances canviades"
    if (n === "set_default_machine") return `Màquina per defecte: ${String(result.machine)}`
    if (n === "list_hardware") return `${String(result.count)} ferratges`
    if (n === "set_hardware_default") return `Per defecte: ${String(result.hardware)}`
    if (n === "set_front_hardware") return `${String(result.hardware)} a «${String(result.module)}»`
    if (n === "db_tables") return "Base de dades"
    if (n === "db_read") return `Llegit: ${String(result.table)}${result.id !== undefined ? ` ${String(result.id)}` : ""}${result.path ? ` · ${String(result.path)}` : ""}`
    if (n === "db_write") return `Desat: ${String(result.table)} ${String(result.id)} · ${String(result.path)}`
    if (n === "get_hardware") return `Ferratge: ${String(result.name)}`
    if (n === "edit_hardware") return `${result.duplicated ? "Duplicat" : "Editat"}: ${String(result.hardware)}`
    if (n === "export_files") return `Baixat: ${String(result.file)}`
    if (n === "rename_document") return `Nom canviat: ${String(result.name)}`
    if (n === "duplicate_document") return `Duplicat: ${(result.copy as { name?: string }).name ?? ""}`
    if (n === "move_to_group") return result.group ? `Al grup «${String(result.group)}»` : "Tret del grup"
    if (n === "delete_document") return `Esborrat: ${(result.deleted as { name: string }).name}`
    if (n === "list_documents") return `${String(result.count)} ${String(result.kind)}${Number(result.count) === 1 ? "" : "s"}`
    return "On ets"
  },
}

const APP_NAMES = new Set(Object.keys(INPUTS))

/**
 * **Totes les eines, sempre les mateixes** (les de l'app i les de cada tipus de document): les instruccions i la llista
 * d'eines no poden canviar a mitja conversa (l'API lliga els blocs de pensament a les instruccions i a les eines, i
 * canviar-les trencava el torn en obrir un document). Cada eina de document va al joc del seu tipus i només serveix amb
 * un document d'aquell tipus obert.
 */
export async function allToolSet(settings: Settings): Promise<AssistantToolSet<unknown>> {
  const [{ mobleToolSet }, { objectToolSet }, { ambientAssistantToolSet }] = await Promise.all([import("../../core/assistant/tools"), import("../../core/assistant/objectTools"), import("./ambientLibrary")])
  const sets: { kind: "moble" | "objecte" | "ambient"; set: AssistantToolSet<unknown> }[] = [
    { kind: "moble", set: mobleToolSet({ settings }) as AssistantToolSet<unknown> },
    { kind: "objecte", set: objectToolSet({ settings }) as AssistantToolSet<unknown> },
    { kind: "ambient", set: ambientAssistantToolSet(settings) as unknown as AssistantToolSet<unknown> },
  ]
  // Les peces lliures (add_part, update_part…) també als mobles: allà es fabriquen (al nesting si el material és de CNC).
  const mobleParts = objectToolSet({ settings, fabricated: true }) as AssistantToolSet<unknown>
  const owner = new Map<string, (typeof sets)[number]>()
  for (const s of sets) for (const t of s.set.tools) if (!APP_NAMES.has(t.name) && !owner.has(t.name)) owner.set(t.name, s)
  const label = { moble: "un moble", objecte: "un objecte", ambient: "un ambient" }
  /** El joc que fa una eina amb el document obert (o per què no es pot). */
  const setFor = (name: string): AssistantToolSet<unknown> | string => {
    const o = owner.get(name)
    if (!o) return `Eina desconeguda «${name}».`
    const d = currentDoc()
    if (d && d.kind === o.kind) return o.set
    if (d?.kind === "moble" && o.kind === "objecte") return mobleParts
    const can = o.kind === "objecte" ? "un objecte o un moble" : label[o.kind]
    return `«${name}» és per a ${can} obert${d ? ` (ara és obert ${label[d.kind]})` : " (ara no n'hi ha cap)"}: obre'n un amb open_document.`
  }
  return {
    system: [APP_SYSTEM, ...sets.map((s) => `--- Eines per a ${label[s.kind]} obert ---\n${s.set.system}`), "--- Peces lliures en un moble ---\nLes eines de les peces lliures de l'objecte (get_object, add_part, update_part, remove_part, duplicate_part, set_group, move_group, duplicate_group) també serveixen amb un moble obert: allà són peces de debò que es fabriquen (van al nesting i als fitxers del taller si el material és de CNC; ferro, pedra o vidre, no). Amb shape polygon pots fer qualsevol contorn (punts en mm al pla de la peça, amb bulge per als arcs)."].join("\n\n"),
    tools: [...appToolSet.tools, ...sets.flatMap((s) => s.set.tools.filter((t) => owner.get(t.name) === s))],
    run: (doc, name, input) => {
      if (APP_NAMES.has(name)) return appToolSet.run(doc, name, input)
      const set = setFor(name)
      return typeof set === "string" ? { ok: false, error: set } : set.run(doc, name, input)
    },
    payload: (name, before, outcome) => {
      if (APP_NAMES.has(name)) return appToolSet.payload(name, before, outcome)
      const set = setFor(name)
      return typeof set === "string" ? outcome.result : set.payload(name, before, outcome)
    },
    describe: (name, result, payload) => {
      if (APP_NAMES.has(name)) return appToolSet.describe(name, result, payload)
      const set = setFor(name)
      return typeof set === "string" ? name : set.describe(name, result, payload)
    },
  }
}

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
