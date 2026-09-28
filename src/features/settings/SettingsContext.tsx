import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { DEFAULT_SETTINGS, type Settings } from "../../core/model"
import { currentSettings, loadSettings, saveSettings } from "../../db/settingsStore"
import { useLiveQuery } from "../../db/useLiveQuery"
import { toaster } from "../../components/ui/toaster"

interface SettingsCtx {
  settings: Settings
  /** Encara no s'han llegit de Dexie: els valors són els inicials. */
  loading: boolean
  save: (next: Settings) => Promise<void>
}

const Ctx = createContext<SettingsCtx>({ settings: DEFAULT_SETTINGS, loading: true, save: async () => {} })

/** Carrega les preferències una vegada (creant-les si no hi són) i les manté al dia. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    void loadSettings().then(({ problems }) => {
      setReady(true)
      if (problems.length) {
        toaster.create({ title: "Preferències amb problemes", description: problems.join(" "), type: "warning", duration: 8000 })
      }
    })
  }, [])
  const live = useLiveQuery(() => (ready ? currentSettings() : undefined), [ready])
  const settings = live ?? DEFAULT_SETTINGS
  return <Ctx.Provider value={{ settings, loading: !ready || live === undefined, save: saveSettings }}>{children}</Ctx.Provider>
}

export function useSettings(): SettingsCtx {
  return useContext(Ctx)
}
