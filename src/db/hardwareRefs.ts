import { replaceHardwareRefs, usesHardware, type HardwareItem } from "../core/model"
import { db } from "./db"

/**
 * Mobles (i objectes) desats que fan servir un ferratge (una còpia d'un mòdul o d'un front igual que l'item, `usesHardware`;
 * les que tenen el mateix id i un altre contingut no compten), en ordre alfabètic.
 */
export async function hardwareUsage(item: HardwareItem): Promise<string[]> {
  const projects = await db.projects.toArray()
  return projects
    .filter((p) => !p.draft && p.composition !== undefined && p.composition !== null && usesHardware(p.composition, item))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b, "ca"))
}

/**
 * Eliminar un ferratge amb substitut: a **tots** els mobles desats, les còpies de `from` (tal qual, `replaceHardwareRefs`;
 * una còpia amb el mateix id i un altre contingut es queda) passen a ser còpies de `to`
 * (en una transacció, amb `alsoSave`: les preferències noves). Com canviar el nom d'un material, no toca `updatedAt` ni
 * `edited`, però la miniatura es torna a fer. Torna quants mobles s'han reescrit.
 */
export async function replaceHardwareEverywhere(from: HardwareItem, to: HardwareItem, alsoSave?: () => Promise<unknown>): Promise<number> {
  let count = 0
  await db.transaction("rw", db.projects, db.settings, async () => {
    await db.projects.toCollection().modify((p) => {
      if (p.composition === undefined || p.composition === null) return
      const next = replaceHardwareRefs(p.composition, from, to)
      if (next === p.composition) return
      p.composition = next
      delete p.thumbAt
      count++
    })
    if (alsoSave) await alsoSave()
  })
  return count
}
