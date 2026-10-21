import type { IconType } from "react-icons"
import { LuDrill, LuInspectionPanel, LuLayers2, LuSquareDashed } from "react-icons/lu"
import type { Carcass } from "../../core/model"

/** Els 4 valors del Fons: el mateix control a Mòdul › Fons i al Fons de cada zona (`ZoneBackSection`). */
export const BACK_OPTIONS: { value: Carcass["back"]; label: string; icon: IconType; hint?: string }[] = [
  { value: "groove", label: "En ranura", icon: LuLayers2, hint: "Fons encaixat en una ranura" },
  { value: "screwed", label: "Cargolat darrere", icon: LuDrill, hint: "Fons cargolat per darrere" },
  { value: "inset", label: "Encastat", icon: LuInspectionPanel, hint: "Fons encastat entre laterals, tapa i base, amb espigues (pot ser del mateix tauler)" },
  { value: "none", label: "Sense fons", icon: LuSquareDashed },
]

export const BACK_LABEL: Record<Carcass["back"], string> = { groove: "En ranura", screwed: "Cargolat", inset: "Encastat", none: "Sense fons" }
