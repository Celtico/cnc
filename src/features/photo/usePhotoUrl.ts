import { useEffect, useMemo, useRef } from "react"

/** URL d'objecte del blob de la foto. */
export function usePhotoUrl(blob: Blob): string {
  // URL de la foto: es revoca l'anterior quan canvia el blob. No es revoca en desmuntar
  // perquè StrictMode desmunta i remunta sense tornar a renderitzar (deixaria la imatge
  // trencada); el cost és una sola URL viva fins que es recarrega la pàgina.
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  const prevUrl = useRef<string | null>(null)
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== url) URL.revokeObjectURL(prevUrl.current)
    prevUrl.current = url
  }, [url])
  return url
}
