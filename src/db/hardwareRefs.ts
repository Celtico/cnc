import { hardwareRefIds, replaceHardwareRefs, type HardwareItem } from "../core/model"
import { db } from "./db"

/** Mobles (i objectes) desats que fan servir un ferratge (la còpia d'un mòdul o d'un front), en ordre alfabètic. */
export async function hardwareUsage(id: string): Promise<string[]> {
  const projects = await db.projects.toArray()
  return projects
    .filter((p) => !p.draft && p.composition !== undefined && p.composition !== null && hardwareRefIds(p.composition).includes(id))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "ca"))
}

/**
 * Eliminar un ferratge amb substitut: a **tots** els mobles desats, les còpies de `fromId` passen a ser còpies de `to`
 * (en una transacció, amb `alsoSave`: les preferències noves). Com canviar el nom d'un material, no toca `updatedAt` ni
 * `edited`, però la miniatura es torna a fer. Torna quants mobles s'han reescrit.
 */
export async function replaceHardwareEverywhere(fromId: string, to: HardwareItem, alsoSave?: () => Promise<unknown>): Promise<number> {
  let count = 0
  await db.transaction("rw", db.projects, db.settings, async () => {
    await db.projects.toCollection().modify((p) => {
      if (p.composition === undefined || p.composition === null) return
      const next = replaceHardwareRefs(p.composition, fromId, to)
      if (next === p.composition) return
      p.composition = next
      delete p.thumbAt
      count++
    })
    if (alsoSave) await alsoSave()
  })
  return count
}
