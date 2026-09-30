import { Button, Dialog, Heading, HStack, Portal, SimpleGrid, Text, VStack } from "@chakra-ui/react"
import { useState } from "react"
import { LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import type { Composition } from "../../core/model"
import { createProject, db, deleteProject, duplicateProject, type Project } from "../../db/db"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import { ProjectCard } from "../projects/ProjectCard"
import { GALLERY_COLS } from "../projects/galleryGrid"
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
  const create = async (composition: Composition, name: string) => {
    const existing = (await db.projects.toArray()).map((p) => p.name)
    onOpen(await createProject(uniqueName(name, existing), undefined, { composition }))
  }
  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between">
        <Heading size="xl">Objectes</Heading>
      </HStack>
      <Text fontSize="sm" color="fg.muted" maxW="640px" mt={-3}>
        Sofàs, llits, làmpades, plantes… per col·locar als ambients. Es fan com un moble flat-pack (peces amb forma, «Talla» per als forats i materials de simulació), però només es veuen: no es fabriquen.
      </Text>
      <ObjectsGallery
        onCreate={(c, n) => void create(c, n)}
        history={(matches) => {
          const shown = (projects ?? []).filter((p) => isObject(p) && matches(p.name))
          return {
            count: shown.length,
            node: shown.length ? (
              <SimpleGrid columns={GALLERY_COLS} gap={3}>
                {shown.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    ambients={membership.get(p.id)}
                    onOpen={() => onOpen(p.id)}
                    onDuplicate={() => void duplicateProject(p.id).then(() => toaster.create({ title: "Objecte duplicat", type: "success" }))}
                    onDelete={() => setToDelete(p)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <Text fontSize="sm" color="fg.muted">
                Encara no en tens: comença en blanc o des d'una plantilla.
              </Text>
            ),
          }
        }}
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
