import { useRef, type Dispatch, type SetStateAction } from "react"
import { toaster } from "../../../components/ui/toaster"
import { fixMaterialRefs, importSettingsJson, settingsToJson, type Settings } from "../../../core/model"
import { downloadText } from "../../../lib/download"
import type { RenameCount } from "../../../db/materialRefs"

/** Exportar les preferències (les vàlides) i importar-les d'un fitxer (el camp de fitxer amagat, `fileInput`). */
export function useSettingsFile(
  draft: Settings,
  setDraft: Dispatch<SetStateAction<Settings>>,
  valid: Settings | undefined,
  cascade: (renames: [string, string][], next: Settings) => Promise<RenameCount>,
) {
  const fileInput = useRef<HTMLInputElement>(null)
  const doExport = () => downloadText(settingsToJson(valid ?? draft), "mobles-preferencies.json", "application/json")
  const doImport = async (file: File | undefined) => {
    if (!file) return
    // Les seccions que el fitxer no porta (p. ex. les màquines, en un fitxer antic) es queden com són.
    const res = importSettingsJson(draft, await file.text())
    if (res.problems.length) {
      toaster.create({ title: "Preferències importades amb avisos", description: res.problems.join(" "), type: "warning", duration: 8000 })
    } else toaster.create({ title: "Preferències importades", type: "success" })
    // Si el fitxer porta materials però no els per defecte, que no apuntin a un material que ja no hi és.
    setDraft(fixMaterialRefs(res.settings))
    // Un fitxer d'abans de la v12 porta «Melamina 19», «DM 10» o «Pi»: els mobles desats segueixen el nom nou.
    if (res.renames?.length) void cascade(res.renames, res.settings)
    if (fileInput.current) fileInput.current.value = ""
  }
  return { fileInput, doExport, doImport }
}
