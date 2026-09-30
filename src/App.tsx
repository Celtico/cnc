import { Box, Container, Flex, HStack, Heading, IconButton, Menu, Portal, Stack, Text } from "@chakra-ui/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { IconType } from "react-icons"
import { LuArrowLeft, LuBookmark, LuBox, LuDownload, LuDraftingCompass, LuEllipsis, LuFolderOpen, LuHouse, LuLayoutGrid, LuList, LuPanelLeftClose, LuPanelLeftOpen, LuSave, LuSettings, LuSofa } from "react-icons/lu"
import { Toaster } from "./components/ui/toaster"
import { Tooltip } from "./components/ui/tooltip"
import { TopBar, TopBarActionsProvider } from "./components/TopBar"
import { SaveFileDialog } from "./features/file/SaveFileDialog"
import { SaveTemplateDialog } from "./features/file/SaveTemplateDialog"
import { db } from "./db/db"
import { compositionOf } from "./db/compositionStore"
import { CutListScreen } from "./features/cutlist/CutListScreen"
import { EditorScreen } from "./features/editor/EditorScreen"
import { ExportScreen } from "./features/export/ExportScreen"
import { NestingScreen } from "./features/nesting/NestingScreen"
import { PhotoScreen } from "./features/photo/PhotoScreen"
import { ProjectsScreen, type ProjectsRequest } from "./features/projects/ProjectsScreen"
import { AmbientEditor } from "./features/ambients/AmbientEditor"
import { AmbientsScreen } from "./features/ambients/AmbientsScreen"
import { ObjectsScreen } from "./features/objects/ObjectsScreen"
import { compositionKind } from "./core/model"
import { SettingsScreen } from "./features/settings/SettingsScreen"
import { useSettings } from "./features/settings/SettingsContext"
import { UnitContext } from "./features/units"
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
  const [projectId, setProjectId] = useState<number | null>(readStoredId)
  // Si hi havia un moble obert, es torna al seu Editor; si no, a la llista.
  const [screen, setScreen] = useState<Screen>(() => (readStoredId() === null ? "projects" : "editor"))
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
  const requestProjects = (kind: "open") => {
    setProjectsRequest({ kind, n: Date.now() })
    setScreen("projects")
  }

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
  const [topActions, setTopActions] = useState<HTMLDivElement | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const go = (s: Screen) => {
    if (PROJECT_NAV.some((n) => n.id === s) && projectId === null) return
    setScreen(s)
  }
  /** Tanca el moble obert i torna a la llista: el menú torna a ser el general. */
  const backToProjects = () => {
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
      <AmbientEditor ambientId={ambientId} onBack={() => (setAmbientId(null), setScreen("ambients"))} onOpenProject={openProject} />
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
        {inProject ? (
          <>
            {/* Moble obert: «Mobles» (tornar a la llista) i, a sota, les pàgines del moble. */}
            <NavItem icon={rootEntry.icon} label={rootEntry.label} collapsed={navCollapsed} active={false} disabled={false} onClick={backToProjects} />
            <Box borderTopWidth="1px" my={1} />
            {projectNav.map((n) => (
              <NavItem
                key={n.id}
                icon={n.icon}
                label={n.label}
                collapsed={navCollapsed}
                active={screen === n.id || (n.id === "editor" && screen === "photo")}
                disabled={false}
                onClick={() => go(n.id)}
              />
            ))}
          </>
        ) : (
          <Stack gap={1}>
            {/* «Mobles» sempre a dalt de tot, separat; a sota, Obrir fitxer. */}
            <NavItem
              icon={PROJECTS_ENTRY.icon}
              label={PROJECTS_ENTRY.label}
              collapsed={navCollapsed}
              active={screen === "projects"}
              disabled={false}
              onClick={() => go("projects")}
            />
            <NavItem icon={OBJECTS_ENTRY.icon} label={OBJECTS_ENTRY.label} collapsed={navCollapsed} active={screen === "objects"} disabled={false} onClick={() => go("objects")} />
            <NavItem
              icon={AMBIENTS_ENTRY.icon}
              label={AMBIENTS_ENTRY.label}
              collapsed={navCollapsed}
              active={screen === "ambients" || screen === "ambient"}
              disabled={false}
              onClick={goAmbients}
            />
            {/* Les accions de la llista només a la llista (a Preferències confonien). */}
            {screen === "projects" && (
              <>
              <Box borderTopWidth="1px" my={1} />
              <NavItem icon={LuFolderOpen} label="Obrir fitxer" collapsed={navCollapsed} active={false} disabled={false} onClick={() => requestProjects("open")} />
              </>
            )}
          </Stack>
        )}
        {/* General: just a sota de les pàgines, separat amb una línia. */}
        <Stack gap={1} mt={1} pt={2} borderTopWidth="1px" align={navCollapsed ? "center" : "stretch"}>
          {inProject && !isObject && <NavItem icon={OBJECTS_ENTRY.icon} label={OBJECTS_ENTRY.label} collapsed={navCollapsed} active={false} disabled={false} onClick={() => (setProjectId(null), setScreen("objects"))} />}
          {inProject && isObject && <NavItem icon={PROJECTS_ENTRY.icon} label={PROJECTS_ENTRY.label} collapsed={navCollapsed} active={false} disabled={false} onClick={() => (setProjectId(null), setScreen("projects"))} />}
          {inProject && <NavItem icon={AMBIENTS_ENTRY.icon} label={AMBIENTS_ENTRY.label} collapsed={navCollapsed} active={false} disabled={false} onClick={goAmbients} />}
          <NavItem
            icon={SETTINGS_ENTRY.icon}
            label={SETTINGS_ENTRY.label}
            collapsed={navCollapsed}
            active={screen === "settings"}
            disabled={false}
            onClick={() => go("settings")}
          />
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
                      <Menu.Item value="template" onClick={() => (window.dispatchEvent(new Event("mobles:flush-save")), setTemplateOpen(true))}>
                        <LuBookmark /> Desar com a plantilla…
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            }
          />
        )}
        {project && <SaveFileDialog project={saveOpen ? project : null} open={saveOpen} onClose={() => setSaveOpen(false)} />}
        {project && <SaveTemplateDialog project={project} open={templateOpen} onClose={() => setTemplateOpen(false)} />}
        {/* Capçalera (mòbil) fora d'un moble */}
        <HStack
          display={{ base: showTopBar ? "none" : "flex", md: "none" }}
          as="header"
          px={4}
          pt="env(safe-area-inset-top, 0px)"
          h="calc(52px + env(safe-area-inset-top, 0px))"
          borderBottomWidth="1px"
          bg="bg.panel"
          position="sticky"
          top={0}
          zIndex={2}
          justify="space-between"
        >
          <HStack gap={1}>
            {screen === "settings" && inProject ? (
              <IconButton aria-label="Tornar al moble" variant="ghost" size="sm" onClick={() => setScreen("editor")}>
                <LuArrowLeft />
              </IconButton>
            ) : inProject || screen === "settings" ? (
              <IconButton aria-label="Tornar als mobles" variant="ghost" size="sm" onClick={backToProjects}>
                <LuArrowLeft />
              </IconButton>
            ) : null}
            <Heading size="md" truncate>
              {screen === "settings" ? "Preferències" : inProject ? project?.name ?? "Mobles" : screen === "ambients" || screen === "ambient" ? "Ambients" : screen === "objects" ? "Objectes" : "Mobles"}
            </Heading>
          </HStack>
          <HStack gap={0}>
            {inProject && screen !== "settings" && (
              <IconButton aria-label="Preferències" variant="ghost" size="sm" onClick={() => go("settings")}>
                <LuSettings />
              </IconButton>
            )}
          </HStack>
        </HStack>

        <Container
          as="main"
          maxW="none"
          flex={1}
          minH={0}
          overflowY={{ md: "auto" }}
          display="flex"
          flexDirection="column"
          px={{ base: 4, md: screen === "editor" || screen === "ambient" ? 2 : 4 }}
          // Al mòbil, l'editor enganxa el visor a la barra de dalt (sense marge superior).
          pt={{ base: screen === "editor" ? 0 : 4, md: screen === "editor" || screen === "ambient" ? 1.5 : 6 }}
          pb={{ base: "calc(76px + env(safe-area-inset-bottom, 0px))", md: screen === "editor" || screen === "ambient" ? 1.5 : 6 }}
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
        zIndex={3}
        bg="bg.panel"
        borderTopWidth="1px"
        pb="env(safe-area-inset-bottom, 0px)"
        justify="space-around"
      >
        {(inProject ? projectNav : [PROJECTS_ENTRY, OBJECTS_ENTRY, AMBIENTS_ENTRY, SETTINGS_ENTRY]).map((n) => {
          const disabled = false
          const active = screen === n.id || (n.id === "ambients" && screen === "ambient")
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
              <button disabled={disabled} onClick={() => (n.id === "ambients" ? goAmbients() : go(n.id))} aria-current={active ? "page" : undefined}>
                <Stack align="center" gap={0.5}>
                  <Box fontSize="xl">
                    <n.icon />
                  </Box>
                  <Text fontSize="xs" fontWeight={active ? "semibold" : "normal"}>
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
