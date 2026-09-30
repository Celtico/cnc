import { useEffect, useState } from "react"

const EVENT = "mobles:session-string"

/**
 * Text recordat durant la sessió (p. ex. l'element triat d'una llista de Preferències). Tots els
 * que fan servir la mateixa clau es mantenen iguals (p. ex. l'App sap quin apartat és obert).
 */
export function useSessionString(key: string): [string | null, (v: string | null) => void] {
  const [v, setV] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  })
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; value: string | null }>).detail
      if (d.key === key) setV(d.value)
    }
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [key])
  const set = (value: string | null) => {
    setV(value)
    try {
      if (value === null) sessionStorage.removeItem(key)
      else sessionStorage.setItem(key, value)
    } catch {
      /* sense sessionStorage: només en memòria */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { key, value } }))
  }
  return [v, set]
}
