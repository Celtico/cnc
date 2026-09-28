import {
  Button,
  Card,
  Dialog,
  EmptyState,
  HStack,
  Heading,
  IconButton,
  Portal,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import { LuBox, LuCopy, LuPlus, LuTrash2 } from "react-icons/lu"
import { applySettingsToModule, defaultModule, newId } from "../../core/model"
import { createProject, deleteProject, duplicateProject, safeParams, type Project } from "../../db/db"
import { compositionOf } from "../../db/compositionStore"
import { useProjects } from "../useProject"
import { useSettings } from "../settings/SettingsContext"
import { toaster } from "../../components/ui/toaster"

export function ProjectsScreen({ onOpen }: { onOpen: (id: number) => void }) {
  const projects = useProjects()
  const { settings } = useSettings()
  const [toDelete, setToDelete] = useState<Project | null>(null)

  const handleNew = async () => {
    // El mòdul nou pren materials, ferratges i jocs de les preferències.
    const module = applySettingsToModule(settings, defaultModule(newId("m"), "Mòdul 1"))
    const id = await createProject(undefined, undefined, { composition: { modules: [module], references: [] } })
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
        <Button colorPalette="wood" onClick={handleNew}>
          <LuPlus /> Nou mòdul
        </Button>
      </HStack>

      {projects === undefined ? null : projects.length === 0 ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <LuBox />
            </EmptyState.Indicator>
            <VStack textAlign="center">
              <EmptyState.Title>Encara no tens cap moble</EmptyState.Title>
              <EmptyState.Description>
                Crea un mòdul de caixa i ajusta'n les mides, prestatges i portes.
              </EmptyState.Description>
            </VStack>
            <Button colorPalette="wood" onClick={handleNew}>
              <LuPlus /> Crear el primer mòdul
            </Button>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => onOpen(p.id)}
              onDuplicate={() => handleDuplicate(p.id)}
              onDelete={() => setToDelete(p)}
            />
          ))}
        </SimpleGrid>
      )}

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

function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const p = safeParams(project.params)
  const comp = compositionOf(project)
  const first = comp.modules[0]!.carcass
  const width = comp.modules.reduce((s, m) => s + m.gapBefore + m.carcass.width, 0)
  const height = Math.max(...comp.modules.map((m) => m.carcass.height))
  const date = new Date(project.updatedAt).toLocaleDateString("ca-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  return (
    <Card.Root variant="outline">
      <Card.Body gap={1} cursor="pointer" onClick={onOpen}>
        <Card.Title>{project.name}</Card.Title>
        <Text color="fg.muted" fontSize="sm">
          {width} × {height} × {first.depth} mm
        </Text>
        <Text color="fg.muted" fontSize="sm">
          {comp.modules.length === 1
            ? `1 mòdul · ${first.material}`
            : `${comp.modules.length} mòduls: ${comp.modules.map((m) => m.name).join(", ")}`}
          {!project.composition && ` · ${p.shelves} ${p.shelves === 1 ? "prestatge" : "prestatges"} · ${p.doors} ${p.doors === 1 ? "porta" : "portes"}`}
        </Text>
        <Text color="fg.subtle" fontSize="xs">
          Modificat el {date}
        </Text>
      </Card.Body>
      <Card.Footer justifyContent="flex-end" gap={2}>
        <IconButton aria-label="Duplicar moble" variant="ghost" onClick={onDuplicate}>
          <LuCopy />
        </IconButton>
        <IconButton aria-label="Esborrar moble" variant="ghost" colorPalette="red" onClick={onDelete}>
          <LuTrash2 />
        </IconButton>
        <Button size="sm" colorPalette="wood" onClick={onOpen}>
          Obrir
        </Button>
      </Card.Footer>
    </Card.Root>
  )
}
