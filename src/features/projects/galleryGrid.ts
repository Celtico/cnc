import { useEffect, useState } from "react"

/** Columnes de totes les graelles de la pàgina Mobles (historial i plantilles): la mateixa mida de targeta. */
export const GALLERY_COLS = { base: 2, md: 3, lg: 4, "2xl": 5 }

/** Per cercar sense accents ni majúscules. */
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** Acordions oberts: comencen tancats i es recorden només durant la sessió (com les seccions). */
export function useSessionList(key: string): [string[], (v: string[]) => void] {
  const [v, setV] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(key) ?? "[]") as string[]
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [key, v])
  return [v, setV]
}
