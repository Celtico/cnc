import { liveQuery } from "dexie"
import { useEffect, useState } from "react"

/**
 * Subscriu-se a una consulta de Dexie i torna a renderitzar quan canvien les dades.
 * Equivalent mínim de `dexie-react-hooks` per no afegir dependències.
 */
export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: readonly unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  useEffect(() => {
    const sub = liveQuery(querier).subscribe({
      next: (v) => setValue(v),
      error: (e: unknown) => console.error("liveQuery", e),
    })
    return () => sub.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- les dependències les passa qui crida (com `dexie-react-hooks`)
  }, deps)
  return value
}
