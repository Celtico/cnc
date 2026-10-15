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

/** Desa l'esborrany. Sense IndexedDB (navegació privada) dura mentre l'app és oberta. */
export async function saveCascadeDraft(data: unknown): Promise<void> {
  try {
    await db.drafts.put({ id: ID, data, updatedAt: Date.now() })
  } catch {
    // Res: sense IndexedDB no es pot desar.
  }
}
