import type { IconType } from "react-icons"
import { LuBox, LuCookingPot, LuDoorClosed, LuTable } from "react-icons/lu"
import type { CompositionKind } from "../../core/model"

/** Tipus de moble, amb icona i el que aporta cadascun (per a la galeria i l'inspector). */
export const KINDS: { value: CompositionKind; label: string; icon: IconType; hint: string }[] = [
  { value: "moble", label: "Moble", icon: LuBox, hint: "Moble: mòduls lliures (TV, calaixera, prestatgeria…)" },
  { value: "cuina", label: "Cuina", icon: LuCookingPot, hint: "Cuina: baixos i alts amb taulell i sòcol correguts" },
  { value: "armari", label: "Armari", icon: LuDoorClosed, hint: "Armari: mòduls alts de terra a sostre" },
  { value: "taula", label: "Taula", icon: LuTable, hint: "Taula o consola: tauler i laterals de panell, sense caixa" },
]
