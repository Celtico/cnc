import type { ReactNode } from "react"
import { HoverLinkContext, useHoverLinkState } from "./hoverLink"

/**
 * Comparteix l'element sota el ratolí entre l'arbre i el 3D d'una pantalla (`useHoverLink`). L'estat viu aquí: passar
 * per sobre només torna a dibuixar les files i el visor, no tota la pantalla.
 */
export function HoverLinkProvider({ children }: { children: ReactNode }) {
  return <HoverLinkContext.Provider value={useHoverLinkState()}>{children}</HoverLinkContext.Provider>
}
