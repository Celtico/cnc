import { useSyncExternalStore } from "react"

/**
 * Obrir seccions des de fora (per decisió de l'usuari, 2026-10-17: un avís porta «on s'arregla»): `openFolds(["mod-structure",
 * "mod-carcass-back"])` obre cada `FoldItem` sol de la llista quan es munta (una subsecció es munta quan s'obre la de
 * sobre) i l'últim es mostra i s'il·lumina un moment. La petició caduca sola.
 */
let request: { ids: string[]; n: number } | null = null
let expiry: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => {
  for (const l of listeners) l()
}

export function openFolds(ids: string[]): void {
  request = { ids, n: (request?.n ?? 0) + 1 }
  emit()
  clearTimeout(expiry)
  expiry = setTimeout(() => {
    request = null
    emit()
  }, 3000)
}

/** La petició d'ara (viu 3 s) si inclou aquesta secció. */
export function useFoldRequest(id: string): { n: number; last: boolean } | null {
  const r = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => request,
  )
  if (!r || !r.ids.includes(id)) return null
  return { n: r.n, last: r.ids[r.ids.length - 1] === id }
}
