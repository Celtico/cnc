import type { ParsedPriceList, PriceList } from "../core/pricelist/parse"
import { db } from "./db"
import { useLiveQuery } from "./useLiveQuery"

/** Les tarifes desades, la més nova primer (undefined mentre es carreguen). */
export function usePriceLists(): PriceList[] | undefined {
  return useLiveQuery(() => db.priceLists.orderBy("createdAt").reverse().toArray(), [])
}

export async function addPriceList(p: ParsedPriceList & { supplier: string; file: string; discount: number }): Promise<string> {
  const id = `tar-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  await db.priceLists.add({ ...p, supplier: p.supplier.trim() || "Proveïdor", id, createdAt: Date.now() })
  return id
}

export async function updatePriceList(id: string, patch: Partial<Pick<PriceList, "supplier" | "discount">>): Promise<void> {
  await db.priceLists.update(id, patch)
}

export async function deletePriceList(id: string): Promise<void> {
  await db.priceLists.delete(id)
}
