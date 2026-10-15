import type { IconType } from "react-icons"
import { LuBox, LuCookingPot, LuContainer, LuPuzzle, LuSofa, LuTable } from "react-icons/lu"
import type { CompositionKind } from "../../core/model"

/** Tipus de moble, amb icona i el que aporta cadascun (etiqueta de les targetes, cerca i «Nou moble»). */
export const KINDS: { value: CompositionKind; label: string; icon: IconType; hint: string }[] = [
  { value: "moble", label: "Moble", icon: LuBox, hint: "Mòduls: TV, calaixera, prestatgeria…" },
  { value: "cuina", label: "Cuina", icon: LuCookingPot, hint: "Baixos a terra i alts penjats" },
  { value: "armari", label: "Armari", icon: LuContainer, hint: "Mòduls alts de terra a sostre" },
  { value: "taula", label: "Taula", icon: LuTable, hint: "Tauler i laterals de panell, sense caixa" },
  // Ja no es crea (el Flat-pack és l'opció «Encaixos» de les peces lliures); els d'abans continuen igual.
  { value: "lliure", label: "Peces lliures", icon: LuPuzzle, hint: "Només peces lliures, sense mòduls" },
  { value: "objecte", label: "Objecte", icon: LuSofa, hint: "Objecte per als ambients (sofà, làmpada, planta…): peces amb forma, booleanes i textures; no es fabrica" },
]
