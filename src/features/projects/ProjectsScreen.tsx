import { Menu, Text, VStack } from "@chakra-ui/react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { SaveFileDialog } from "../file/SaveFileDialog"
import { OpenFileButton } from "../file/OpenFileButton"
import { showAmbient } from "../file/openAnyFile"
import { uniqueName } from "../../core/file/mobleFile"
import { NewMobleGallery } from "./NewMobleGallery"
import { ProjectCard } from "./ProjectCard"
import { isModel, isMoble } from "../modeling/isModel"
import { useAmbientMembership } from "../ambients/useAmbientMembership"
import type { Composition } from "../../core/model"
import { ClearHistory } from "./ClearHistory"
import { blankMoble, NEW_MOBLE_NAMES } from "./blank"
import { KINDS } from "../composition/kinds"
import { FolderedGrid, MoveToFolderDialog } from "./Folders"
import { createProject, db, deleteProject, isEdited, setProjectsFolder, duplicateProject, type Project } from "../../db/db"
import { useProjects } from "../useProject"
import { toaster } from "../../components/ui/toaster"
import { PageHeader } from "../../components/PageHeader"
import { ConfirmDialog } from "../../components/ConfirmDialog"
import { projectSearchText } from "./searchText"

/** Els tipus que es trien a «Nou moble». */
const NEW_MOBLE_TYPES = [
  { kind: "moble", label: "Moble normal", hint: "TV, calaixera, prestatgeria… El suport (a terra, sòcol o potes) es tria a cada mòdul." },
  { kind: "cuina", label: "Cuina", hint: "Baixos a terra i alts penjats. Un sol suport i un sòcol per tram per a tots els mòduls de terra." },
] as const

/** Acció demanada des del menú de l'esquerra (Obrir fitxer); `n` la fa única. */
export type ProjectsRequest = { kind: "open"; n: number } | null

/**
 * Les dues pàgines d'inici que fan mobles: Mobles i Modelatge (cel, 2026-11-07: «l'inici com tenim tots»). Són la mateixa
 * pàgina (Nou, Historial, Projectes, catàleg i Obrir fitxer) i els mobles s'obren al mateix editor; els de Modelatge
 * porten `Project.modeling` i només surten aquí.
 */
const PAGES = {
  mobles: {
    title: "Mobles",
    description: "Els mobles que dissenyes i fabriques: comença en blanc, des del catàleg o des d'una col·lecció i continua'l a l'editor. A l'historial hi tens els que ja has fet; el cercador busca a tot arreu (nom, tipus, estil, material, color).",
    noun: ["moble", "mobles"] as [string, string],
    shows: isMoble,
    extra: {},
    storage: "projects",
    copyTo: "Copiar a Modelatge",
  },
  modelatge: {
    title: "Modelatge",
    description: "Els mòduls que fas a mà, peça a peça: comença en blanc o des d'un moble del catàleg, o obre un projecte del Taulell (.taulell). A Mobles, «Afegir mòdul» hi porta els mòduls d'un model.",
    noun: ["model", "models"] as [string, string],
    shows: isModel,
    extra: { modeling: true },
    storage: "modeling",
    copyTo: "Copiar a Mobles",
  },
} as const

