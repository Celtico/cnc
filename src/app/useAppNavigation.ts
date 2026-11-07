import { useEffect, useMemo, useState } from "react"
import { db } from "../db/db"
import { compositionOf } from "../db/compositionStore"
import { compositionKind } from "../core/model"
import { useLaunchFiles } from "../features/file/useLaunchFiles"
import { showAmbient } from "../features/file/openAnyFile"
import { usePersistentNumber } from "../lib/usePersistentNumber"
import { isObject as projectIsObject } from "../features/objects/isObject"
import { useProject } from "../features/useProject"
import { OBJECTS_ENTRY, PROJECT_NAV, PROJECTS_ENTRY, type Screen, type Section } from "./nav"
import { AMBIENT_KEY, readStoredId, STORAGE_KEY, useStoredId } from "./storedId"
import { useDraftCleanup } from "./useDraftCleanup"

/**
 * On és l'usuari: la pàgina, el moble (o objecte) obert i l'ambient obert, l'apartat del menú i com s'hi va (menú,
 * pestanyes, enllaços d'altres pàgines i fitxers oberts amb doble clic).
 */
export function useAppNavigation() {
  const [projectId, setProjectId] = useStoredId(STORAGE_KEY)
  // Si hi havia un moble obert, es torna al seu Editor; si no, a Mobles (el primer del menú).
  const [screen, setScreen] = useState<Screen>(() => (readStoredId(STORAGE_KEY) !== null ? "editor" : readStoredId(AMBIENT_KEY) !== null ? "ambient" : "projects"))
  // L'últim moble i l'últim objecte oberts (com l'ambient): el menú hi torna directament.
  const [lastMoble, setLastMoble] = usePersistentNumber("mobles:last-moble", 0)
  const [lastObject, setLastObject] = usePersistentNumber("mobles:last-object", 0)
  const project = useProject(projectId)
  // Ambient obert (a Ambients); es recorda com el moble.
  const [ambientId, setAmbientId] = useStoredId(AMBIENT_KEY)
  const previewComposition = useMemo(() => (project ? compositionOf(project) : undefined), [project])

  useDraftCleanup(projectId)

  // Si el projecte guardat ja no existeix (esborrat), torna a la llista.
  useEffect(() => {
    if (projectId === null) return
    void db.projects.get(projectId).then((p) => {
      if (!p) {
        setProjectId(null)
        setScreen("projects")
      }
    })
  }, [projectId, project, setProjectId])

  const openProject = (id: number) => {
    setProjectId(id)
    setScreen("editor")
  }
  // Doble clic a un .moble o un .ambient (app instal·lada): l'obre com «Obrir fitxer».
  useLaunchFiles(openProject, showAmbient)

  const inProject = projectId !== null
  // Un objecte (per als ambients) s'edita amb el mateix Editor, però no té peces, nesting ni export.
  const isObject = !!previewComposition && compositionKind(previewComposition) === "objecte"
  const projectNav = isObject ? PROJECT_NAV.filter((n) => n.id === "editor") : PROJECT_NAV
  const rootScreen: Screen = isObject ? "objects" : "projects"
  const rootEntry = isObject ? OBJECTS_ENTRY : PROJECTS_ENTRY
  useEffect(() => {
    // Només quan el projecte carregat és el que hi ha obert (si no, en canviar d'un objecte a un
    // moble es recordava el moble com a «últim objecte» i Objectes obria un moble).
    if (projectId === null || !previewComposition || project?.id !== projectId) return
    if (isObject) setLastObject(projectId)
    else setLastMoble(projectId)
  }, [projectId, project?.id, previewComposition, isObject, setLastMoble, setLastObject])
  /** Mobles / Objectes del menú: l'últim obert (si encara existeix) o la llista. */
  const goRoot = (kind: "projects" | "objects") => {
    const id = kind === "objects" ? lastObject : lastMoble
    if (id > 0)
      void db.projects.get(id).then((p) => {
        // Només si encara existeix i és del mateix apartat (objecte o moble).
        if (p && projectIsObject(p) === (kind === "objects")) openProject(id)
        else {
          setProjectId(null)
          setScreen(kind)
        }
      })
    else {
      setProjectId(null)
      setScreen(kind)
    }
  }
  /** Apartat actiu al menú global: el del document obert o el de la pàgina. */
  const section: Section =
    screen === "settings" ? "settings" : screen === "modeling" ? "modeling" : screen === "ambients" || screen === "ambient" ? "ambients" : inProject ? (isObject ? "objects" : "projects") : screen === "objects" ? "objects" : "projects"
  /** Clic a un apartat: si ja hi ets dins d'un document, torna a la llista; si no, a l'últim obert. */
  const goSection = (id: string) => {
    if (id === "settings") return go("settings")
    if (id === "ambients") return section === "ambients" && screen === "ambient" ? closeAmbient() : goAmbients()
    if (id === "modeling") {
      setProjectId(null)
      return setScreen("modeling")
    }
    const kind = id === "objects" ? "objects" : "projects"
    if (section === kind && inProject && screen !== "settings") return backToProjects()
    goRoot(kind)
  }
  const go = (s: Screen) => {
    if (PROJECT_NAV.some((n) => n.id === s) && projectId === null) return
    setScreen(s)
  }
  /** Tanca el moble obert i torna a la llista: el menú torna a ser el general. */
  const backToProjects = () => {
    // Com «Ambients ›»: tornar a la llista deixa de recordar-lo.
    if (isObject) setLastObject(0)
    else setLastMoble(0)
    setProjectId(null)
    setScreen(rootScreen)
  }

  const openAmbient = (id: number) => {
    setAmbientId(id)
    setScreen("ambient")
  }
  /** Tanca l'ambient obert i torna a la llista d'ambients. */
  const closeAmbient = () => {
    setAmbientId(null)
    setScreen("ambients")
  }
  // Enllaços a un ambient des d'altres pàgines (p. ex. l'etiqueta «És a l'ambient» de les targetes de mobles).
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<number>).detail
      if (typeof id !== "number") return
      setProjectId(null)
      setAmbientId(id)
      setScreen("ambient")
    }
    window.addEventListener("mobles:open-ambient", on)
    return () => window.removeEventListener("mobles:open-ambient", on)
  }, [setProjectId, setAmbientId])
  // Enllaços a Preferències des d'altres pàgines (el xat de l'Editor sense clau: `openSettings`).
  useEffect(() => {
    const on = () => setScreen("settings")
    window.addEventListener("mobles:open-settings", on)
    return () => window.removeEventListener("mobles:open-settings", on)
  }, [])
  const goAmbients = () => {
    setProjectId(null)
    setScreen(ambientId !== null ? "ambient" : "ambients")
  }

  return {
    screen,
    setScreen,
    projectId,
    setProjectId,
    project,
    previewComposition,
    ambientId,
    setAmbientId,
    inProject,
    isObject,
    projectNav,
    rootEntry,
    section,
    openProject,
    openAmbient,
    closeAmbient,
    go,
    goSection,
    backToProjects,
  }
}
