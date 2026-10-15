import { useState } from "react"

/**
 * El mateix objecte mentre la clau no canviï: per a valors que es tornen a crear a cada render però volen dir el mateix
 * (una selecció, una peça tornada a construir igual). Així els `useMemo` i els efectes que en depenen no es refan.
 * La clau ha de dir tot el que importa del valor (sovint `JSON.stringify` o una signatura).
 */
export function useKeyed<T>(value: T, key: unknown): T {
  const [kept, setKept] = useState({ key, value })
  if (!Object.is(kept.key, key)) {
    setKept({ key, value })
    return value
  }
  return kept.value
}
