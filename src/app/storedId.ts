import { useEffect, useState } from "react"

/** El moble obert i l'ambient obert es recorden entre sessions. */
export const STORAGE_KEY = "mobles:current-project"
export const AMBIENT_KEY = "mobles:current-ambient"

export function readStoredId(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

/** Un id (o cap) que es llegeix en obrir l'app i es desa a `localStorage` a cada canvi. */
export function useStoredId(key: string) {
  const [id, setId] = useState<number | null>(() => readStoredId(key))
  useEffect(() => {
    try {
      if (id === null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(id))
    } catch {
      /* sense localStorage: no passa res */
    }
  }, [id, key])
  return [id, setId] as const
}
