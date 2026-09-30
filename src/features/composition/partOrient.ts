import type { IconType } from "react-icons"
import { LuPanelLeft, LuRectangleHorizontal, LuRectangleVertical } from "react-icons/lu"
import type { IconOption } from "../../components/IconChoice"
import type { PartOrient } from "../../core/model"

/** Orientacions d'una peça lliure (fitxer apart: així els components es poden refrescar en calent). */
export const ORIENTS: IconOption<PartOrient>[] = [
  { value: "front", label: "De cara", icon: LuRectangleVertical, hint: "De cara: dreta, mirant endavant (fons, travesser, pota de davant)" },
  { value: "side", label: "De costat", icon: LuPanelLeft, hint: "De costat: dreta, de perfil (lateral, divisor, pota de costat)" },
  { value: "flat", label: "Estirada", icon: LuRectangleHorizontal, hint: "Estirada: horitzontal (prestatge, tapa, seient)" },
]
export const ORIENT_ICON: Record<PartOrient, IconType> = { front: LuRectangleVertical, side: LuPanelLeft, flat: LuRectangleHorizontal }
