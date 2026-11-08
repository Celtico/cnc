import { useEffect, useRef } from "react"
import { registerNav, type HubNav } from "../features/assistant/assistantHub"
import type { Screen } from "./nav"
import type { useAppNavigation } from "./useAppNavigation"

/** La navegació que fa servir l'assistent personal (`assistantHub.ts`): on som, obrir documents i anar a una pàgina. */
export function useHubNav(nav: ReturnType<typeof useAppNavigation>) {
  const { section, screen, projectId, isObject, openProject, openAmbient, setProjectId, setAmbientId, setScreen } = nav
  const navNow = useRef<HubNav | null>(null)
  navNow.current = {
    where: () => ({ section: { projects: "mobles", objects: "objectes", ambients: "ambients", modeling: "modelatge", settings: "preferencies", help: "ajuda" }[section], page: screen === "photo" ? "editor (foto)" : { cutlist: "peces", export: "exportar", projects: "llista de mobles", objects: "llista d'objectes", ambients: "llista d'ambients", ambient: "editor de l'ambient", settings: "preferencies" }[screen as string] ?? screen }),
    openMoble: (id) => openProject(id),
    openAmbient: (id) => {
      setProjectId(null)
      openAmbient(id)
    },
    goTo: (place) => {
      if (place === "mobles" || place === "objectes") {
        setProjectId(null)
        setScreen(place === "mobles" ? "projects" : "objects")
        return true
      }
      if (place === "ambients") {
        setProjectId(null)
        setAmbientId(null)
        setScreen("ambients")
        return true
      }
      if (place === "preferencies") {
        setScreen("settings")
        return true
      }
      const page = ({ editor: "editor", peces: "cutlist", nesting: "nesting", exportar: "export" } as Record<string, Screen>)[place]
      if (!page || projectId === null || (isObject && page !== "editor")) return false
      setScreen(page)
      return true
    },
  }
  useEffect(
    () =>
      registerNav({
        where: () => navNow.current!.where(),
        openMoble: (id) => navNow.current!.openMoble(id),
        openAmbient: (id) => navNow.current!.openAmbient(id),
        goTo: (p) => navNow.current!.goTo(p),
      }),
    [],
  )
}
