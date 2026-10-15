import type { z } from "zod"
import type { Composition, HardwareItem, Settings } from "../../core/model"
import type { ToolRun } from "../../core/assistant/toolset"
import { db, safeNestOptions } from "../../db/db"
import { currentDoc, currentNav, type HubNav } from "./assistantHub"
import type { AppToolName, INPUTS } from "./appToolInputs"

/** Peces comunes dels gestors de les eines de l'app (`appTools.ts`): les preferències d'ara, el moble obert i on som. */

/** El que rep el gestor d'una eina: el document, l'entrada validada i la navegació (llegida en començar l'eina). */
export interface AppToolCall<K extends AppToolName> {
  doc: unknown
  input: z.infer<(typeof INPUTS)[K]>
  nav: HubNav | null
}
type AppToolHandler<K extends AppToolName> = (call: AppToolCall<K>) => ToolRun<unknown> | Promise<ToolRun<unknown>>
/** Un gestor per eina (el nom de l'eina → què fa). */
export type AppToolHandlers<K extends AppToolName> = { [N in K]: AppToolHandler<N> }

/** Les preferències d'ara (les posa el xat, `GlobalAssistant`): màquina i regles per al nesting, materials… */
let SETTINGS: Settings | null = null
export function setAppSettings(s: Settings): void {
  SETTINGS = s
}
export function appSettings(): Settings | null {
  return SETTINGS
}

/** El moble obert (per a Peces, Nesting i Exportar): la composició d'ara i la fila desada. */
export async function openMoble(): Promise<{ id: number; name: string; comp: Composition; nesting: ReturnType<typeof safeNestOptions> } | string> {
  const d = currentDoc()
  if (!d || d.kind !== "moble") return "Cal un moble obert (open_document)."
  const row = await db.projects.get(d.id)
  if (!row) return "El moble obert ja no hi és."
  return { id: d.id, name: row.name, comp: d.target.getDoc() as Composition, nesting: safeNestOptions(row.nesting) }
}

/** Un ferratge de la biblioteca per id o nom (sense majúscules ni accents). */
export function findHardware(ref: string): HardwareItem | undefined {
  const lib = SETTINGS?.hardwareLibrary ?? []
  return lib.find((h) => h.id === ref) ?? lib.find((h) => fold(h.name) === fold(ref))
}

export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca")

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
