import { Button, Dialog, Portal, Text, VStack } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuTrash2 } from "react-icons/lu"
import { toaster } from "../../components/ui/toaster"
import { uniqueName } from "../../core/file/mobleFile"
import type { Composition } from "../../core/model"
import { ClearHistory } from "../projects/ClearHistory"
import { blankObject } from "../projects/blank"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { OpenFileButton } from "../file/OpenFileButton"
import { showAmbient } from "../file/openAnyFile"
import { FolderedGrid, MoveToFolderDialog } from "../projects/Folders"
import { createProject, db, deleteProject, isEdited, setProjectsFolder, duplicateProject, type Project } from "../../db/db"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import { ProjectCard } from "../projects/ProjectCard"
import { useProjects } from "../useProject"
import { ObjectsGallery } from "./ObjectsGallery"
import { isObject } from "./isObject"
import { PageHeader } from "../../components/PageHeader"
import { projectSearchText } from "../projects/searchText"

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
    onOpen(await createProject(uniqueName(name, existing), undefined, { composition, draft: true }))
  }
  return (
    <VStack align="stretch" gap={5}>
      <PageHeader
        title="Objectes"
        description="Sofàs, llits, làmpades, plantes… per col·locar als ambients. Es fan com un moble flat-pack (peces amb forma, «Talla» per als forats i materials de simulació), però només es veuen: no es fabriquen."
      />
      <ObjectsGallery
        onCreate={(c, n) => void create(c, n)}
        add={{ label: "Nou objecte", onClick: () => void create(blankObject(), "Objecte nou") }}
        // Com a Mobles: un .moble que no és un objecte s'obre igualment (com a moble, i ho diu), i un .ambient, a Ambients.
        extra={<OpenFileButton page="objecte" onOpened={(o) => (o.kind === "ambient" ? showAmbient(o.ambientId) : onOpen(o.projectId))} />}
        history={(matches, searching) => {
          const shown = (projects ?? []).filter((p) => isObject(p) && (!searching || matches(projectSearchText(p))))
          // Historial = el que és de pas (sense grup); el que es desa en un grup passa a Projectes.
          const loose = shown.filter((p) => !p.folder)
          const grouped = shown.filter((p) => p.folder)
          const free = loose.filter((p) => !membership.has(p.id))
          const grid = (show: "folders" | "loose", list: typeof shown, toolbar?: ReactNode) => (
            <FolderedGrid
              show={show}
              items={list}
              folderOf={(p) => p.folder}
              keyOf={(p) => p.id}
              storageKey="mobles:folders-objects"
              toolbar={toolbar}
              selection={{
                noun: ["objecte", "objectes"],
                folders: [...new Set((projects ?? []).filter((p) => isObject(p) && p.folder).map((p) => p.folder!))].sort(),
                onMove: (ids, f) => void setProjectsFolder(ids as number[], f),
                onDelete: async (ids) => {
                  // Els que són en algun ambient es conserven (si no, l'ambient perdria l'objecte).
                  const del = (ids as number[]).filter((id) => !membership.has(id))
                  for (const id of del) await deleteProject(id)
                  const kept = ids.length - del.length
                  toaster.create({ title: del.length === 1 ? "1 esborrat" : `${del.length} esborrats`, description: kept ? `Es conserven els ${kept} que són en algun ambient.` : undefined, type: "info" })
                },
              }}
              searching={searching}
              onRenameFolder={(from, to) => void setProjectsFolder((projects ?? []).filter((p) => p.folder === from).map((p) => p.id), to)}
              onUngroup={(name) => void setProjectsFolder((projects ?? []).filter((p) => isObject(p) && p.folder === name).map((p) => p.id), undefined)}
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
          )
          return {
            count: loose.length,
            node: loose.length ? (
              grid(
                "loose",
                loose,
                <ClearHistory
                  count={free.length}
                  kept={loose.length - free.length}
                  noun={["objecte", "objectes"]}
                  keptNote="Es conserven els {n} que són en algun ambient. Els dels Projectes no es toquen."
                  edited={free.filter(isEdited).map((p) => p.name)}
                  onConfirm={async () => {
                    for (const p of free) await deleteProject(p.id)
                    toaster.create({ title: "Historial esborrat", description: "Els dels Projectes es conserven.", type: "info" })
                  }}
                  onConfirmUnedited={async () => {
                    for (const p of free.filter((x) => !isEdited(x))) await deleteProject(p.id)
                    toaster.create({ title: "Historial esborrat", description: "Els modificats i els dels Projectes es conserven.", type: "info" })
                  }}
                />,
              )
            ) : (
              <Text fontSize="sm" color="fg.muted">
                {shown.length ? "L'historial és buit: el que tens és a Projectes." : projects?.some(isObject) ? "Cap objecte no coincideix amb la cerca." : "Encara no en tens: comença en blanc o des d'una plantilla."}
              </Text>
            ),
            projects: {
              count: grouped.length,
              node: grouped.length ? (
                grid("folders", grouped)
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Encara no n'hi ha cap. A l'Historial, «Grup nou» o el menú ⋯ d'un objecte › «Moure a un grup…»: el que hi desis queda aquí i «Esborrar» de l'Historial no el toca.
                </Text>
              ),
            },
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
                <Text>
                  {toDelete && membership.get(toDelete.id)?.length
                    ? `És a ${membership.get(toDelete.id)!.map((a) => `«${a.name}»`).join(", ")}: hi sortirà com a «Element esborrat». No es pot desfer.`
                    : "Aquesta acció no es pot desfer."}
                </Text>
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
