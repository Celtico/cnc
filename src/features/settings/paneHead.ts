import { createContext, type ReactNode } from "react"

/** Títol de la pàgina que es mira: a les de llista i detall, el posa la llista (`MasterDetail.head`). */
export const PaneHeadContext = createContext<ReactNode>(null)
