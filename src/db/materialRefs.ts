import { materialRefNames, renameMaterialRefs, renameNestingSheets } from "../core/model"
import { db } from "./db"

/** Quants mobles (i objectes) i ambients s'han reescrit. */
export interface RenameCount {
  projects: number
  ambients: number
}

/**
 * Canvia noms de material (`[from, to]`, en ordre) a **tots** els mobles, objectes i ambients desats (composició,
 * paràmetres antics del mòdul de caixa i dades de l'ambient, amb les claus de `renameMaterialRefs`) en una sola
 * transacció i, dins la mateixa, `alsoSave` (desar les preferències noves, ja amb els noms canviats). No toca
 * `updatedAt` ni `edited` (canviar el nom d'un material no és modificar el moble, com `saveProjectCamera`), però la
 * miniatura es torna a fer (`thumbAt` fora: `thumbIsStale`).
 */
export async function renameMaterialEverywhere(renames: readonly (readonly [string, string])[], alsoSave?: () => Promise<unknown>): Promise<RenameCount> {
  const list = renames.filter(([from, to]) => from && to && from !== to)
  const count: RenameCount = { projects: 0, ambients: 0 }
  if (!list.length && !alsoSave) return count
  const apply = <T>(v: T): T => list.reduce((acc, [from, to]) => renameMaterialRefs(acc, from, to), v)
  await db.transaction("rw", db.projects, db.ambients, db.settings, async () => {
    if (list.length) {
      await db.projects.toCollection().modify((p) => {
        const composition = p.composition === undefined || p.composition === null ? p.composition : apply(p.composition)
        const params = apply(p.params)
        // Les mides de tauler per material del nesting del projecte (clau = nom del material).
        const nesting = list.reduce((acc, [from, to]) => renameNestingSheets(acc, from, to), p.nesting)
        if (composition === p.composition && params === p.params && nesting === p.nesting) return
        p.composition = composition
        p.params = params
        p.nesting = nesting
        delete p.thumbAt
        count.projects++
      })
      await db.ambients.toCollection().modify((a) => {
        const data = apply(a.data)
        if (data === a.data) return
        a.data = data
        delete a.thumbAt
        count.ambients++
      })
    }
    if (alsoSave) await alsoSave()
  })
  return count
}

/** Mobles (i objectes) i ambients desats que fan servir un material (noms, en ordre alfabètic). */
export async function materialUsage(name: string): Promise<{ projects: string[]; ambients: string[] }> {
  const uses = (v: unknown) => v !== undefined && v !== null && materialRefNames(v).includes(name)
  const [projects, ambients] = await Promise.all([db.projects.toArray(), db.ambients.toArray()])
  const sort = (xs: string[]) => xs.sort((a, b) => a.localeCompare(b, "ca"))
  return {
    projects: sort(projects.filter((p) => uses(p.composition) || (p.composition === undefined && uses(p.params))).map((p) => p.name)),
    ambients: sort(ambients.filter((a) => uses(a.data)).map((a) => a.name)),
  }
}
