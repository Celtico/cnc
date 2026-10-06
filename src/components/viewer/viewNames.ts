/**
 * Vistes estàndard del visor: només col·loquen la càmera (perspectiva) d'aquell costat i enquadren el moble, com
 * «Enquadrar» (que fa el 3/4). Després es pot orbitar com sempre.
 */
export type ViewName = "front" | "back" | "left" | "right" | "top"
export const VIEWS: ViewName[] = ["front", "back", "left", "right", "top"]
export const VIEW_LABELS: Record<ViewName, string> = { front: "Davant", back: "Darrere", left: "Esquerra", right: "Dreta", top: "Dalt" }
