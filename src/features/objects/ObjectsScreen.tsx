import { Button, Dialog, Heading, HStack, Portal, Stack, Text, VStack } from "@chakra-ui/react"
import { useState } from "react"
import { LuPlus, LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import type { Composition } from "../../core/model"
import { ClearHistory } from "../projects/ClearHistory"
import { blankObject } from "../projects/blank"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { FolderedGrid, MoveToFolderDialog } from "../projects/Folders"
import { createProject, db, deleteProject, setProjectsFolder, duplicateProject, type Project } from "../../db/db"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import { ProjectCard } from "../projects/ProjectCard"
import { useProjects } from "../useProject"
import { ObjectsGallery } from "./ObjectsGallery"
import { isObject } from "./isObject"

/**
 * Objectes per als ambients (sofà, làmpada, planta…): es fan amb el mateix Editor que els mobles,
 * només amb peces lliures (forma, booleanes, textures) i no es fabriquen.
 */
export function ObjectsScreen({ onOpen }: { onOpen: (id: number) => void }) {
  const projects = useProjects()
  const membership = useAmbientMembership()
  const [toDelete, setToDelete] = useState<Project | null>(null)
  const [toMove, setToMove] = useState<Project | null>(null)
  const [toSave, setToSave] = useState<Project | null>(null)
  const create = async (composition: Composition, name: string) => {
    const existing = (await db.projects.toArray()).map((p) => p.name)
    onOpen(await createProject(uniqueName(name, existing), undefined, { composition }))
  }
  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between" gap={3}>
        <Heading size="xl">Objectes</Heading>
        <Button colorPalette="wood" size={{ base: "sm", md: "md" }} onClick={() => void create(blankObject(), "Objecte nou")}>
          <LuPlus /> Nou objecte
        </Button>
      </HStack>
      <Text fontSize="sm" color="fg.muted" maxW="640px" mt={-3}>
        Sofàs, llits, làmpades, plantes… per col·locar als ambients. Es fan com un moble flat-pack (peces amb forma, «Talla» per als forats i materials de simulació), però només es veuen: no es fabriquen.
      </Text>
      <ObjectsGallery
        onCreate={(c, n) => void create(c, n)}
        history={(matches, searching) => {
          const shown = (projects ?? []).filter((p) => isObject(p) && matches(p.name))
          const free = shown.filter((p) => !membership.has(p.id))
          return {
            count: shown.length,
            node: shown.length ? (
              <Stack gap={2}>
                <FolderedGrid
                  items={shown}
                  folderOf={(p) => p.folder}
                  keyOf={(p) => p.id}
                  storageKey="mobles:folders-objects"
                  toolbar={
                    <ClearHistory
                      count={free.length}
                      kept={shown.length - free.length}
                      noun={["objecte", "objectes"]}
                      keptNote="Es conserven els {n} que són en algun ambient."
                      onConfirm={async () => {
                        for (const p of free) await deleteProject(p.id)
                        toaster.create({ title: "Historial esborrat", type: "info" })
                      }}
                    />
                  }
                  selection={{
                    noun: ["objecte", "objectes"],
                    folders: [...new Set((projects ?? []).filter((p) => isObject(p) && p.folder).map((p) => p.folder!))].sort(),
                    onMove: (ids, f) => void setProjectsFolder(ids as number[], f),
                    onDelete: async (ids) => {
                      // Els que són en algun ambient es conserven (si no, l'ambient perdria el moble).
                      const del = (ids as number[]).filter((id) => !membership.has(id))
                      for (const id of del) await deleteProject(id)
                      const kept = ids.length - del.length
                      toaster.create({ title: `${del.length} esborrats`, description: kept ? `Es conserven els ${kept} que són en algun ambient.` : undefined, type: "info" })
                    },
                  }}
                  searching={searching}
                  onRenameFolder={(from, to) => void setProjectsFolder(shown.filter((p) => p.folder === from).map((p) => p.id), to)}
                  onUngroup={(name) => void setProjectsFolder(shown.filter((p) => p.folder === name).map((p) => p.id), undefined)}
                  render={(p) => (
                    <ProjectCard
                      project={p}
                      ambients={membership.get(p.id)}
                      onOpen={() => onOpen(p.id)}
                      onDuplicate={() => void duplicateProject(p.id).then(() => toaster.create({ title: "Objecte duplicat", type: "success" }))}
                      onSaveFile={() => setToSave(p)}
                      onMove={() => setToMove(p)}
                      onDelete={() => setToDelete(p)}
                    />
                  )}
                />
              </Stack>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Encara no en tens: comença en blanc o des d'una plantilla.
              </Text>
            ),
          }
        }}
      />
      <SaveFileDialog project={toSave} open={toSave !== null} onClose={() => setToSave(null)} />
      <MoveToFolderDialog
        open={toMove !== null}
        what={toMove?.name ?? ""}
        folders={[...new Set((projects ?? []).filter((p) => isObject(p) && p.folder).map((p) => p.folder!))].sort()}
        current={toMove?.folder}
        onPick={(f) => toMove && void setProjectsFolder([toMove.id], f)}
        onClose={() => setToMove(null)}
      />
      <Dialog.Root role="alertdialog" open={toDelete !== null} onOpenChange={(e) => !e.open && setToDelete(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Esborrar «{toDelete?.name}»?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Text>Als ambients on era, sortirà com a «Moble esborrat».</Text>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="outline" onClick={() => setToDelete(null)}>
                  Cancel·lar
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    if (toDelete) void deleteProject(toDelete.id)
                    setToDelete(null)
                  }}
                >
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
