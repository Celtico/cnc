import { Box, Button, Container, Flex, HStack, Heading, IconButton, Menu, Portal, SegmentGroup, Stack, Text } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { IconType } from "react-icons"
import { LuChevronLeft, LuBox, LuDownload, LuDraftingCompass, LuEllipsis, LuHouse, LuLayoutGrid, LuList, LuPanelLeftClose, LuPanelLeftOpen, LuSave, LuSettings, LuSofa } from "react-icons/lu"
import { Toaster, toaster } from "./components/ui/toaster"
import { migrateUserTemplates } from "./db/compositionStore"
import { Tooltip } from "./components/ui/tooltip"
import { TopBar, TopBarActionsProvider } from "./components/TopBar"
import { SaveFileDialog } from "./features/file/SaveFileDialog"
import { db } from "./db/db"
import { compositionOf } from "./db/compositionStore"
import { CutListScreen } from "./features/cutlist/CutListScreen"
import { EditorScreen } from "./features/editor/EditorScreen"
import { ExportScreen } from "./features/export/ExportScreen"
import { NestingScreen } from "./features/nesting/NestingScreen"
import { PhotoScreen } from "./features/photo/PhotoScreen"
import { ProjectsScreen, type ProjectsRequest } from "./features/projects/ProjectsScreen"
import { AmbientEditor, AmbientTopBar } from "./features/ambients/AmbientEditor"
import { useSessionString } from "./features/settings/useSessionString"
import { AmbientsScreen } from "./features/ambients/AmbientsScreen"
import { ObjectsScreen } from "./features/objects/ObjectsScreen"
import { compositionKind } from "./core/model"
import { SettingsScreen } from "./features/settings/SettingsScreen"
import { useSettings } from "./features/settings/SettingsContext"
import { UnitContext } from "./features/units"
import { usePersistentNumber } from "./features/usePersistentNumber"
import { isObject as projectIsObject } from "./features/objects/isObject"
import { usePersistentFlag } from "./features/usePersistentFlag"
import { useProject } from "./features/useProject"

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
const GLOBAL_NAV: NavEntry[] = [AMBIENTS_ENTRY, OBJECTS_ENTRY, PROJECTS_ENTRY]
/** Mòbil: la barra de baix amb els apartats i Preferències. */
const GLOBAL_NAV_MOBILE: NavEntry[] = [...GLOBAL_NAV, SETTINGS_ENTRY]

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
  // Les antigues «teves plantilles» passen a mobles del grup «Les meves plantilles» (un sol cop).
  useEffect(() => {
    void migrateUserTemplates().then((n) => {
      if (n) toaster.create({ title: `${n === 1 ? "1 plantilla teva" : `${n} plantilles teves`} a Projectes`, description: "Ara són mobles del grup «Les meves plantilles» (Mobles › Projectes).", type: "info", duration: 8000 })
    })
  }, [])
  const [projectId, setProjectId] = useState<number | null>(readStoredId)
  // Si hi havia un moble obert, es torna al seu Editor; si no, a Ambients (el primer del menú).
  const [screen, setScreen] = useState<Screen>(() => (readStoredId() !== null ? "editor" : readAmbientId() !== null ? "ambient" : "ambients"))
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
  const goAmbients = () => {
    setProjectId(null)
    setScreen(ambientId !== null ? "ambient" : "ambients")
  }

  const content =
    screen === "objects" ? (
      <ObjectsScreen onOpen={openProject} />
    ) : screen === "ambients" ? (
      <AmbientsScreen onOpen={openAmbient} />
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
  const projectTabs = (full: boolean) =>
    showTopBar && projectNav.length > 1 ? (
      // Al mòbil (full), les 4 pestanyes a parts iguals i més petites: a 375 px «Exportar» quedava tallat.
      <SegmentGroup.Root size={full ? "xs" : "sm"} w={full ? "full" : undefined} value={screen === "photo" ? "editor" : screen} onValueChange={(e) => e.value && go(e.value as Screen)}>
        <SegmentGroup.Indicator />
        {projectNav.map((n) => (
          <SegmentGroup.Item key={n.id} value={n.id} flex={full ? 1 : undefined} minW={0} px={full ? 1 : undefined} justifyContent="center">
            <SegmentGroup.ItemText>
              <HStack gap={full ? 1 : 1.5}>
                <n.icon /> {n.label}
              </HStack>
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    ) : undefined

  return (
    <UnitContext.Provider value={settings.display.unit}>
    <Flex direction={{ base: "column", md: "row" }} flex={1} minH="100dvh">
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
            tabs={projectTabs(false)}
            menu={
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton aria-label="Menú del moble" title="Menú del moble" size="sm" variant="ghost">
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
          <Box display={{ base: "block", md: "none" }} px={2} py={1.5} borderBottomWidth="1px" bg="bg.panel" position="sticky" top="calc(52px + env(safe-area-inset-top, 0px))" zIndex="sticky">
            {projectTabs(true)}
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
          <TopBarActionsProvider value={topActions}>{content}</TopBarActionsProvider>
        </Container>
      </Flex>

      {/* Navegació inferior (mòbil) */}
      <HStack
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
        {GLOBAL_NAV_MOBILE.map((n) => {
          const disabled = false
          const active = section === n.id
          return (
            <Box
              key={n.id}
              asChild
              flex={1}
              py={2}
              color={active ? "wood.fg" : disabled ? "fg.subtle" : "fg.muted"}
              opacity={disabled ? 0.5 : 1}
              cursor={disabled ? "not-allowed" : "pointer"}
            >
              <button disabled={disabled} onClick={() => goSection(n.id)} aria-current={active ? "page" : undefined}>
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
        cursor={disabled ? "not-allowed" : "pointer"}
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
