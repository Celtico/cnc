import { useEffect } from "react"
import { toaster } from "../components/ui/toaster"
import { migrateUserTemplates } from "../db/compositionStore"

/** Les antigues «teves plantilles» passen a mobles del grup «Les meves plantilles» (un sol cop). */
export function useTemplateMigration() {
  useEffect(() => {
    void migrateUserTemplates().then((n) => {
      if (n) toaster.create({ title: `${n === 1 ? "1 plantilla teva" : `${n} plantilles teves`} a Projectes`, description: "Ara són mobles del grup «Les meves plantilles» (Mobles › Projectes).", type: "info", duration: 8000 })
    })
  }, [])
}
