import { Button, Dialog, Field, Input, Portal, Text } from "@chakra-ui/react"
import { useState } from "react"
import { LuBookmark } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { compositionOf, saveUserTemplate } from "../../db/compositionStore"
import type { Project } from "../../db/db"

/** «Desar com a plantilla»: demana el nom i desa la composició actual del moble. */
export function SaveTemplateDialog({ project, open, onClose }: { project: Project | null; open: boolean; onClose: () => void }) {
  const [name, setName] = useState("")
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setName(project?.name ?? "")
  }
  const save = () => {
    if (!project) return
    saveUserTemplate(name.trim() || project.name, structuredClone(compositionOf(project)))
    toaster.create({ title: "Plantilla desada", description: "La trobaràs a Mobles › Les teves plantilles.", type: "success" })
    onClose()
  }
  return (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && onClose()} initialFocusEl={() => document.getElementById("template-name")}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Desar com a plantilla</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root>
                <Field.Label>Nom de la plantilla</Field.Label>
                <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
              </Field.Root>
              <Text fontSize="sm" color="fg.muted" mt={3}>
                Es desa la composició tal com és ara (mòduls, compartiments i objectes de referència). El moble no canvia.
              </Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={onClose}>
                Cancel·lar
              </Button>
              <Button colorPalette="wood" onClick={save}>
                <LuBookmark /> Desar
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
