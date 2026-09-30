/** Vistes estàndard del visor i el seu nom. */
export type ViewName = "3d" | "front" | "back" | "left" | "right" | "top"
export const VIEW_LABELS: Record<ViewName, string> = { "3d": "3D", front: "Davant", back: "Darrere", left: "Esquerra", right: "Dreta", top: "Dalt" }
