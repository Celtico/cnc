import { Text, VStack } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { OpenFileButton } from "../file/OpenFileButton"
import { showAmbient } from "../file/openAnyFile"
import { uniqueName } from "../../core/file/mobleFile"
import { NewMobleGallery } from "./NewMobleGallery"
import { ProjectCard } from "./ProjectCard"
import { isObject } from "../objects/isObject"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import type { Composition } from "../../core/model"
import { ClearHistory } from "./ClearHistory"
import { blankMoble, NEW_MOBLE_NAMES } from "./blank"
import { FolderedGrid, MoveToFolderDialog } from "./Folders"
import { createProject, db, deleteProject, isEdited, setProjectsFolder, duplicateProject, type Project } from "../../db/db"
import { useProjects } from "../useProject"
import { toaster } from "../../components/ui/toaster"
import { PageHeader } from "../../components/PageHeader"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { projectSearchText } from "./searchText"

/** Acció demanada des del menú de l'esquerra (Obrir fitxer); `n` la fa única. */
export type ProjectsRequest = { kind: "open"; n: number } | null

export function ProjectsScreen({ onOpen, request = null, onRequestDone }: { onOpen: (id: number) => void; request?: ProjectsRequest; onRequestDone?: () => void }) {
  const projects = useProjects()
  const membership = useAmbientMembership()
  const [toDelete, setToDelete] = useState<Project | null>(null)
  const [toSave, setToSave] = useState<Project | null>(null)
  const [toMove, setToMove] = useState<Project | null>(null)
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
  /** Crea un moble a partir d'una composició (en blanc o de plantilla) i l'obre. */
  const handleCreate = async (composition: Composition, name: string) => {
    const existing = (await db.projects.toArray()).map((p) => p.name)
    // Esborrany: si no s'hi canvia res, no queda a l'Historial (`Project.draft`).
    const id = await createProject(uniqueName(name, existing), undefined, { composition, draft: true })
    onOpen(id)
  }

  const handleDuplicate = async (id: number) => {
    const newId = await duplicateProject(id)
    if (newId !== undefined) toaster.create({ title: "Moble duplicat", type: "success" })
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    const { id, name } = toDelete
    setToDelete(null)
    await deleteProject(id)
    toaster.create({ title: `«${name}» esborrat`, type: "info" })
  }

  return (
    <VStack align="stretch" gap={5}>
      {/* Accions de l'apartat a la seva capçalera (no al menú global), com a les apps professionals. */}
      <PageHeader
        title="Mobles"
        description="Els mobles que dissenyes i fabriques: comença en blanc, des del catàleg o des d'una col·lecció i continua'l a l'editor. A l'historial hi tens els que ja has fet; el cercador busca a tot arreu (nom, tipus, estil, material, color)."
      />

      <NewMobleGallery
        onCreate={(c, n) => void handleCreate(c, n)}
        // El botó principal al costat del cercador (com a Ambients i Objectes) i «Obrir fitxer» a la mateixa fila.
        // «Nou moble» crea directament un moble en blanc (per decisió de l'usuari, sense menú de tipus).
        add={{ label: "Nou moble", onClick: () => void handleCreate(blankMoble("moble"), NEW_MOBLE_NAMES.moble) }}
        // Un .moble (també les plantilles exportades abans) s'obre sempre com a moble; un objecte o un .ambient, com el que són.
        extra={<OpenFileButton page="moble" inputRef={fileInput} onOpened={(o) => (o.kind === "ambient" ? showAmbient(o.ambientId) : onOpen(o.projectId))} />}
        history={(matches, searching) => {
          const shown = (projects ?? []).filter((p) => !isObject(p) && (!searching || matches(projectSearchText(p))))
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
              storageKey="mobles:folders-projects"
              toolbar={toolbar}
              selection={{
                noun: ["moble", "mobles"],
                folders: [...new Set((projects ?? []).filter((p) => !isObject(p) && p.folder).map((p) => p.folder!))].sort(),
                onMove: (ids, f) => void setProjectsFolder(ids as number[], f),
                onDelete: async (ids) => {
                  // Els que són en algun ambient es conserven (si no, l'ambient perdria el moble).
                  const del = (ids as number[]).filter((id) => !membership.has(id))
                  for (const id of del) await deleteProject(id)
                  const kept = ids.length - del.length
                  toaster.create({ title: del.length === 1 ? "1 esborrat" : `${del.length} esborrats`, description: kept ? `Es conserven els ${kept} que són en algun ambient.` : undefined, type: "info" })
                },
              }}
              searching={searching}
              // Tot el grup, no només el que es veu amb la cerca (també els objectes del mateix client).
              onRenameFolder={(from, to) => void setProjectsFolder((projects ?? []).filter((p) => p.folder === from).map((p) => p.id), to)}
              onUngroup={(name) => void setProjectsFolder((projects ?? []).filter((p) => !isObject(p) && p.folder === name).map((p) => p.id), undefined)}
              render={(p) => (
                <ProjectCard
                  project={p}
                  onOpen={() => onOpen(p.id)}
                  onDuplicate={() => handleDuplicate(p.id)}
                  onDelete={() => setToDelete(p)}
                  onSaveFile={() => setToSave(p)}
                  onMove={() => setToMove(p)}
                  ambients={membership.get(p.id)}
                />
              )}
            />
          )
          return {
            count: loose.length,
            node:
              loose.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  {shown.length ? "L'historial és buit: el que tens és a Projectes." : projects?.length ? "Cap moble no coincideix amb la cerca." : "Encara no tens cap moble: comença en blanc o des del catàleg."}
                </Text>
              ) : (
                grid(
                  "loose",
                  loose,
                  <ClearHistory
                    count={free.length}
                    kept={loose.length - free.length}
                    noun={["moble", "mobles"]}
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
              ),
            projects: {
              count: grouped.length,
              node: grouped.length ? (
                grid("folders", grouped)
              ) : (
                <Text fontSize="sm" color="fg.muted">
                  Encara no n'hi ha cap. A l'Historial, «Grup nou» o el menú ⋯ d'un moble › «Moure a un grup…» (p. ex. el nom d'un client): el que hi desis queda aquí i «Esborrar» de l'Historial no el toca.
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
        folders={[...new Set((projects ?? []).filter((p) => !isObject(p) && p.folder).map((p) => p.folder!))].sort()}
        current={toMove?.folder}
        onPick={(f) => toMove && void setProjectsFolder([toMove.id], f)}
        onClose={() => setToMove(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Esborrar «${toDelete?.name ?? ""}»?`}
        body={toDelete && membership.get(toDelete.id)?.length ? `És a ${membership.get(toDelete.id)!.map((a) => `«${a.name}»`).join(", ")}: hi sortirà com a «Element esborrat». No es pot desfer.` : "No es pot desfer."}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </VStack>
  )
}
