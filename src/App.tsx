import { Box, Button, Container, Flex, HStack, Heading, IconButton, Menu, Portal, SegmentGroup, Spinner, Stack, Text } from "@chakra-ui/react"
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { IconType } from "react-icons"
import { LuChevronLeft, LuBox, LuDownload, LuDraftingCompass, LuEllipsis, LuHouse, LuLayoutGrid, LuList, LuMessageSquare, LuPanelLeftClose, LuPanelLeftOpen, LuSave, LuSettings, LuSofa } from "react-icons/lu"
import { Toaster, toaster } from "./components/ui/toaster"
import { migrateUserTemplates } from "./db/compositionStore"
import { Tooltip } from "./components/ui/tooltip"
import { TopBar, TopBarActionsProvider } from "./components/TopBar"
import { SaveFileDialog } from "./features/file/SaveFileDialog"
import { db, dropDrafts, dropIfDraft } from "./db/db"
import { compositionOf } from "./db/compositionStore"
import { ProjectsScreen, type ProjectsRequest } from "./features/projects/ProjectsScreen"
import { AmbientTopBar } from "./features/ambients/AmbientTopBar"
import { useSessionString } from "./features/settings/useSessionString"
import { AmbientsScreen } from "./features/ambients/AmbientsScreen"
import { ObjectsScreen } from "./features/objects/ObjectsScreen"
import { compositionKind } from "./core/model"
import { useSettings } from "./features/settings/SettingsContext"
import { useLaunchFiles } from "./features/file/useLaunchFiles"
import { showAmbient } from "./features/file/openAnyFile"
import { UnitContext } from "./features/units"
import { usePersistentNumber } from "./features/usePersistentNumber"
import { isObject as projectIsObject } from "./features/objects/isObject"
import { usePersistentFlag } from "./features/usePersistentFlag"
import { useProject } from "./features/useProject"
import { registerNav, type HubNav } from "./features/assistant/assistantHub"

// Les pàgines pesades (3D, export, preferències) es carreguen a demanda: la primera pantalla (galeries) arrenca abans.
const EditorScreen = lazy(() => import("./features/editor/EditorScreen").then((m) => ({ default: m.EditorScreen })))
const CutListScreen = lazy(() => import("./features/cutlist/CutListScreen").then((m) => ({ default: m.CutListScreen })))
const NestingScreen = lazy(() => import("./features/nesting/NestingScreen").then((m) => ({ default: m.NestingScreen })))
const ExportScreen = lazy(() => import("./features/export/ExportScreen").then((m) => ({ default: m.ExportScreen })))
const PhotoScreen = lazy(() => import("./features/photo/PhotoScreen").then((m) => ({ default: m.PhotoScreen })))
const SettingsScreen = lazy(() => import("./features/settings/SettingsScreen").then((m) => ({ default: m.SettingsScreen })))
const AmbientEditor = lazy(() => import("./features/ambients/AmbientEditor").then((m) => ({ default: m.AmbientEditor })))

type Screen = "projects" | "objects" | "editor" | "photo" | "cutlist" | "nesting" | "export" | "settings" | "ambients" | "ambient"

type NavEntry = { id: Screen; label: string; icon: IconType }

/** Pàgines del moble obert. Només surten quan n'hi ha un d'obert. */
const PROJECT_NAV: NavEntry[] = [
  { id: "editor", label: "Editor", icon: LuDraftingCompass },
  { id: "cutlist", label: "Peces", icon: LuList },
  { id: "nesting", label: "Nesting", icon: LuLayoutGrid },
  { id: "export", label: "Exportar", icon: LuDownload },
]
const PROJECTS_ENTRY: NavEntry = { id: "projects", label: "Mobles", icon: LuBox }
const OBJECTS_ENTRY: NavEntry = { id: "objects", label: "Objectes", icon: LuSofa }
const AMBIENTS_ENTRY: NavEntry = { id: "ambients", label: "Ambients", icon: LuHouse }
const SETTINGS_ENTRY: NavEntry = { id: "settings", label: "Preferències", icon: LuSettings }
/** Apartats del menú global (barra lateral); Preferències va a baix de tot. */
const GLOBAL_NAV: NavEntry[] = [PROJECTS_ENTRY, AMBIENTS_ENTRY, OBJECTS_ENTRY]

