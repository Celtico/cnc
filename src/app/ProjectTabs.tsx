import { Box, HStack, SegmentGroup, Tabs, Text } from "@chakra-ui/react"
import type { PROJECT_NAV, Screen } from "./nav"

type Props = { screen: Screen; projectNav: typeof PROJECT_NAV; onGo: (s: Screen) => void }

/**
 * Pàgines del moble obert (Editor · Peces · Nesting · Exportar): a l'ordinador, al mig de la barra
 * de dalt; al mòbil, en una franja sota la barra (`MobileProjectTabs`; la barra de baix és sempre el menú general).
 */
export function ProjectTabs({ screen, projectNav, onGo }: Props) {
  return (
    <SegmentGroup.Root size="sm" value={screen === "photo" ? "editor" : screen} onValueChange={(e) => e.value && onGo(e.value as Screen)}>
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
  )
}

/**
 * Al mòbil, les pàgines del moble a sang (de vora a vora), com unes pestanyes d'app: icona a sobre, nom a
 * sota i la triada amb el color principal i una ratlla a baix (les `Tabs` de Chakra, variant `line`: fletxes del teclat i
 * rols de pestanya inclosos).
 */
export function MobileProjectTabs({ screen, projectNav, onGo }: Props) {
  const current = screen === "photo" ? "editor" : screen
  return (
    <Tabs.Root value={current} onValueChange={(e) => onGo(e.value as Screen)} variant="line" fitted colorPalette="wood" activationMode="manual">
      {/* La ratlla de sota ja la fa la franja que la conté. */}
      <Tabs.List aria-label="Pàgines del moble" borderBottomWidth={0}>
        {projectNav.map((n) => {
          const on = current === n.id
          return (
            <Tabs.Trigger key={n.id} value={n.id} minW={0} h="auto" flexDirection="column" gap={0.5} pt={1.5} pb={1} _selected={{ color: "wood.fg" }}>
              <Box fontSize="xl" display="inline-flex">
                <n.icon />
              </Box>
              <Text fontSize="xs" fontWeight={on ? "semibold" : "medium"} truncate maxW="full">
                {n.label}
              </Text>
            </Tabs.Trigger>
          )
        })}
      </Tabs.List>
    </Tabs.Root>
  )
}
