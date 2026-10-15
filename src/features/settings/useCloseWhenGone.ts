import { useEffect } from "react"

/**
 * Editor d'una llista (Materials, Ferratges): si l'element obert deixa d'existir (eliminat, o restaurat), es treu la
 * selecció i l'editor es tanca. `index`: on és l'element `sel` a la llista (-1 si no hi és).
 */
export function useCloseWhenGone(sel: string | null, index: number, setSel: (id: null) => void, setEditorOpen: (open: boolean) => void) {
  useEffect(() => {
    // Eliminat (o restaurat): l'editor es tanca.
    if (sel !== null && index < 0) {
      setSel(null)
      setEditorOpen(false)
    }
  }, [sel, index, setSel, setEditorOpen])
}
