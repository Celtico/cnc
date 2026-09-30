import {
  Button,
  Dialog,
  HStack,
  Heading,
  Portal,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useRef, useState } from "react"
import { LuFolderOpen, LuLayoutTemplate, LuTrash2 } from "react-icons/lu"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { addMobleAsTemplate, openMobleFile } from "../file/mobleIo"
import { parseMobleFile, uniqueName, type MobleFile } from "../../core/file/mobleFile"
import { NewMobleGallery } from "./NewMobleGallery"
import { GALLERY_COLS } from "./galleryGrid"
import { ProjectCard } from "./ProjectCard"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import { compositionKind, type Composition } from "../../core/model"
import { createProject, db, deleteProject, duplicateProject, type Project } from "../../db/db"
import { compositionOf } from "../../db/compositionStore"
import { useProjects } from "../useProject"
import { useSettings } from "../settings/SettingsContext"
import { toaster } from "../../components/ui/toaster"
import { fileAccept } from "../file/fileAccept"

/** Acció demanada des del menú de l'esquerra (Obrir fitxer); `n` la fa única. */
export type ProjectsRequest = { kind: "open"; n: number } | null

export function ProjectsScreen({ onOpen, request = null, onRequestDone }: { onOpen: (id: number) => void; request?: ProjectsRequest; onRequestDone?: () => void }) {
  const projects = useProjects()
  const membership = useAmbientMembership()
  const { settings, save } = useSettings()
  const [toDelete, setToDelete] = useState<Project | null>(null)
  const [toSave, setToSave] = useState<Project | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Botó del menú de l'esquerra: obre el selector de fitxers.
  const handled = useRef<number | null>(null)
  useEffect(() => {
    if (!request || handled.current === request.n) return
    handled.current = request.n
    // Es consumeix: si no, en tornar a la llista (la pantalla es torna a muntar) es
    // tornaria a obrir la finestra de fitxers.
    onRequestDone?.()
    fileInput.current?.click()
  }, [request, onRequestDone])
  // Fitxer obert pendent de decidir: moble nou o plantilla.
  const [pendingFile, setPendingFile] = useState<{ text: string; file: MobleFile } | null>(null)

  const handleOpenFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = ""
    if (!file) return
    const text = await file.text()
    const res = parseMobleFile(text)
    if (!res.ok) {
      toaster.create({ title: "No s'ha pogut obrir el fitxer", description: res.error, type: "error" })
      return
    }
    setPendingFile({ text, file: res.file })
  }

  const openAsMoble = async () => {
    if (!pendingFile) return
    const res = await openMobleFile(pendingFile.text, settings, save)
    setPendingFile(null)
    if (!res.ok) {
      toaster.create({ title: "No s'ha pogut obrir el fitxer", description: res.error, type: "error" })
      return
    }
    toaster.create({ title: `«${res.name}» obert`, description: res.warnings.join(" ") || undefined, type: res.warnings.length ? "warning" : "success", duration: res.warnings.length ? 8000 : undefined })
    onOpen(res.projectId)
  }

  const addAsTemplate = async () => {
    if (!pendingFile) return
    const r = await addMobleAsTemplate(pendingFile.file, settings, save)
    setPendingFile(null)
    toaster.create({ title: `«${r.name}» afegida a les plantilles`, description: [...r.warnings, "La trobaràs a Mobles › Les teves plantilles."].join(" "), type: "success" })
  }

  /** Crea un moble a partir d'una composició (en blanc o de plantilla) i l'obre. */
  const handleCreate = async (composition: Composition, name: string) => {
    const existing = (await db.projects.toArray()).map((p) => p.name)
    const id = await createProject(uniqueName(name, existing), undefined, { composition })
    onOpen(id)
  }

  const handleDuplicate = async (id: number) => {
    const newId = await duplicateProject(id)
    if (newId !== undefined) toaster.create({ title: "Moble duplicat", type: "success" })
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    await deleteProject(toDelete.id)
    toaster.create({ title: `«${toDelete.name}» esborrat`, type: "info" })
    setToDelete(null)
  }

  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Mobles</Heading>
        <input ref={fileInput} type="file" accept={fileAccept(".moble,.json,application/json")} hidden onChange={(e) => void handleOpenFile(e.target.files?.[0])} />
        {/* A l'ordinador és al menú de l'esquerra; al mòbil, aquí. */}
        <Button display={{ base: "flex", md: "none" }} variant="outline" onClick={() => fileInput.current?.click()}>
          <LuFolderOpen /> Obrir fitxer
        </Button>
      </HStack>

      <NewMobleGallery
        onCreate={(c, n) => void handleCreate(c, n)}
        history={(kind, matches) => {
          const shown = (projects ?? []).filter((p) => (kind === "all" || compositionKind(compositionOf(p)) === kind) && matches(p.name))
          return {
            count: shown.length,
            node:
              shown.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  {projects?.length ? "Cap moble no coincideix amb el tipus o la cerca." : "Encara no tens cap moble: comença en blanc o des d'una plantilla."}
                </Text>
              ) : (
                <SimpleGrid columns={GALLERY_COLS} gap={3}>
                  {shown.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onOpen={() => onOpen(p.id)}
                      onDuplicate={() => handleDuplicate(p.id)}
                      onDelete={() => setToDelete(p)}
                      onSaveFile={() => setToSave(p)}
                      ambients={membership.get(p.id)}
                    />
                  ))}
                </SimpleGrid>
              ),
          }
        }}
      />

      <SaveFileDialog project={toSave} open={toSave !== null} onClose={() => setToSave(null)} />

      <Dialog.Root open={pendingFile !== null} onOpenChange={(e) => !e.open && setPendingFile(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Obrir «{pendingFile?.file.project.name}»</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>
                  {pendingFile?.file.kind === "plantilla"
                    ? "Aquest fitxer és una plantilla. La vols afegir a les teves plantilles o obrir-la com a moble?"
                    : "Vols obrir-lo com a moble nou o afegir-lo a les teves plantilles?"}
                </Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setPendingFile(null)}>
                  Cancel·lar
                </Button>
                <Button variant={pendingFile?.file.kind === "plantilla" ? "outline" : "solid"} colorPalette="wood" onClick={() => void openAsMoble()}>
                  <LuFolderOpen /> Obrir com a moble
                </Button>
                <Button variant={pendingFile?.file.kind === "plantilla" ? "solid" : "outline"} colorPalette="wood" onClick={() => void addAsTemplate()}>
                  <LuLayoutTemplate /> Afegir a plantilles
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        role="alertdialog"
        open={toDelete !== null}
        onOpenChange={(e) => {
          if (!e.open) setToDelete(null)
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar «{toDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Aquesta acció no es pot desfer.</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setToDelete(null)}>
                  Cancel·lar
                </Button>
                <Button colorPalette="red" onClick={confirmDelete}>
                  <LuTrash2 /> Esborrar
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  )
}