/** L'assistent personal (per decisió de l'usuari, 2026-10-13): sota els apartats, obre el calaix amb el xat. */
const ASSISTANT_ENTRY = { id: "assistant", label: "Assistent", icon: LuMessageSquare } as const
/** Mòbil: la barra de baix amb els apartats, l'Assistent i Preferències. */
const MOBILE_BAR: { id: string; label: string; icon: IconType }[] = [...GLOBAL_NAV, ASSISTANT_ENTRY, SETTINGS_ENTRY]
// El calaix i el xat, a demanda (el SDK de l'API de Claude no va al bloc d'entrada).
import { useRenderHost } from "./components/viewer/render/renderStore"
const GlobalAssistant = lazy(() => import("./features/assistant/GlobalAssistant"))
// El Render de tota l'app (`renderHost.ts`): es carrega el primer cop que s'obre i es queda muntat.
const RenderHost = lazy(() => import("./components/viewer/render/RenderHost").then((m) => ({ default: m.RenderHost })))

const STORAGE_KEY = "mobles:current-project"
const AMBIENT_KEY = "mobles:current-ambient"

function readAmbientId(): number | null {
  try {
    const v = localStorage.getItem(AMBIENT_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

function readStoredId(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function App() {
  const renderHost = useRenderHost()
  // Les antigues «teves plantilles» passen a mobles del grup «Les meves plantilles» (un sol cop).
  useEffect(() => {
    void migrateUserTemplates().then((n) => {
      if (n) toaster.create({ title: `${n === 1 ? "1 plantilla teva" : `${n} plantilles teves`} a Projectes`, description: "Ara són mobles del grup «Les meves plantilles» (Mobles › Projectes).", type: "info", duration: 8000 })
    })
  }, [])
  const [projectId, setProjectId] = useState<number | null>(readStoredId)
  // Si hi havia un moble obert, es torna al seu Editor; si no, a Mobles (el primer del menú).
  const [screen, setScreen] = useState<Screen>(() => (readStoredId() !== null ? "editor" : readAmbientId() !== null ? "ambient" : "projects"))
  // L'últim moble i l'últim objecte oberts (com l'ambient): el menú hi torna directament.
  const [lastMoble, setLastMoble] = usePersistentNumber("mobles:last-moble", 0)
  const [lastObject, setLastObject] = usePersistentNumber("mobles:last-object", 0)
  const project = useProject(projectId)
  // Ambient obert (a Ambients); es recorda com el moble.
  const [ambientId, setAmbientId] = useState<number | null>(readAmbientId)
  useEffect(() => {
    try {
      if (ambientId === null) localStorage.removeItem(AMBIENT_KEY)
      else localStorage.setItem(AMBIENT_KEY, String(ambientId))
    } catch {
      /* sense localStorage */
    }
  }, [ambientId])
  const previewComposition = useMemo(() => (project ? compositionOf(project) : undefined), [project])
  const { settings } = useSettings()
  const [navCollapsed, setNavCollapsed] = usePersistentFlag("mobles:nav-collapsed")
  // «Obrir fitxer» del menú: va a la llista de mobles i hi obre el selector de fitxers.
  const [projectsRequest, setProjectsRequest] = useState<ProjectsRequest>(null)
  const clearProjectsRequest = useCallback(() => setProjectsRequest(null), [])

  // Esborranys (plantilles obertes sense tocar, `Project.draft`): en obrir l'app, fora els que han quedat; en deixar un
  // moble, si encara ho és, s'esborra. Una mica més tard: abans, el desat pendent de l'editor (en desmuntar-se) el salva.
  useEffect(() => {
    void dropDrafts(readStoredId())
  }, [])
  const openId = useRef(projectId)
  useEffect(() => {
    openId.current = projectId
    if (projectId === null) return
    const id = projectId
    // Si es torna a obrir (o és el doble muntatge de StrictMode), no es toca.
    return () => void setTimeout(() => openId.current !== id && void dropIfDraft(id), 1500)
  }, [projectId])

  // Si el projecte guardat ja no existeix (esborrat), torna a la llista.
  useEffect(() => {
    if (projectId === null) return
    void db.projects.get(projectId).then((p) => {
      if (!p) {
        setProjectId(null)
        setScreen("projects")
      }
    })
  }, [projectId, project])

  useEffect(() => {
    try {
      if (projectId === null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, String(projectId))
    } catch {
      /* sense localStorage: no passa res */
    }
  }, [projectId])

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
  // Barra superior «Mobles › nom» a les pàgines del moble (no a Preferències).
  const showTopBar = inProject && screen !== "settings" && screen !== "projects"
  // Preferències obertes des d'un moble (mòbil): «‹ nom del moble» només a la llista d'apartats; dins
  // d'un apartat ja hi ha el seu «‹ Preferències» (un sol «Tornar» a la vista).
  const [settingsPane] = useSessionString("mobles:settings-section")
  const settingsBackBar = screen === "settings" && inProject && settingsPane === null
  const [topActions, setTopActions] = useState<HTMLDivElement | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
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
  const section: "ambients" | "objects" | "projects" | "settings" =
    screen === "settings" ? "settings" : screen === "ambients" || screen === "ambient" ? "ambients" : inProject ? (isObject ? "objects" : "projects") : screen === "objects" ? "objects" : "projects"
  /** Clic a un apartat: si ja hi ets dins d'un document, torna a la llista; si no, a l'últim obert. */
  const goSection = (id: string) => {
    if (id === "settings") return go("settings")
    if (id === "ambients") return section === "ambients" && screen === "ambient" ? (setAmbientId(null), setScreen("ambients")) : goAmbients()
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
  }, [])
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

  // Assistent personal: el calaix (muntat el primer cop que s'obre) i la navegació que fa servir (`assistantHub.ts`).
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantMounted, setAssistantMounted] = useState(false)
  const openAssistant = () => {
    setAssistantMounted(true)
    setAssistantOpen(true)
  }
  const navNow = useRef<HubNav | null>(null)
  navNow.current = {
    where: () => ({ section: { projects: "mobles", objects: "objectes", ambients: "ambients", settings: "preferencies" }[section], page: screen === "photo" ? "editor (foto)" : { cutlist: "peces", export: "exportar", projects: "llista de mobles", objects: "llista d'objectes", ambients: "llista d'ambients", ambient: "editor de l'ambient", settings: "preferencies" }[screen as string] ?? screen }),
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

  const content =
    screen === "objects" ? (
      <ObjectsScreen onOpen={openProject} />
    ) : screen === "ambients" ? (
      <AmbientsScreen onOpen={openAmbient} onOpenProject={openProject} />
    ) : screen === "ambient" && ambientId !== null ? (
      <AmbientEditor ambientId={ambientId} onOpenProject={openProject} />
    ) : screen === "settings" ? (
      <SettingsScreen previewComposition={previewComposition} />
    ) : screen === "projects" || screen === "ambient" || projectId === null ? (
      <ProjectsScreen onOpen={openProject} request={projectsRequest} onRequestDone={clearProjectsRequest} />
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

  // Pàgines del moble obert (Editor · Peces · Nesting · Exportar): a l'ordinador, al mig de la barra
  // de dalt; al mòbil, en una franja sota la barra (la barra de baix és sempre el menú general).
  const projectTabs = () =>
    showTopBar && projectNav.length > 1 ? (
      <SegmentGroup.Root size="sm" value={screen === "photo" ? "editor" : screen} onValueChange={(e) => e.value && go(e.value as Screen)}>
        <SegmentGroup.Indicator />
        {projectNav.map((n) => (
          <SegmentGroup.Item key={n.id} value={n.id} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={1.5}>
                <n.icon /> {n.label}
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    ) : undefined

  // Al mòbil, les pàgines del moble a sang (de vora a vora), com unes pestanyes d'app: icona a sobre, nom a
  // sota i la triada amb el color principal i una ratlla a baix.
  const current = screen === "photo" ? "editor" : screen
  const mobileProjectTabs = (
    <HStack gap={0} role="tablist" aria-label="Pàgines del moble">
      {projectNav.map((n) => {
        const on = current === n.id
        return (
          <Box
            key={n.id}
            asChild
            flex={1}
            minW={0}
            pt={1.5}
            pb={1}
            color={on ? "wood.fg" : "fg.muted"}
            borderBottomWidth="2px"
            borderColor={on ? "wood.solid" : "transparent"}
          >
            <button type="button" role="tab" aria-selected={on} onClick={() => go(n.id as Screen)}>
              <Stack align="center" gap={0.5}>
                <Box fontSize="xl" display="inline-flex">
                  <n.icon />
                </Box>
                <Text fontSize="xs" fontWeight={on ? "semibold" : "medium"} truncate maxW="full">
                  {n.label}
                </Text>
              </Stack>
            </button>
          </Box>
        )
      })}
    </HStack>
  )

  return (
    <UnitContext.Provider value={settings.display.unit}>
    <Flex className="app-root" direction={{ base: "column", md: "row" }} flex={1} minH="100dvh">
      {/* Barra lateral (escriptori), plegable a només icones */}
      <Stack
        display={{ base: "none", md: "flex" }}
        as="nav"
        aria-label="Menú principal"
        w={navCollapsed ? "64px" : "220px"}
        transition="width 0.2s"
        flexShrink={0}
        p={navCollapsed ? 2 : 4}
        gap={1}
        borderRightWidth="1px"
        bg="bg.subtle"
        position="sticky"
        top={0}
        h="100dvh"
        overflow="hidden"
      >
        <HStack justify={navCollapsed ? "center" : "space-between"} mb={4} px={navCollapsed ? 0 : 2} minH="40px">
          {!navCollapsed && (
            <HStack gap={1.5} align="baseline" minW={0}>
              <Heading size="md" color="wood.fg">
                Mobles CNC
              </Heading>
              {/* Quina build és: el nombre de commits, petit, al costat del nom; el commit en passar-hi per sobre. */}
              <Text as="span" fontSize="2xs" color="fg.subtle" title={__APP_COMMIT__ ? `commit ${__APP_COMMIT__}` : undefined}>
                v{__APP_VERSION__}
              </Text>
            </HStack>
          )}
          <Tooltip content={navCollapsed ? "Desplegar el menú" : "Plegar el menú"} positioning={{ placement: "right" }}>
            <IconButton
              aria-label={navCollapsed ? "Desplegar el menú" : "Plegar el menú"}
              aria-expanded={!navCollapsed}
              variant="ghost"
              size="sm"
              onClick={() => setNavCollapsed((v) => !v)}
            >
              {navCollapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
            </IconButton>
          </Tooltip>
        </HStack>
        {/* Menú global, sempre igual (com Figma o Linear): només els apartats. Les pàgines d'un moble
            obert són pestanyes a la seva barra superior i les accions de cada apartat, a la seva capçalera. */}
        <Stack gap={1}>
          {GLOBAL_NAV.map((n) => (
            <NavItem key={n.id} icon={n.icon} label={n.label} collapsed={navCollapsed} active={section === n.id} disabled={false} onClick={() => goSection(n.id)} />
          ))}
          {/* L'assistent personal, sota els apartats: obre el calaix amb el xat (no és una pàgina). */}
          <Box pt={2} mt={1} borderTopWidth="1px">
            <NavItem icon={ASSISTANT_ENTRY.icon} label={ASSISTANT_ENTRY.label} collapsed={navCollapsed} active={assistantOpen} disabled={false} onClick={openAssistant} />
          </Box>
        </Stack>
        {/* Preferències, a baix de tot (com a les apps d'escriptori). */}
        <Stack gap={1} mt="auto" pt={2} borderTopWidth="1px" align={navCollapsed ? "center" : "stretch"}>
          <NavItem icon={SETTINGS_ENTRY.icon} label={SETTINGS_ENTRY.label} collapsed={navCollapsed} active={screen === "settings"} disabled={false} onClick={() => go("settings")} />
        </Stack>
      </Stack>

      {/* A l'ordinador, l'app ocupa just la finestra: cada zona fa el seu propi desplaçament
          (llista, preferències, i a l'editor l'arbre i les propietats per separat). */}
      <Flex direction="column" flex={1} minW={0} h={{ md: "100dvh" }}>
        {showTopBar && projectId !== null && (
          <TopBar
            projectId={projectId}
            rootLabel={rootEntry.label}
            onBack={backToProjects}
            onSettings={() => go("settings")}
            actionsRef={setTopActions}
            tabs={projectTabs()}
            menu={
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton aria-label={isObject ? "Menú de l'objecte" : "Menú del moble"} title={isObject ? "Menú de l'objecte" : "Menú del moble"} size="sm" variant="ghost">
                    <LuEllipsis />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="file" onClick={() => (window.dispatchEvent(new Event("mobles:flush-save")), setSaveOpen(true))}>
                        <LuSave /> Desar com a fitxer…
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            }
          />
        )}
        {showTopBar && projectNav.length > 1 && (
          <Box display={{ base: "block", md: "none" }} borderBottomWidth="1px" bg="bg.panel" position="sticky" top="calc(52px + env(safe-area-inset-top, 0px))" zIndex="sticky">
            {mobileProjectTabs}
          </Box>
        )}
        {screen === "ambient" && ambientId !== null && (
          <AmbientTopBar ambientId={ambientId} onBack={() => (setAmbientId(null), setScreen("ambients"))} onSettings={() => go("settings")} actionsRef={setTopActions} />
        )}
        {project && <SaveFileDialog project={saveOpen ? project : null} open={saveOpen} onClose={() => setSaveOpen(false)} />}
        {/* Mòbil: les pàgines d'inici porten el seu títol gran (com iOS); aquí només hi ha barra quan cal
            tornar enrere (Preferències obertes des d'un moble). */}
        {settingsBackBar && (
          <HStack
            display={{ base: "flex", md: "none" }}
            as="header"
            px={2}
            pt="env(safe-area-inset-top, 0px)"
            h="calc(52px + env(safe-area-inset-top, 0px))"
            borderBottomWidth="1px"
            bg="bg.panel"
            position="sticky"
            top={0}
            zIndex="sticky"
          >
            <Button variant="ghost" size="sm" onClick={() => setScreen("editor")} maxW="80%">
              <LuChevronLeft /> <Text truncate>{project?.name ?? "Tornar"}</Text>
            </Button>
          </HStack>
        )}

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
              {content}
            </Suspense>
          </TopBarActionsProvider>
        </Container>
      </Flex>

      {/* Navegació inferior (mòbil) */}
      <HStack
        className="bottom-nav"
        display={{ base: "flex", md: "none" }}
        as="nav"
        position="fixed"
        bottom={0}
        left={0}
        right={0}
        zIndex="sticky"
        bg="bg.panel"
        borderTopWidth="1px"
        pb="env(safe-area-inset-bottom, 0px)"
        justify="space-around"
      >
        {/* Sempre el menú general (com les apps de l'iPhone): les pàgines del moble són a dalt. */}
        {MOBILE_BAR.map((n) => {
          const disabled = false
          const active = n.id === "assistant" ? assistantOpen : section === n.id
          return (
            <Box
              key={n.id}
              asChild
              flex={1}
              py={2}
              color={active ? "wood.fg" : disabled ? "fg.subtle" : "fg.muted"}
              opacity={disabled ? 0.5 : 1}
            >
              <button disabled={disabled} onClick={() => (n.id === "assistant" ? openAssistant() : goSection(n.id))} aria-current={active && n.id !== "assistant" ? "page" : undefined}>
                <Stack align="center" gap={0.5}>
                  {/* Com la barra de pestanyes d'iOS: icona de ~25 i nom petit (10–11). */}
                  <Box fontSize="2xl">
                    <n.icon />
                  </Box>
                  <Text fontSize="2xs" fontWeight={active ? "semibold" : "medium"}>
                    {n.label}
                  </Text>
                </Stack>
              </button>
            </Box>
          )
        })}
      </HStack>

      {assistantMounted && (
        <Suspense fallback={null}>
          <GlobalAssistant open={assistantOpen} onClose={() => setAssistantOpen(false)} settings={settings} />
        </Suspense>
      )}
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

function NavItem({
  icon: Icon,
  label,
  collapsed,
  active,
  disabled,
  onClick,
}: {
  icon: IconType
  label: string
  collapsed: boolean
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Tooltip content={label} disabled={!collapsed} positioning={{ placement: "right" }}>
      <HStack
        asChild
        px={3}
        py={2}
        rounded="md"
        gap={3}
        justify={collapsed ? "center" : "flex-start"}
        bg={active ? "wood.muted" : "transparent"}
        color={active ? "wood.fg" : disabled ? "fg.subtle" : "fg"}
        _hover={disabled ? {} : { bg: active ? "wood.muted" : "bg.muted" }}
        fontWeight={active ? "semibold" : "normal"}
      >
        <button
          disabled={disabled}
          onClick={onClick}
          aria-current={active ? "page" : undefined}
          aria-label={collapsed ? label : undefined}
        >
          <Icon />
          {!collapsed && <Text>{label}</Text>}
        </button>
      </HStack>
    </Tooltip>
  )
}
