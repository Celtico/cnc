import { useEffect } from "react"
import { useLatest } from "../../../lib/useLatest"
import { loadBackdrop, type BackdropKind, type Panorama } from "./backdrops"
import type { RenderOpts } from "./sceneData"

/** Vista per les finestres: es carrega la triada (la foto pròpia, si n'hi ha de desada). */
export function useBackdropLoader(open: boolean, viewKind: NonNullable<RenderOpts["view"]>, pano: { kind: BackdropKind; p: Panorama } | null, setPano: (p: { kind: BackdropKind; p: Panorama } | null) => void, setNotice: (n: string | null) => void) {
  // La vista ja carregada: es mira en obrir o en canviar de vista, però carregar-ne una no torna a disparar l'efecte.
  const panoKind = useLatest(pano?.kind)
  useEffect(() => {
    // Ja carregada (en tornar a obrir el diàleg amb un render a mig fer): no es torna a carregar, si no el render tornaria
    // a començar (una vista nova és un altre objecte).
    if (!open || viewKind === "sky" || panoKind.current === viewKind) return
    let alive = true
    void loadBackdrop(viewKind).then(
      (p) => alive && setPano(p ? { kind: viewKind, p } : null),
      (err) => alive && setNotice(`No s'ha pogut carregar la vista per les finestres: ${err instanceof Error ? err.message : String(err)}`),
    )
    return () => {
      alive = false
    }
  }, [open, viewKind, panoKind, setPano, setNotice])
}
