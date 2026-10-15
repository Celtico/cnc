import { db } from "./db"

const ID = "option-cascade"

/** L'esborrany de Preferències › Opcions en cascada tal com es va desar (sense validar: `parseStoredDraft`), o `null`. */
export async function loadCascadeDraft(): Promise<unknown> {
  try {
    return (await db.drafts.get(ID))?.data ?? null
  } catch {
    return null
  }
}

/** Desa l'esborrany; `false` si no s'ha pogut (sense IndexedDB, navegació privada: dura mentre l'app és oberta). */
export async function saveCascadeDraft(data: unknown): Promise<boolean> {
  try {
    await db.drafts.put({ id: ID, data, updatedAt: Date.now() })
    return true
  } catch {
    return false
  }
}
