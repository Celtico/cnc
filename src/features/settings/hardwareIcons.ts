import type { IconType } from "react-icons"
import { LuAnchor, LuBolt, LuCircleDashed, LuCircleDot, LuDoorOpen, LuFootprints, LuGripHorizontal, LuLightbulb, LuMagnet, LuMinus, LuPackage, LuPackageOpen, LuPanelBottom, LuRailSymbol, LuSquareDot, LuTable } from "react-icons/lu"
import type { HardwareCategory } from "../../core/model"

/**
 * Icona de cada categoria de ferratges (la graella de Preferències › Ferratges i l'«Afegir»), del catàleg d'icones del
 * `CLAUDE.md`: cassoleta, System 32, abatible i imants són les de sempre; les guies porten el carril (`LuRailSymbol`, no
 * la del contingut Calaixos); potes, les petjades (no la Taula); taules, la Taula; portes corredisses i plegables, la
 * porta oberta.
 */
export const HARDWARE_ICONS: Record<HardwareCategory, IconType> = {
  hinge: LuCircleDashed,
  plate: LuSquareDot,
  slide: LuRailSymbol,
  lift: LuPanelBottom,
  connector: LuBolt,
  "shelf-support": LuCircleDot,
  leg: LuFootprints,
  table: LuTable,
  "door-system": LuDoorOpen,
  "drawer-system": LuPackageOpen,
  handle: LuGripHorizontal,
  push: LuMagnet,
  profile: LuMinus,
  light: LuLightbulb,
  wall: LuAnchor,
  misc: LuPackage,
}
