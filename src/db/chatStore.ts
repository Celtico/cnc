import { db } from "./db"

const ID = "current"

/** La conversa desada (o `null`): el que es veu i l'historial per a l'API. */
export async function loadChat(): Promise<{ items: unknown[]; history: unknown[] } | null> {
  try {
    const row = await db.chats.get(ID)
    return row && Array.isArray(row.items) && Array.isArray(row.history) ? { items: row.items, history: row.history } : null
  } catch {
    return null
  }
}

/** Desa la conversa (buida, l'esborra: «Nova conversa»). */
export async function saveChat(items: unknown[], history: unknown[]): Promise<void> {
  try {
    if (!items.length && !history.length) await db.chats.delete(ID)
    else await db.chats.put({ id: ID, items, history, updatedAt: Date.now() })
  } catch {
    // Sense IndexedDB (navegació privada): la conversa dura mentre l'app és oberta, com abans.
  }
}
