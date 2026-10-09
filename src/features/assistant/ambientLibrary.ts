import { buildBounds, buildComposition } from "../../core/build/buildComposition"
import type { AmbientToolContext, LibraryEntry } from "../../core/assistant/ambientTools"
import { uniqueName } from "../../core/file/mobleFile"
import { compositionKind, resolveTemplateRef, withInnerClearance, type Settings } from "../../core/model"
import { compositionOf } from "../../db/compositionStore"
import { createProject, db, type Project } from "../../db/db"

/**
 * El que les eines dels ambients (`core/assistant/ambientTools.ts`) necessiten de fora de l'ambient: la llista de mobles i
 * objectes de l'usuari (Dexie, sense esborranys, com `useProjects`) amb la caixa de cadascun i crear-ne un d'una plantilla
 * del catàleg pel mateix camí que les galeries («Afegir un moble / un objecte» dels ambients: `withInnerClearance` als
 * mobles, `uniqueName`, `createProject`; a l'Historial).
 */

/** Mides per moble i versió (`id:updatedAt`): construir-los tots a cada eina seria lent. */
const sizes = new Map<string, Pick<LibraryEntry, "kind" | "w" | "h" | "d">>()

function entryOf(p: Project): LibraryEntry {
  const key = `${p.id}:${p.updatedAt}`
  let s = sizes.get(key)
  if (!s) {
    const comp = compositionOf(p)
    const b = buildBounds(buildComposition(comp))
    s = { kind: compositionKind(comp) === "objecte" ? "objecte" : "moble", w: Math.round(b.max[0] - b.min[0]), h: Math.round(b.max[1] - b.min[1]), d: Math.round(b.max[2] - b.min[2]) }
    sizes.set(key, s)
  }
  return { id: p.id, name: p.name, ...s, ...(p.folder ? { folder: p.folder } : {}) }
}

export async function readLibrary(): Promise<LibraryEntry[]> {
  const list = await db.projects.orderBy("updatedAt").reverse().filter((p) => !p.draft).toArray()
  return list.map(entryOf)
}

export async function createFromTemplate(ref: string, settings: Pick<Settings, "gaps">): Promise<LibraryEntry> {
  const t = resolveTemplateRef(ref)
  if (!t) throw new Error(`No hi ha cap plantilla «${ref}».`)
  // Com les galeries: els objectes tal qual; els mobles amb la folgança de les peces de dins de Preferències.
  const comp = t.kind === "objecte" ? { ...t.make(), kind: "objecte" as const } : withInnerClearance({ ...t.make(), kind: t.kind }, settings.gaps.innerClearance)
  const existing = (await db.projects.toArray()).map((p) => p.name)
  const id = await createProject(uniqueName(t.name, existing), undefined, { composition: comp })
  const p = await db.projects.get(id)
  if (!p) throw new Error("No s'ha pogut crear el moble.")
  return entryOf(p)
}

/** Context de les eines dels ambients amb les preferències d'ara. */
export function ambientToolContext(settings: Settings): AmbientToolContext {
  return { settings, library: readLibrary, createFromTemplate: (ref) => createFromTemplate(ref, settings) }
}
