import { useEffect, useRef } from "react"
import { toaster } from "../../components/ui/toaster"
import { useSettings } from "../settings/SettingsContext"
import { openMobleFile } from "./mobleIo"

/** API de llançament de fitxers de la PWA (Chromium): `file_handlers` del manifest. */
interface LaunchParams {
  files?: readonly FileSystemFileHandle[]
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void
}

/**
 * Obrir un `.moble` amb doble clic (o «Obre amb» Mobles): el sistema obre l'app instal·lada i li passa el fitxer
 * per la `launchQueue`. Es fa el mateix que «Obrir fitxer» de Mobles (crear el moble i obrir-lo). Els fitxers que
 * arriben abans que es carreguin les preferències s'esperen.
 */
export function useLaunchFiles(onOpen: (projectId: number) => void) {
  const { settings, save, loading } = useSettings()
  const pending = useRef<FileSystemFileHandle[]>([])
  const ready = useRef<() => void>(() => {})
  const latest = useRef({ settings, save, onOpen })
  latest.current = { settings, save, onOpen }

  useEffect(() => {
    const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue
    if (!queue) return
    queue.setConsumer((params) => {
      if (!params.files?.length) return
      pending.current.push(...params.files)
      ready.current()
    })
  }, [])

  useEffect(() => {
    if (loading) return
    const run = async () => {
      while (pending.current.length) {
        const handle = pending.current.shift()!
        try {
          const file = await handle.getFile()
          const { settings: s, save: sv, onOpen: open } = latest.current
          const res = await openMobleFile(await file.text(), s, sv)
          if (!res.ok) {
            toaster.create({ title: `No s'ha pogut obrir «${file.name}»`, description: res.error, type: "error" })
            continue
          }
          toaster.create({ title: `«${res.name}» obert`, description: res.warnings.join(" ") || undefined, type: res.warnings.length ? "warning" : "success", duration: res.warnings.length ? 8000 : undefined })
          open(res.projectId)
        } catch (e) {
          toaster.create({ title: "No s'ha pogut obrir el fitxer", description: String(e), type: "error" })
        }
      }
    }
    ready.current = () => void run()
    void run()
    return () => {
      ready.current = () => {}
    }
  }, [loading])
}
