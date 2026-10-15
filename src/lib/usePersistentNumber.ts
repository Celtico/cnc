import { useEffect, useState } from "react"

/** Número recordat al navegador (preferència de vista, p. ex. amplada d'un panell). */
export function usePersistentNumber(key: string, initial: number) {
  const [value, setValue] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem(key))
      return Number.isFinite(v) && v > 0 ? v : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, String(Math.round(value)))
    } catch {
      /* sense localStorage: només en memòria */
    }
  }, [key, value])
  return [value, setValue] as const
}
