import { IconButton } from "@chakra-ui/react"
import { useRef, type RefObject } from "react"
import { LuFolderOpen } from "react-icons/lu"
import { Tooltip } from "../../components/ui/tooltip"
import { toaster } from "../../components/ui/toaster"
import { useSettings } from "../settings/SettingsContext"
import { fileAccept } from "./fileAccept"
import { openAnyFile, openedNote, type OpenedFile } from "./openAnyFile"

/**
 * «Obrir fitxer» (`LuFolderOpen`) de les galeries Mobles · Objectes · Ambients, a l'`extra` del `SearchBar`: obre un
 * `.moble`, un `.ambient` o un `.taulell` com el que és (`openAnyFile`) i, si no és de la pàgina (`page`), ho diu al missatge.
 * `inputRef`: per obrir el selector des de fora.
 */
export function OpenFileButton({ page, onOpened, inputRef }: { page: "moble" | "objecte" | "ambient"; onOpened: (opened: Exclude<OpenedFile, { ok: false }>) => void; inputRef?: RefObject<HTMLInputElement | null> }) {
  const { settings, save } = useSettings()
  const own = useRef<HTMLInputElement>(null)
  const input = inputRef ?? own
  const open = async (file: File | undefined) => {
    if (input.current) input.current.value = ""
    if (!file) return
    try {
      const res = await openAnyFile(await file.text(), settings, save)
      if (!res.ok) {
        toaster.create({ title: "No s'ha pogut obrir el fitxer", description: res.error, type: "error" })
        return
      }
      const note = openedNote(res, page)
      const description = [note, ...res.warnings].filter(Boolean).join(" ")
      toaster.create({ title: `«${res.name}» obert`, description: description || undefined, type: res.warnings.length ? "warning" : note ? "info" : "success", duration: res.warnings.length ? 8000 : undefined })
      onOpened(res)
    } catch (e) {
      toaster.create({ title: "No s'ha pogut obrir el fitxer", description: e instanceof Error ? e.message : String(e), type: "error" })
    }
  }
  return (
    <>
      <input ref={input} type="file" accept={fileAccept(".moble,.ambient,.taulell,.json,application/json")} hidden onChange={(e) => void open(e.target.files?.[0])} />
      <Tooltip content="Obrir fitxer">
        <IconButton size="sm" variant="outline" flexShrink={0} aria-label="Obrir fitxer" onClick={() => input.current?.click()}>
          <LuFolderOpen />
        </IconButton>
      </Tooltip>
    </>
  )
}
