import { useEffect, useState } from "react"

/** Booleà recordat al navegador (preferència de vista). Si no hi ha localStorage, funciona igual en memòria. */
export function usePersistentFlag(key: string, initial = false) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(key)
      return v === null ? initial : v === "1"
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0")
    } catch {
      /* sense localStorage: només en memòria */
    }
  }, [key, value])
  return [value, setValue] as const
}
