import { Box, HStack, Heading, IconButton, Stack, Text } from "@chakra-ui/react"
import { LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu"
import { Tooltip } from "../components/ui/tooltip"
import { ASSISTANT_ENTRY, GLOBAL_NAV, SETTINGS_ENTRY, type Section } from "./nav"
import { NavItem } from "./NavItem"
import { RenderStatusNavItem } from "./RenderStatusNav"

/** Barra lateral (escriptori), plegable a només icones */
export function SideNav({
  collapsed,
  onToggleCollapsed,
  section,
  settingsActive,
  assistantOpen,
  onSection,
  onAssistant,
  onSettings,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  section: Section
  settingsActive: boolean
  assistantOpen: boolean
  onSection: (id: string) => void
  onAssistant: () => void
  onSettings: () => void
}) {
  return (
    <Stack
      display={{ base: "none", md: "flex" }}
      as="nav"
      aria-label="Menú principal"
      w={collapsed ? "64px" : "220px"}
      transition="width 0.2s"
      flexShrink={0}
      p={collapsed ? 2 : 4}
      gap={1}
      borderRightWidth="1px"
      bg="bg.subtle"
      position="sticky"
      top={0}
      h="100dvh"
      overflow="hidden"
    >
      <HStack justify={collapsed ? "center" : "space-between"} mb={4} px={collapsed ? 0 : 2} minH="40px">
        {!collapsed && (
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
        <Tooltip content={collapsed ? "Desplegar el menú" : "Plegar el menú"} positioning={{ placement: "right" }}>
          <IconButton
            aria-label={collapsed ? "Desplegar el menú" : "Plegar el menú"}
            aria-expanded={!collapsed}
            variant="ghost"
            size="sm"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <LuPanelLeftOpen /> : <LuPanelLeftClose />}
          </IconButton>
        </Tooltip>
      </HStack>
      {/* Menú global, sempre igual (com Figma o Linear): només els apartats. Les pàgines d'un moble
          obert són pestanyes a la seva barra superior i les accions de cada apartat, a la seva capçalera. */}
      <Stack gap={1}>
        {GLOBAL_NAV.map((n) => (
          <NavItem key={n.id} icon={n.icon} label={n.label} collapsed={collapsed} active={section === n.id} disabled={false} onClick={() => onSection(n.id)} />
        ))}
        {/* L'assistent personal, sota els apartats: obre el calaix amb el xat (no és una pàgina). */}
        <Box pt={2} mt={1} borderTopWidth="1px">
          <NavItem icon={ASSISTANT_ENTRY.icon} label={ASSISTANT_ENTRY.label} collapsed={collapsed} active={assistantOpen} disabled={false} onClick={onAssistant} />
        </Box>
      </Stack>
      {/* Preferències, a baix de tot (com a les apps d'escriptori); a sobre, el Render que calcula (o s'ha aturat) si n'hi ha. */}
      <Stack gap={1} mt="auto" pt={2} borderTopWidth="1px" align={collapsed ? "center" : "stretch"}>
        <RenderStatusNavItem collapsed={collapsed} />
        <NavItem icon={SETTINGS_ENTRY.icon} label={SETTINGS_ENTRY.label} collapsed={collapsed} active={settingsActive} disabled={false} onClick={onSettings} />
      </Stack>
    </Stack>
  )
}
