import type { IconType } from "react-icons"
import { LuAnchor, LuArchive, LuBolt, LuCircleDashed, LuCircleDot, LuFootprints, LuGripHorizontal, LuMagnet, LuMinus, LuPackage, LuPanelBottom, LuSquareDot } from "react-icons/lu"
import type { HardwareCategory } from "../../core/model"

/**
 * Icona de cada categoria de ferratges (la graella de Preferències › Ferratges i l'«Afegir»), del catàleg d'icones del
 * `CLAUDE.md`: cassoleta, System 32, calaixos, abatible i imants són les de sempre.
 */
export const HARDWARE_ICONS: Record<HardwareCategory, IconType> = {
  hinge: LuCircleDashed,
  plate: LuSquareDot,
  slide: LuArchive,
  lift: LuPanelBottom,
  connector: LuBolt,
  "shelf-support": LuCircleDot,
  leg: LuFootprints,
  handle: LuGripHorizontal,
  push: LuMagnet,
  profile: LuMinus,
  wall: LuAnchor,
  misc: LuPackage,
}
