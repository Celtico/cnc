import { lazy } from "react"
import type { Composition } from "../core/model"
import { ProjectsScreen, type ProjectsRequest } from "../features/projects/ProjectsScreen"
import { AmbientsScreen } from "../features/ambients/AmbientsScreen"
import { ObjectsScreen } from "../features/objects/ObjectsScreen"
import type { Screen } from "./nav"

// Les pàgines pesades (3D, export, preferències) es carreguen a demanda: la primera pantalla (galeries) arrenca abans.
const EditorScreen = lazy(() => import("../features/editor/EditorScreen").then((m) => ({ default: m.EditorScreen })))
const CutListScreen = lazy(() => import("../features/cutlist/CutListScreen").then((m) => ({ default: m.CutListScreen })))
const NestingScreen = lazy(() => import("../features/nesting/NestingScreen").then((m) => ({ default: m.NestingScreen })))
const ExportScreen = lazy(() => import("../features/export/ExportScreen").then((m) => ({ default: m.ExportScreen })))
const PhotoScreen = lazy(() => import("../features/photo/PhotoScreen").then((m) => ({ default: m.PhotoScreen })))
const HelpScreen = lazy(() => import("../features/help/HelpScreen").then((m) => ({ default: m.HelpScreen })))
const SettingsScreen = lazy(() => import("../features/settings/SettingsScreen").then((m) => ({ default: m.SettingsScreen })))
const AmbientEditor = lazy(() => import("../features/ambients/AmbientEditor").then((m) => ({ default: m.AmbientEditor })))

/** La pàgina d'ara (la llista, l'editor del moble o de l'ambient, Peces, Nesting, Exportar, Preferències…). */
export function AppContent({
  screen,
  projectId,
  ambientId,
  previewComposition,
  onOpenProject,
  onOpenAmbient,
  projectsRequest,
  onProjectsRequestDone,
}: {
  screen: Screen
  projectId: number | null
  ambientId: number | null
  previewComposition: Composition | undefined
  onOpenProject: (id: number) => void
  onOpenAmbient: (id: number) => void
  projectsRequest: ProjectsRequest
  onProjectsRequestDone: () => void
}) {
  return screen === "objects" ? (
    <ObjectsScreen onOpen={onOpenProject} />
  ) : screen === "ambients" ? (
    <AmbientsScreen onOpen={onOpenAmbient} onOpenProject={onOpenProject} />
  ) : screen === "ambient" && ambientId !== null ? (
    <AmbientEditor ambientId={ambientId} onOpenProject={onOpenProject} />
  ) : screen === "modeling" ? (
    <ProjectsScreen key="modelatge" page="modelatge" onOpen={onOpenProject} />
  ) : screen === "help" ? (
    <HelpScreen />
  ) : screen === "settings" ? (
    <SettingsScreen previewComposition={previewComposition} />
  ) : screen === "projects" || screen === "ambient" || projectId === null ? (
    <ProjectsScreen onOpen={onOpenProject} request={projectsRequest} onRequestDone={onProjectsRequestDone} />
  ) : screen === "editor" ? (
    <EditorScreen projectId={projectId} />
  ) : screen === "cutlist" ? (
    <CutListScreen projectId={projectId} />
  ) : screen === "photo" ? (
    <PhotoScreen projectId={projectId} />
  ) : screen === "nesting" ? (
    <NestingScreen projectId={projectId} />
  ) : (
    <ExportScreen projectId={projectId} />
  )
}
