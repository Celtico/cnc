import { Box, Container, Flex, Spinner, Splitter } from "@chakra-ui/react"
import { Suspense, lazy, useCallback, useState } from "react"
import { Toaster } from "./components/ui/toaster"
import { PanelSplit, SplitHandle } from "./components/PanelSplit"
import { TopBar, TopBarActionsProvider } from "./components/TopBar"
import { SaveFileDialog } from "./features/file/SaveFileDialog"
import type { ProjectsRequest } from "./features/projects/ProjectsScreen"
import { AmbientTopBar } from "./features/ambients/AmbientTopBar"
import { useSessionString } from "./features/settings/useSessionString"
import { useSettings } from "./features/settings/SettingsContext"
import { UnitContext } from "./lib/units"
import { usePersistentFlag } from "./lib/usePersistentFlag"
import { usePersistentNumber } from "./lib/usePersistentNumber"
import { AppContent } from "./app/AppContent"
import { MobileNav } from "./app/MobileNav"
import { RenderStatusChip } from "./app/RenderStatusNav"
import { ProjectMenu } from "./app/ProjectMenu"
import { MobileProjectTabs, ProjectTabs } from "./app/ProjectTabs"
import { SettingsBackBar } from "./app/SettingsBackBar"
import { SideNav } from "./app/SideNav"
import { useAppNavigation } from "./app/useAppNavigation"
import { useAssistantDrawer } from "./app/useAssistantDrawer"
import { useHubNav } from "./app/useHubNav"
import { useTemplateMigration } from "./app/useTemplateMigration"

// El calaix i el xat, a demanda (el SDK de l'API de Claude no va al bloc d'entrada).
import { useRenderHost } from "./components/viewer/render/renderStore"
const GlobalAssistant = lazy(() => import("./features/assistant/GlobalAssistant"))
// El Render de tota l'app (`renderHost.ts`): es carrega el primer cop que s'obre i es queda muntat.
const RenderHost = lazy(() => import("./components/viewer/render/RenderHost").then((m) => ({ default: m.RenderHost })))

