import { useState } from "react"

/**
 * Esborrany editable d'un valor que ve de fora (un nom, un lliscador): l'usuari el canvia en local i s'aplica en acabar;
 * si el valor de fora canvia (desfer, un altre item), l'esborrany torna a ser-lo. Es posa al dia durant el render (sense
 * l'efecte d'abans, que pintava un cop amb el valor vell).
 */
export function useDraft<T>(value: T): [T, (v: T) => void] {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (!Object.is(seen, value)) {
    setSeen(value)
    setDraft(value)
  }
  return [draft, setDraft]
}
