import type { PanelRole } from "../../core/model"

/**
 * Colors «per tipus de peça» del mode Ràpida: famílies ben diferenciades
 * (estructura, prestatges, fons, fronts, calaixos…) i suaus per no cansar.
 */
export const ROLE_GROUPS: { label: string; color: string; roles: PanelRole[] }[] = [
  { label: "Estructura", color: "#e3dccf", roles: ["side", "top", "bottom", "divider", "fixedShelf", "facing", "spacer"] },
  { label: "Prestatges", color: "#b7d99b", roles: ["shelf"] },
  { label: "Fons", color: "#c8bfe3", roles: ["back"] },
  { label: "Portes i fronts", color: "#8fc1ea", roles: ["door", "flap", "hatch", "panel"] },
  { label: "Reixeta", color: "#86d3c7", roles: ["grille"] },
  { label: "Front calaix", color: "#f4b27a", roles: ["drawerFront"] },
  { label: "Caixa calaix", color: "#f2d98c", roles: ["drawerSide", "drawerBack", "drawerBottom"] },
  { label: "Sòcol", color: "#8e8780", roles: ["plinth"] },
  { label: "Taulell", color: "#c6924f", roles: ["worktop"] },
  { label: "Peces lliures", color: "#e7a8c9", roles: ["part"] },
]

export const ROLE_COLOR = Object.fromEntries(ROLE_GROUPS.flatMap((g) => g.roles.map((r) => [r, g.color]))) as Record<PanelRole, string>
