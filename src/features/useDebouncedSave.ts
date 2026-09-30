import { useEffect, useRef, useState } from "react"

/**
 * Desa `value` amb retard quan canvia (mentre s'arrossega o s'escriu no es desa a cada pas) i,
 * si se surt de la pàgina, es tanca l'app o es demana (`mobles:flush-save`, p. ex. abans de desar el
 * fitxer), desa el que quedava pendent.
 *
 * Es compara amb l'**últim valor desat**, no amb el que arriba de la base de dades: si no, cada
 * desada tornava un objecte nou de Dexie, semblava un canvi i es tornava a desar sense parar.
 */
export function useDebouncedSave<T>(value: T, save: (v: T) => void, delay = 350): void {
  const saved = useRef(value)
  const pending = useRef<{ v: T } | null>(null)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  const [flush] = useState(() => () => {
    const p = pending.current
    if (!p) return
    pending.current = null
    saved.current = p.v
    saveRef.current(p.v)
  })

  useEffect(() => {
    if (Object.is(value, saved.current)) {
      // Tornar enrere fins al que ja hi ha desat (desfer): no queda res pendent.
      pending.current = null
      return
    }
    pending.current = { v: value }
    const t = setTimeout(flush, delay)
    return () => clearTimeout(t)
  }, [value, delay, flush])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    window.addEventListener("mobles:flush-save", flush)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("mobles:flush-save", flush)
      flush() // en sortir de la pàgina
    }
  }, [flush])
}