export function ProjectsScreen({ onOpen, request = null, onRequestDone, page: pageKey = "mobles" }: { onOpen: (id: number) => void; request?: ProjectsRequest; onRequestDone?: () => void; page?: keyof typeof PAGES }) {
  const page = PAGES[pageKey]
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
    const id = await createProject(uniqueName(name, existing), undefined, { composition, draft: true, ...page.extra })
    onOpen(id)
  }

  const handleDuplicate = async (id: number) => {
    const newId = await duplicateProject(id)
    if (newId !== undefined) toaster.create({ title: `${cap(page.noun[0])} duplicat`, type: "success" })
  }

  // Mobles ↔ Modelatge: una còpia a l'altra pàgina, que s'obre (cel, 2026-11-07: «obrir al Modelatge un moble que ja s'ha fet»).
  const handleCopyTo = async (id: number) => {
    const copy = await duplicateProject(id)
    if (copy === undefined) return
    await db.projects.update(copy, { modeling: pageKey === "mobles" ? true : undefined })
    toaster.create({ title: pageKey === "mobles" ? "Copiat a Modelatge" : "Copiat a Mobles", type: "success" })
    onOpen(copy)
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
        title={page.title}
        description={page.description}
      />

      <NewMobleGallery
        onCreate={(c, n) => void handleCreate(c, n)}
        storageKey={`mobles:gallery-${page.storage}`}
        // El botó principal al costat del cercador (com a Ambients i Objectes) i «Obrir fitxer» a la mateixa fila.
        // «Nou moble» demana el tipus (per decisió de l'usuari, 2026-10-20: «triar si és de cuina o és un moble normal»): el
        // normal té el suport a cada mòdul; la cuina, un per a tots (Moble › Cuina). Es crea en blanc.
        add={{
          label: `Nou ${page.noun[0]}`,
          menu: NEW_MOBLE_TYPES.map((t) => {
            const k = KINDS.find((x) => x.value === t.kind)!
            return (
              <Menu.Item key={t.kind} value={t.kind} onClick={() => void handleCreate(blankMoble(t.kind), NEW_MOBLE_NAMES[t.kind])}>
                <k.icon />
                <VStack align="start" gap={0}>
                  <Text>{t.label}</Text>
                  <Text fontSize="xs" color="fg.muted">
                    {t.hint}
                  </Text>
                </VStack>
              </Menu.Item>
            )
          }),
        }}
        // Un .moble (també les plantilles exportades abans) s'obre sempre com a moble; un objecte o un .ambient, com el que són.
        // A Modelatge, el moble obert (també un .taulell) hi queda com a model.
        extra={<OpenFileButton page="moble" inputRef={fileInput} onOpened={(o) => (o.kind === "ambient" ? showAmbient(o.ambientId) : o.kind === "moble" && pageKey === "modelatge" ? void db.projects.update(o.projectId, { modeling: true }).then(() => onOpen(o.projectId)) : onOpen(o.projectId))} />}
        history={(matches, searching) => {
          const shown = (projects ?? []).filter((p) => page.shows(p) && (!searching || matches(projectSearchText(p))))
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
              storageKey={`mobles:folders-${page.storage}`}
              toolbar={toolbar}
              selection={{
                noun: page.noun,
                folders: [...new Set((projects ?? []).filter((p) => page.shows(p) && p.folder).map((p) => p.folder!))].sort(),
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
              onUngroup={(name) => void setProjectsFolder((projects ?? []).filter((p) => page.shows(p) && p.folder === name).map((p) => p.id), undefined)}
              render={(p) => (
                <ProjectCard
                  project={p}
                  onOpen={() => onOpen(p.id)}
                  onDuplicate={() => handleDuplicate(p.id)}
                  onDelete={() => setToDelete(p)}
                  onSaveFile={() => setToSave(p)}
                  onMove={() => setToMove(p)}
                  copyTo={{ label: page.copyTo, onClick: () => void handleCopyTo(p.id) }}
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
                  {shown.length ? "L'historial és buit: el que tens és a Projectes." : projects?.some(page.shows) ? `Cap ${page.noun[0]} no coincideix amb la cerca.` : `Encara no tens cap ${page.noun[0]}: comença en blanc o des del catàleg.`}
                </Text>
              ) : (
                grid(
                  "loose",
                  loose,
                  <ClearHistory
                    count={free.length}
                    kept={loose.length - free.length}
                    noun={page.noun}
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
                  Encara no n'hi ha cap. A l'Historial, «Grup nou» o el menú ⋯ d'un {page.noun[0]} › «Moure a un grup…» (p. ex. el nom d'un client): el que hi desis queda aquí i «Esborrar» de l'Historial no el toca.
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
        folders={[...new Set((projects ?? []).filter((p) => page.shows(p) && p.folder).map((p) => p.folder!))].sort()}
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
