import { Box, Button, Flex, HStack, Heading, Stack, Text } from "@chakra-ui/react"
import { Children, isValidElement, type ReactNode } from "react"
import { LuChevronLeft, LuChevronRight, LuRotateCcw } from "react-icons/lu"
import type { IconType } from "react-icons"
import { SectionLabel } from "../../../components/SectionLabel"
import { PaneHeadContext } from "../paneHead"
import { useSessionString } from "../useSessionString"
import { DETAIL_KEYS } from "./detailKeys"

/** Categories dels apartats de Preferències. */
const SETTINGS_GROUPS: { label: string; ids: string[] }[] = [
  { label: "Fabricació", ids: ["machines", "rules", "hardware", "gaps", "materials", "boards", "label"] },
  { label: "Editor", ids: ["options"] },
  { label: "Foto i visor 3D", ids: ["references", "viewer3d"] },
  { label: "App", ids: ["display", "theme", "assistant"] },
]

interface PaneProps {
  id: string
  title: string
  icon: IconType
  desc?: string
  onReset?: () => void
  wide?: boolean
  children: ReactNode
}

/** Una pàgina de Preferències (només en llegeix les propietats `SettingsPages`). */
export function Pane(props: PaneProps): ReactNode {
  void props
  return null
}

/**
 * Preferències com les apps professionals (Configuració de macOS, Figma, VS Code): a l'esquerra
 * la llista d'apartats i a la dreta la pàgina triada, amb els grups d'opcions a la vista (res no
 * s'obre de cop). Al mòbil: la llista d'apartats i, en triar-ne un, la seva pàgina amb «‹ Preferències».
 */
export function SettingsPages({ header, children }: { header: ReactNode; children: ReactNode }) {
  const panes = Children.toArray(children)
    .filter(isValidElement)
    .map((c) => c.props as PaneProps)
  const [active, setActive] = useSessionString("mobles:settings-section")
  // Al mòbil, un sol «‹ Tornar» a la vista: amb un element obert (material, objecte) només el seu.
  const [refSel] = useSessionString(DETAIL_KEYS.references)
  const [machSel] = useSessionString(DETAIL_KEYS.machines)
  const detailOpen = (active === "references" && refSel !== null) || (active === "machines" && machSel !== null)
  // Apartats agrupats per categoria (com la Configuració de macOS): el que no hi surti, a «Altres».
  const groups = SETTINGS_GROUPS.map((g) => ({ label: g.label, panes: g.ids.flatMap((id) => panes.filter((p) => p.id === id)) }))
  const rest = panes.filter((p) => !SETTINGS_GROUPS.some((g) => g.ids.includes(p.id)))
  if (rest.length) groups.push({ label: "Altres", panes: rest })
  const ordered = groups.flatMap((g) => g.panes)
  const cur = panes.find((p) => p.id === active) ?? null
  const shown = cur ?? ordered[0]!
  return (
    <Stack gap={5}>
    {/* Capçalera (títol, importar/exportar): al mòbil, només a la llista d'apartats. */}
    <Box display={{ base: cur ? "none" : "block", md: "block" }}>{header}</Box>
    <Flex gap={6} align="flex-start">
      {/* Llista d'apartats: a l'ordinador sempre; al mòbil, només si no n'hi ha cap d'obert. */}
      <Stack as="nav" aria-label="Apartats de Preferències" w={{ base: "full", md: "230px" }} flexShrink={0} gap={0.5} display={{ base: cur ? "none" : "flex", md: "flex" }} position={{ md: "sticky" }} top={{ md: 0 }}>
        {groups.map((g) => (
        <Stack key={g.label} gap={1} mb={{ base: 3, md: 2 }}>
        <SectionLabel px={{ base: 1, md: 3 }}>
          {g.label}
        </SectionLabel>
        <Box borderWidth={{ base: "1px", md: 0 }} rounded="lg" overflow="hidden" bg={{ base: "bg.panel", md: "transparent" }}>
          {g.panes.map((p, i) => {
            const on = p.id === shown.id
            const PIcon = p.icon
            return (
              <HStack
                key={p.id}
                as="button"
                w="full"
                gap={3}
                px={3}
                py={{ base: 3, md: 2 }}
                rounded={{ md: "md" }}
                borderTopWidth={{ base: i ? "1px" : 0, md: 0 }}
                textAlign="left"
                bg={{ md: on ? "wood.subtle" : undefined }}
                color={{ md: on ? "wood.fg" : undefined }}
                fontWeight={{ md: on ? "semibold" : "normal" }}
                _hover={{ bg: { base: "bg.muted", md: on ? "wood.subtle" : "bg.muted" } }}
                aria-current={on ? "page" : undefined}
                onClick={() => setActive(p.id)}
                alignItems="flex-start"
              >
                <Box color="wood.fg" display="inline-flex" mt="3px">
                  <PIcon />
                </Box>
                <Stack gap={0} flex={1} minW={0}>
                  <Text fontSize="sm" truncate>
                    {p.title}
                  </Text>
                  {p.desc && (
                    <Text fontSize="xs" color="fg.muted" truncate display={{ md: "none" }}>
                      {p.desc}
                    </Text>
                  )}
                </Stack>
                <Box color="fg.subtle" display={{ base: "inline-flex", md: "none" }} alignSelf="center">
                  <LuChevronRight />
                </Box>
              </HStack>
            )
          })}
        </Box>
        </Stack>
        ))}
      </Stack>
      <Stack flex={1} minW={0} gap={4} display={{ base: cur ? "flex" : "none", md: "flex" }}>
        <Button display={{ base: detailOpen ? "none" : "inline-flex", md: "none" }} variant="ghost" size="sm" alignSelf="flex-start" ml={-2} onClick={() => setActive(null)}>
          <LuChevronLeft /> Preferències
        </Button>
        {!shown.wide && <PaneHeader pane={shown} />}
        <Stack gap={6} w="full" maxW={shown.wide ? "none" : "760px"}>
          {/* Pàgines de llista i detall: el títol va a dalt de la llista i el detall comença a dalt de tot. */}
          <PaneHeadContext.Provider value={shown.wide ? <PaneHeader pane={shown} /> : null}>{shown.children}</PaneHeadContext.Provider>
        </Stack>
      </Stack>
    </Flex>
    </Stack>
  )
}

function PaneHeader({ pane }: { pane: PaneProps }) {
  const Icon = pane.icon
  return (
    <HStack justify="space-between" gap={3} wrap="wrap" w="full" maxW={pane.wide ? "none" : "760px"}>
      <HStack gap={2.5} align="flex-start">
        <Box color="wood.fg" fontSize="xl" display="inline-flex" mt="5px">
          <Icon />
        </Box>
        <Stack gap={0}>
          <Heading size="lg">{pane.title}</Heading>
          {pane.desc && (
            <Text fontSize="sm" color="fg.muted">
              {pane.desc}
            </Text>
          )}
        </Stack>
      </HStack>
      {pane.onReset && (
        <Button size="xs" variant="ghost" colorPalette="red" onClick={pane.onReset}>
          <LuRotateCcw /> Restaurar valors inicials
        </Button>
      )}
    </HStack>
  )
}
