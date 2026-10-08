import type { IconType } from "react-icons"
import { LuArchive, LuColumns2, LuDoorClosed, LuGrid3X3, LuPanelBottom, LuRows2, LuRows3, LuSquare, LuSquareDashed, LuShirt } from "react-icons/lu"
import type { Zone } from "../../core/model"

/** Icona de cada tipus de front (la mateixa a l'arbre, a la capçalera i a la secció «Front»). */
export const FRONT_ICONS: Record<NonNullable<Zone["front"]>["kind"] | "none", IconType> = {
  none: LuSquareDashed,
  door: LuDoorClosed,
  drawers: LuArchive,
  flap: LuPanelBottom,
  grille: LuGrid3X3,
  panel: LuSquare,
}

/**
 * Icona d'una zona segons el que és: divisió (columnes / files) o compartiment segons el seu
 * front; si és obert, prestatges o buit. L'arrel dividida (`root`, l'«Interior») amb les portes de tot el mòdul
 * (Mòdul › Portes) porta la icona de la porta (un altre front d'una zona dividida no es fa).
 */
export function zoneIcon(z: Zone, opts?: { root?: boolean }): IconType {
  if (opts?.root && z.split && z.front?.kind === "door") return FRONT_ICONS.door
  if (z.split) return z.split.dir === "v" ? LuColumns2 : LuRows2
  if (z.front) return FRONT_ICONS[z.front.kind]
  if (z.rail) return LuShirt
  return z.shelves && z.shelves.n > 0 ? LuRows3 : LuSquareDashed
}
