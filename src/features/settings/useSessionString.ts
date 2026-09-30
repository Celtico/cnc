import { useEffect, useState } from "react"

/** Text recordat durant la sessió (p. ex. l'element triat d'una llista de Preferències). */
export function useSessionString(key: string): [string | null, (v: string | null) => void] {
  const [v, setV] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      if (v === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, v)
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [key, v])
  return [v, setV]
}