export function App() {
  const renderHost = useRenderHost()
  useTemplateMigration()
  const nav = useAppNavigation()
  const { screen, setScreen, projectId, project, ambientId, inProject, isObject, projectNav, go } = nav
  const { settings } = useSettings()
  const [navCollapsed, setNavCollapsed] = usePersistentFlag("mobles:nav-collapsed")
  // «Obrir fitxer» del menú: va a la llista de mobles i hi obre el selector de fitxers.
  const [projectsRequest, setProjectsRequest] = useState<ProjectsRequest>(null)
  const clearProjectsRequest = useCallback(() => setProjectsRequest(null), [])

  // Barra superior «Mobles › nom» a les pàgines del moble (no a Preferències).
  const showTopBar = inProject && screen !== "settings" && screen !== "projects"
  // Preferències obertes des d'un moble (mòbil): «‹ nom del moble» només a la llista d'apartats; dins
  // d'un apartat ja hi ha el seu «‹ Preferències» (un sol «Tornar» a la vista).
  const [settingsPane] = useSessionString("mobles:settings-section")
  const settingsBackBar = screen === "settings" && inProject && settingsPane === null
  const [topActions, setTopActions] = useState<HTMLDivElement | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

  // Assistent personal: el calaix (muntat el primer cop que s'obre) i la navegació que fa servir (`assistantHub.ts`).
  const assistant = useAssistantDrawer()
  useHubNav(nav)
  // A l'ordinador, l'assistent és una columna a la dreta: la vora esquerra canvia l'amplada (sense cap barra a la vista, per
  // decisió de l'usuari, 2026-10-14; 320–720 px, arrossegar-la fins a la vora el tanca, doble clic torna a 400).
  const [assistantWidth, setAssistantWidth] = usePersistentNumber("mobles:assistant-width", 400)

  return (
    <UnitContext.Provider value={settings.display.unit}>
    <Flex className="app-root" direction={{ base: "column", md: "row" }} flex={1} minH="100dvh">
      <SideNav
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((v) => !v)}
        section={nav.section}
        settingsActive={screen === "settings"}
        assistantOpen={assistant.open}
        onSection={nav.goSection}
        onAssistant={assistant.toggle}
        onSettings={() => go("settings")}
      />

      <PanelSplit flex={1} minW={0} panels={[{ id: "main" }, { id: "assistant", width: assistantWidth, setWidth: setAssistantWidth, min: 320, max: 720, hidden: !assistant.open, onHide: assistant.close }]}>
      {/* A l'ordinador, l'app ocupa just la finestra: cada zona fa el seu propi desplaçament
          (llista, preferències, i a l'editor l'arbre i les propietats per separat). */}
      <Splitter.Panel id="main" display="flex" flexDirection="column" minW={0} h={{ md: "100dvh" }}>
        {showTopBar && projectId !== null && (
          <TopBar
            projectId={projectId}
            rootLabel={nav.rootEntry.label}
            onBack={nav.backToProjects}
            onSettings={() => go("settings")}
            actionsRef={setTopActions}
            tabs={showTopBar && projectNav.length > 1 ? <ProjectTabs screen={screen} projectNav={projectNav} onGo={go} /> : undefined}
            menu={<ProjectMenu isObject={isObject} onSaveFile={() => (window.dispatchEvent(new Event("mobles:flush-save")), setSaveOpen(true))} />}
          />
        )}
        {showTopBar && projectNav.length > 1 && (
          <Box display={{ base: "block", md: "none" }} borderBottomWidth="1px" bg="bg.panel" position="sticky" top="calc(52px + env(safe-area-inset-top, 0px))" zIndex="sticky">
            <MobileProjectTabs screen={screen} projectNav={projectNav} onGo={go} />
          </Box>
        )}
        {screen === "ambient" && ambientId !== null && (
          <AmbientTopBar ambientId={ambientId} onBack={nav.closeAmbient} onSettings={() => go("settings")} actionsRef={setTopActions} />
        )}
        {project && <SaveFileDialog project={saveOpen ? project : null} open={saveOpen} onClose={() => setSaveOpen(false)} />}
        {settingsBackBar && <SettingsBackBar label={project?.name ?? "Tornar"} onBack={() => setScreen("editor")} />}

        <Container
          as="main"
          maxW="none"
          flex={1}
          minH={0}
          overflowY={{ md: "auto" }}
          display="flex"
          flexDirection="column"
          px={4}
          // El mateix aire al voltant de tots els documents (moble, objecte i ambient): 16 (al mòbil, a dalt; a l'ordinador, a tot el voltant).
          pt={{ base: showTopBar || screen === "ambient" || settingsBackBar ? 4 : "calc(16px + env(safe-area-inset-top, 0px))", md: screen === "editor" || screen === "ambient" ? 4 : 6 }}
          pb={{ base: "calc(76px + env(safe-area-inset-bottom, 0px))", md: screen === "editor" || screen === "ambient" ? 4 : 6 }}
        >
          <TopBarActionsProvider value={topActions}>
            <Suspense
              fallback={
                <Flex justify="center" py={16}>
                  <Spinner color="wood.solid" />
                </Flex>
              }
            >
              <AppContent
                screen={screen}
                projectId={projectId}
                ambientId={ambientId}
                previewComposition={nav.previewComposition}
                onOpenProject={nav.openProject}
                onOpenAmbient={nav.openAmbient}
                projectsRequest={projectsRequest}
                onProjectsRequestDone={clearProjectsRequest}
              />
            </Suspense>
          </TopBarActionsProvider>
        </Container>
      </Splitter.Panel>
      <SplitHandle id="main:assistant" quiet hidden={!assistant.open} label="Amplada de l'assistent" onReset={() => setAssistantWidth(400)} />
      {/* Al mòbil, l'assistent és un calaix (amb portal): la columna no hi és. */}
      <Splitter.Panel id="assistant" display={{ base: "none", md: assistant.open ? "block" : "none" }}>
        {assistant.mounted && (
          <Suspense fallback={null}>
            <GlobalAssistant open={assistant.open} onClose={assistant.close} settings={settings} closeRequest={assistant.closeRequest} />
          </Suspense>
        )}
      </Splitter.Panel>
      </PanelSplit>

      <RenderStatusChip />
      <MobileNav section={nav.section} assistantOpen={assistant.open} onSection={nav.goSection} onAssistant={assistant.toggle} />

      {renderHost.req && (
        <Suspense fallback={null}>
          <RenderHost />
        </Suspense>
      )}
      <Toaster />
    </Flex>
    </UnitContext.Provider>
  )
}
