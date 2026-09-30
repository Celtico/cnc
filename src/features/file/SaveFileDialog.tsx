import { Button, Dialog, Portal, Stack, Switch, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { LuSave } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { mobleFileName } from "../../core/file/mobleFile"
import type { Project } from "../../db/db"
import { useSettings } from "../settings/SettingsContext"
import { mobleBlob, projectToMoble, saveProjectAsFile } from "./mobleIo"

/** Diàleg "Desar com a fitxer": tria si s'inclou la foto i mostra la mida resultant. */
export function SaveFileDialog({ project, open, onClose }: { project: Project | null; open: boolean; onClose: () => void }) {
  const { settings } = useSettings()
  const [includePhoto, setIncludePhoto] = useState(true)
  const [bytes, setBytes] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const hasPhoto = !!project?.photo

  useEffect(() => {
    if (!open || !project) return
    let alive = true
    setBytes(null)
    void projectToMoble(project, settings, includePhoto && hasPhoto).then((f) => {
      if (alive) setBytes(mobleBlob(f).size)
    })
    return () => {
      alive = false
    }
  }, [open, project, settings, includePhoto, hasPhoto])

  const save = async () => {
    if (!project) return
    setBusy(true)
    try {
      const r = await saveProjectAsFile(project, settings, includePhoto && hasPhoto)
      toaster.create({ title: r.how === "shared" ? "Fitxer compartit" : "Fitxer desat", description: `${r.filename} · ${fmtBytes(r.bytes)}`, type: "success" })
      onClose()
    } catch (e) {
      toaster.create({ title: "No s'ha pogut desar el fitxer", description: String(e), type: "error" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Desar «{project?.name}» com a fitxer</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Text fontSize="sm" color="fg.muted">
                  Fitxer {project ? mobleFileName(project.name) : ""}: composició, nesting, calibratge de la foto i les referències que fa servir.
                  Es pot obrir des de «Mobles › Obrir fitxer» en aquest o en un altre dispositiu.
                </Text>
                <Switch.Root size="sm" checked={includePhoto && hasPhoto} disabled={!hasPhoto} onCheckedChange={(e) => setIncludePhoto(e.checked)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label>Incloure la foto{hasPhoto ? "" : " (el moble no en té)"}</Switch.Label>
                </Switch.Root>
                <Text fontSize="sm">Mida del fitxer: {bytes === null ? "calculant…" : fmtBytes(bytes)}</Text>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" onClick={() => void save()} loading={busy}>
                <LuSave /> Desar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
