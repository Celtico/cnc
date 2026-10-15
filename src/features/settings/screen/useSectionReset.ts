import { useState, type Dispatch, type SetStateAction } from "react"
import { toaster } from "../../../components/ui/toaster"
import { DEFAULT_SETTINGS, defaultMachineRules, fixMaterialRefs, type Settings } from "../../../core/model"
import type { SectionKey } from "./useSettingsDraft"

/** La secció que es vol restaurar (el diàleg de confirmació és obert mentre n'hi ha una). */
export interface SectionReset {
  key: SectionKey
  label: string
  note?: string
}

/** «Restaurar valors inicials» d'una secció: quina es demana i, en confirmar-ho, l'esborrany amb els valors inicials. */
export function useSectionReset(setDraft: Dispatch<SetStateAction<Settings>>) {
  const [reset, setReset] = useState<SectionReset | null>(null)
  const confirmReset = () => {
    if (!reset) return
    const key = reset.key
    // Regles de mecanitzat: `defaultMachineRules()` (les del taller), com la resta de seccions.
    // Després, les referències a materials que ja no hi són (per defecte, mides de tauler) es corregeixen.
    // Ferratges: la biblioteca i els per defecte de cada lloc, junts.
    setDraft((d) => fixMaterialRefs({ ...d, [key]: key === "machiningRules" ? defaultMachineRules() : structuredClone(DEFAULT_SETTINGS[key]), ...(key === "hardwareLibrary" ? { hardwareDefaults: structuredClone(DEFAULT_SETTINGS.hardwareDefaults) } : {}) }))
    toaster.create({ title: `«${reset.label}» restaurat`, type: "info" })
    setReset(null)
  }
  return { reset, setReset, confirmReset }
}
