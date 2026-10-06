import { useEffect, useState } from "react"

/** Llista recordada durant la sessió (sessionStorage), p. ex. els acordions oberts d'una galeria. */
export function useSessionList(key: string, initial: string[] = []): [string[], (v: string[]) => void] {
  const [v, setV] = useState<string[]>(() => readSessionList(key) ?? initial)
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(v))
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [key, v])
  return [v, setV]
}

/** La llista desada a la sessió (`null` si no n'hi ha o no es pot llegir). */
export function readSessionList(key: string): string[] | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : null
  } catch {
    return null
  }
}

/** Un interruptor recordat durant la sessió («1» / «0»). */
export function readSessionFlag(key: string): boolean | null {
  try {
    const v = sessionStorage.getItem(key)
    return v === null ? null : v === "1"
  } catch {
    return null
  }
}

export function writeSessionFlag(key: string, on: boolean) {
  try {
    sessionStorage.setItem(key, on ? "1" : "0")
  } catch {
    /* només en memòria */
  }
}
