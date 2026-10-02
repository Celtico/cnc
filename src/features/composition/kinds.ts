import type { IconType } from "react-icons"
import { LuBox, LuCookingPot, LuContainer, LuPuzzle, LuSofa, LuTable } from "react-icons/lu"
import type { CompositionKind } from "../../core/model"

/** Tipus de moble, amb icona i el que aporta cadascun (per a la galeria i l'inspector). */
export const KINDS: { value: CompositionKind; label: string; icon: IconType; hint: string }[] = [
  { value: "moble", label: "Moble", icon: LuBox, hint: "Moble: mòduls lliures (TV, calaixera, prestatgeria…)" },
  { value: "cuina", label: "Cuina", icon: LuCookingPot, hint: "Cuina: baixos i alts amb taulell i sòcol correguts" },
  { value: "armari", label: "Armari", icon: LuContainer, hint: "Armari: mòduls alts de terra a sostre" },
  { value: "taula", label: "Taula", icon: LuTable, hint: "Taula o consola: tauler i laterals de panell, sense caixa" },
  { value: "lliure", label: "Flat-pack", icon: LuPuzzle, hint: "Flat-pack: peces lliures amb encaixos (pestanyes, mitja fusta, dits, espigues), sense mòduls" },
  { value: "objecte", label: "Objecte", icon: LuSofa, hint: "Objecte per als ambients (sofà, làmpada, planta…): peces amb forma, booleanes i textures; no es fabrica" },
]

/** Els tipus de moble (secció Tipus de l'inspector del moble): sense els objectes. */
export const MOBLE_KINDS = KINDS.filter((k) => k.value !== "objecte")
