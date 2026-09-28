import { Box, Container, Flex, HStack, Heading, IconButton, Stack, Text } from "@chakra-ui/react"
import { useEffect, useState } from "react"
import type { IconType } from "react-icons"
import { LuArrowLeft, LuBox, LuDownload, LuFolder, LuLayoutGrid, LuList, LuPanelLeftClose, LuPanelLeftOpen, LuSettings } from "react-icons/lu"
import { ColorModeButton } from "./components/ui/color-mode"
import { Toaster } from "./components/ui/toaster"
import { Tooltip } from "./components/ui/tooltip"
import { db } from "./db/db"
import { CutListScreen } from "./features/cutlist/CutListScreen"
import { EditorScreen } from "./features/editor/EditorScreen"
import { ExportScreen } from "./features/export/ExportScreen"
import { NestingScreen } from "./features/nesting/NestingScreen"
import { PhotoScreen } from "./features/photo/PhotoScreen"
import { ProjectsScreen } from "./features/projects/ProjectsScreen"
import { SettingsScreen } from "./features/settings/SettingsScreen"
import { useSettings } from "./features/settings/SettingsContext"
import { UnitContext } from "./features/units"
import { usePersistentFlag } from "./features/usePersistentFlag"
import { useProject } from "./features/useProject"

type Screen = "projects" | "editor" | "photo" | "cutlist" | "nesting" | "export" | "settings"

const NAV: { id: Screen; label: string; icon: IconType; needsProject: boolean }[] = [
  { id: "projects", label: "Mobles", icon: LuFolder, needsProject: false },
  { id: "editor", label: "Editor", icon: LuBox, needsProject: true },
  { id: "cutlist", label: "Peces", icon: LuList, needsProject: true },
  { id: "nesting", label: "Nesting", icon: LuLayoutGrid, needsProject: true },
  { id: "export", label: "Exportar", icon: LuDownload, needsProject: true },
  { id: "settings", label: "Preferències", icon: LuSettings, needsProject: false },
]

const STORAGE_KEY = "mobles:current-project"

function readStoredId(): number | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>("projects")
  const [projectId, setProjectId] = useState<number | null>(readStoredId)
  const project = useProject(projectId)
  const { settings } = useSettings()
  const [navCollapsed, setNavCollapsed] = usePersistentFlag("mobles:nav-collapsed")

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

  const go = (s: Screen) => {
    if (NAV.find((n) => n.id === s)?.needsProject && projectId === null) return
    setScreen(s)
  }

  const content =
    screen === "settings" ? (
      <SettingsScreen />
    ) : screen === "projects" || projectId === null ? (
      <ProjectsScreen onOpen={openProject} />
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
            <Heading size="lg" color="wood.fg">
              Mobles
            </Heading>
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
        {NAV.map((n) => (
          <NavItem
            key={n.id}
            icon={n.icon}
            label={n.label}
            collapsed={navCollapsed}
            active={screen === n.id}
            disabled={n.needsProject && projectId === null}
            onClick={() => go(n.id)}
          />
        ))}
        <Stack mt="auto" gap={2} align={navCollapsed ? "center" : "stretch"}>
          {project && !navCollapsed && (
            <Text px={2} fontSize="sm" color="fg.muted" truncate>
              {project.name}
            </Text>
          )}
          <HStack px={navCollapsed ? 0 : 1} justify={navCollapsed ? "center" : "flex-start"}>
            <ColorModeButton />
          </HStack>
        </Stack>
      </Stack>

      <Flex direction="column" flex={1} minW={0}>
        {/* Capçalera (mòbil) */}
        <HStack
          display={{ base: "flex", md: "none" }}
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
            {screen !== "projects" && (
              <IconButton aria-label="Tornar als mobles" variant="ghost" size="sm" onClick={() => setScreen("projects")}>
                <LuArrowLeft />
              </IconButton>
            )}
            <Heading size="md" truncate>
              {screen === "projects" ? "Mobles" : screen === "settings" ? "Preferències" : project?.name ?? "Mobles"}
            </Heading>
          </HStack>
          <ColorModeButton />
        </HStack>

        <Container
          as="main"
          maxW="none"
          flex={1}
          px={4}
          py={{ base: 4, md: 6 }}
          pb={{ base: "calc(76px + env(safe-area-inset-bottom, 0px))", md: 6 }}
        >
          {content}
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
        {NAV.map((n) => {
          const disabled = n.needsProject && projectId === null
          const active = screen === n.id
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
              <button disabled={disabled} onClick={() => go(n.id)} aria-current={active ? "page" : undefined}>
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
